const bcrypt = require('bcryptjs');
const { ensureDatabaseExists, getPool } = require('./db');
const { ALL_PERMISSION_KEYS } = require('./permissions');
const { migrateCancellation } = require('./migrate_cancellation');

async function initDatabase() {
  await ensureDatabaseExists();
  const pool = getPool();

  // Check if blood_products needs schema migration to new simplified structure (with unit_id, without per-ABO rows)
  const [cols] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blood_products' AND COLUMN_NAME = 'unit_id'
  `);
  const [lotCols] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_lots' AND COLUMN_NAME = 'blood_group'
  `);

  if (cols.length === 0 || lotCols.length === 0) {
    // Recreate product/lot/transaction tables to match simplified blood_products (code, name, unit_id, is_active)
    // and ABO/Rh on inventory_lots & transaction_items
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    await pool.query('DROP TABLE IF EXISTS transaction_items');
    await pool.query('DROP TABLE IF EXISTS transactions');
    await pool.query('DROP TABLE IF EXISTS inventory_lots');
    await pool.query('DROP TABLE IF EXISTS blood_products');
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  // 1. Nhóm quyền (roles)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) DEFAULT '',
      permissions TEXT NOT NULL,
      is_system TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 2. Người dùng (users)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      phone VARCHAR(30) DEFAULT '',
      email VARCHAR(100) DEFAULT '',
      role_id INT NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      last_login DATETIME NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const [userCols] = await pool.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login'
  `);
  if (userCols.length === 0) {
    await pool.query(`ALTER TABLE users ADD COLUMN last_login DATETIME NULL DEFAULT NULL AFTER is_active`);
  }

  // 3. Cấu hình & Thông tin hệ thống (system_config)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_config (
      config_key VARCHAR(100) PRIMARY KEY,
      config_value LONGTEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4. Danh mục Đơn vị đối tác (partners)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS partners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      partner_type ENUM('SUPPLIER', 'BORROW_LEND', 'BOTH') NOT NULL DEFAULT 'BOTH',
      contact_person VARCHAR(100) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      address VARCHAR(255) DEFAULT '',
      note VARCHAR(255) DEFAULT '',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4.5. Danh mục Khoa / Phòng (departments)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(150) NOT NULL,
      note VARCHAR(255) DEFAULT '',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 5. Danh mục Đơn vị tính (units)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS units (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      note VARCHAR(255) DEFAULT '',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. Danh mục Loại thể tích (volumes)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS volumes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      volume_ml INT NOT NULL,
      note VARCHAR(255) DEFAULT '',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 7. Danh mục Loại chế phẩm máu (blood_products): Mã loại - Tên - Đơn vị tính - Trạng thái
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blood_products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      volume_ml INT NOT NULL DEFAULT 250,
      unit_id INT NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 8. Tồn kho theo lô (inventory_lots)
  // Khi nhập hàng: Chọn Loại chế phẩm + ABO/Rh + Thể tích + HSD => gộp chung số lượng
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_lots (
      id INT AUTO_INCREMENT PRIMARY KEY,
      blood_code VARCHAR(50) NULL DEFAULT NULL,
      collection_date DATE NULL DEFAULT NULL,
      blood_product_id INT NOT NULL,
      blood_group ENUM('A', 'B', 'AB', 'O') NOT NULL,
      rh_factor ENUM('+', '-') NOT NULL DEFAULT '+',
      volume_id INT NOT NULL,
      unit_id INT NOT NULL,
      expiry_date DATE NOT NULL,
      quantity INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_bp (blood_product_id),
      INDEX idx_blood_code (blood_code),
      UNIQUE KEY uk_lot (blood_product_id, blood_group, rh_factor, volume_id, expiry_date, blood_code),
      FOREIGN KEY (blood_product_id) REFERENCES blood_products(id) ON DELETE RESTRICT,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE RESTRICT,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 9. Phiếu giao dịch Nhập / Xuất / Cho mượn / Mượn / Hoàn trả (transactions)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      tx_type ENUM('IMPORT', 'EXPORT', 'LEND', 'BORROW', 'RETURN_LEND', 'RETURN_BORROW') NOT NULL,
      tx_date DATETIME NOT NULL,
      partner_id INT NULL,
      person_name VARCHAR(150) DEFAULT '',
      department_info VARCHAR(200) DEFAULT '',
      parent_tx_id INT NULL,
      return_status ENUM('NONE', 'PENDING', 'PARTIAL', 'COMPLETED') NOT NULL DEFAULT 'NONE',
      status ENUM('COMPLETED', 'PENDING_CANCEL', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED',
      due_date DATE NULL,
      note TEXT,
      cancel_reason TEXT NULL,
      cancel_requested_by INT NULL,
      cancel_requested_at DATETIME NULL,
      cancel_approved_by INT NULL,
      cancel_approved_at DATETIME NULL,
      cancel_reject_reason TEXT NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_tx_id) REFERENCES transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (cancel_requested_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (cancel_approved_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await migrateCancellation();

  // 10. Chi tiết phiếu giao dịch (transaction_items)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id INT NOT NULL,
      blood_code VARCHAR(50) NULL DEFAULT NULL,
      collection_date DATE NULL DEFAULT NULL,
      blood_product_id INT NOT NULL,
      blood_group ENUM('A', 'B', 'AB', 'O') NOT NULL,
      rh_factor ENUM('+', '-') NOT NULL DEFAULT '+',
      volume_id INT NOT NULL,
      unit_id INT NOT NULL,
      expiry_date DATE NOT NULL,
      quantity INT NOT NULL,
      returned_quantity INT NOT NULL DEFAULT 0,
      parent_item_id INT NULL,
      note VARCHAR(255) DEFAULT '',
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (blood_product_id) REFERENCES blood_products(id) ON DELETE RESTRICT,
      FOREIGN KEY (volume_id) REFERENCES volumes(id) ON DELETE RESTRICT,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 11. Lịch sử sao lưu hệ thống (backups)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS backups (
      id INT AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL,
      file_size BIGINT NOT NULL DEFAULT 0,
      backup_type ENUM('AUTO', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
      note VARCHAR(255) DEFAULT '',
      created_by VARCHAR(100) DEFAULT 'System',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 12. Kỳ kiểm kê kho chế phẩm máu (inventory_audits)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_audits (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      audit_date DATE NOT NULL,
      status ENUM('IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
      committee TEXT NULL,
      note TEXT NULL,
      total_system_qty INT NOT NULL DEFAULT 0,
      total_actual_qty INT NOT NULL DEFAULT 0,
      total_diff_qty INT NOT NULL DEFAULT 0,
      matched_count INT NOT NULL DEFAULT 0,
      excess_count INT NOT NULL DEFAULT 0,
      deficit_count INT NOT NULL DEFAULT 0,
      uncounted_count INT NOT NULL DEFAULT 0,
      is_balanced TINYINT(1) NOT NULL DEFAULT 0,
      balanced_at DATETIME NULL,
      created_by INT NULL,
      creator_name VARCHAR(100) NULL,
      completed_by INT NULL,
      completer_name VARCHAR(100) NULL,
      completed_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 13. Chi tiết kiểm kê từng túi máu / lô (inventory_audit_items)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_audit_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      audit_id INT NOT NULL,
      lot_id INT NOT NULL,
      blood_code VARCHAR(50) NULL DEFAULT NULL,
      blood_product_id INT NOT NULL,
      product_name VARCHAR(200) NOT NULL,
      blood_group ENUM('A', 'B', 'AB', 'O') NOT NULL,
      rh_factor ENUM('+', '-') NOT NULL DEFAULT '+',
      volume_id INT NOT NULL,
      volume_name VARCHAR(100) NOT NULL,
      unit_id INT NOT NULL,
      unit_name VARCHAR(100) NOT NULL,
      collection_date DATE NULL DEFAULT NULL,
      expiry_date DATE NOT NULL,
      system_qty INT NOT NULL DEFAULT 0,
      actual_qty INT NOT NULL DEFAULT 0,
      diff_qty INT NOT NULL DEFAULT 0,
      status ENUM('MATCHED', 'EXCESS', 'DEFICIT', 'UNCOUNTED') NOT NULL DEFAULT 'UNCOUNTED',
      note VARCHAR(255) DEFAULT '',
      counted_at DATETIME NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_audit_id (audit_id),
      INDEX idx_lot_id (lot_id),
      INDEX idx_audit_blood_code (blood_code),
      FOREIGN KEY (audit_id) REFERENCES inventory_audits(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await seedInitialData(pool);
}

async function seedInitialData(pool) {
  // Seed Roles
  const [existingRoles] = await pool.query('SELECT COUNT(*) as cnt FROM roles');
  if (existingRoles[0].cnt === 0) {
    const adminPerms = JSON.stringify(ALL_PERMISSION_KEYS);
    const ktvPerms = JSON.stringify([
      'dashboard.view',
      'inventory.view',
      'import.view',
      'import.create',
      'import.print',
      'import.cancel_request',
      'export.view',
      'export.create',
      'export.print',
      'export.cancel_request',
      'borrow_lend.view',
      'borrow_lend.create',
      'borrow_lend.return',
      'borrow_lend.print',
      'audit.view',
      'audit.create',
      'audit.execute',
      'audit.export',
      'reports.view',
      'reports.export_excel',
      'reports.print',
      'categories.view',
    ]);
    const viewerPerms = JSON.stringify([
      'dashboard.view',
      'inventory.view',
      'import.view',
      'export.view',
      'borrow_lend.view',
      'reports.view',
      'reports.export_excel',
      'reports.print',
      'categories.view',
    ]);

    await pool.query(
      `INSERT INTO roles (code, name, description, permissions, is_system) VALUES
       ('ADMIN', 'Quản trị hệ thống (Admin)', 'Toàn quyền quản lý hệ thống, danh mục, phân quyền và sao lưu', ?, 1),
       ('KTV_XETNGHIEM', 'Kỹ thuật viên Xét nghiệm', 'Thực hiện Nhập kho, Xuất máu, Mượn/Cho mượn, Xem báo cáo và In phiếu', ?, 0),
       ('BAC_SI_TRUC', 'Bác sĩ / Nhân viên tra cứu', 'Tra cứu tồn kho tủ máu, xem hạn sử dụng và xuất báo cáo', ?, 0)`,
      [adminPerms, ktvPerms, viewerPerms]
    );
  } else {
    // Ensure existing ADMIN has all updated permission keys
    await pool.query('UPDATE roles SET permissions = ? WHERE code = ?', [
      JSON.stringify(ALL_PERMISSION_KEYS),
      'ADMIN',
    ]);
    // Ensure existing KTV role has cancel_request permissions if not present
    const [ktvRows] = await pool.query('SELECT id, permissions FROM roles WHERE code = ?', ['KTV_XETNGHIEM']);
    if (ktvRows.length > 0) {
      try {
        const perms = JSON.parse(ktvRows[0].permissions || '[]');
        let changed = false;
        if (!perms.includes('import.cancel_request')) {
          perms.push('import.cancel_request');
          changed = true;
        }
        if (!perms.includes('export.cancel_request')) {
          perms.push('export.cancel_request');
          changed = true;
        }
        ['audit.view', 'audit.create', 'audit.execute', 'audit.export'].forEach((k) => {
          if (!perms.includes(k)) {
            perms.push(k);
            changed = true;
          }
        });
        if (changed) {
          await pool.query('UPDATE roles SET permissions = ? WHERE id = ?', [JSON.stringify(perms), ktvRows[0].id]);
        }
      } catch (e) {}
    }
  }

  // Seed Users
  const [existingUsers] = await pool.query('SELECT COUNT(*) as cnt FROM users');
  if (existingUsers[0].cnt === 0) {
    const [roles] = await pool.query('SELECT id, code FROM roles');
    const adminRole = roles.find((r) => r.code === 'ADMIN')?.id || 1;
    const ktvRole = roles.find((r) => r.code === 'KTV_XETNGHIEM')?.id || 2;

    const adminHash = await bcrypt.hash('admin123', 10);
    const ktvHash = await bcrypt.hash('123456', 10);

    await pool.query(
      `INSERT INTO users (username, password_hash, full_name, phone, email, role_id, is_active) VALUES
       ('admin', ?, 'Quản trị viên Hệ thống', '0901234567', 'admin@benhvien.vn', ?, 1),
       ('ktv1', ?, 'CNXN. Nguyễn Thị Minh Anh', '0912345678', 'minhanh.xn@benhvien.vn', ?, 1),
       ('ktv2', ?, 'BS. Trần Văn Hùng', '0987654321', 'vanhung.xn@benhvien.vn', ?, 1)`,
      [adminHash, adminRole, ktvHash, ktvRole, ktvHash, ktvRole]
    );
  }

  // Seed System Config
  const defaultConfigs = [
    ['unit_name', 'BỆNH VIỆN THUẬN MỸ TDM'],
    ['department_name', 'KHOA XÉT NGHIỆM'],
    ['logo_url', ''],
    ['address', 'Số 01 Đường Y Học, Phường Trung Tâm, TP. Hồ Chí Minh'],
    ['phone', '028.3822.9999'],
    ['expiry_warning_days', '7'],
    ['app_name', 'Hệ thống Quản lý Tủ máu Xét nghiệm (BloodBank Lab)'],
    ['app_version', '2.0.0'],
    ['app_developer', 'Phòng Công nghệ Thông tin - Đội ngũ Phát triển Phần mềm Y tế'],
    ['app_release_year', '2026'],
    ['app_description', 'Phần mềm chuyên dụng quản lý nhập, xuất, mượn/cho mượn, cảnh báo hạn sử dụng và báo cáo tồn kho chế phẩm máu tại Khoa Xét nghiệm.'],
    ['auto_backup_enabled', 'true'],
    ['auto_backup_time', '23:00'],
    ['auto_backup_interval_hours', '24'],
    ['auto_backup_max_files', '3'],
  ];

  for (const [key, val] of defaultConfigs) {
    await pool.query(
      `INSERT IGNORE INTO system_config (config_key, config_value) VALUES (?, ?)`,
      [key, val]
    );
  }

  // Seed Units (Đơn vị tính)
  const [existingUnits] = await pool.query('SELECT COUNT(*) as cnt FROM units');
  if (existingUnits[0].cnt === 0) {
    await pool.query(`
      INSERT INTO units (code, name, note) VALUES
      ('DVI', 'Đơn vị (Bịch/Túi)', 'Đơn vị túi/bịch chế phẩm máu tiêu chuẩn'),
      ('TUI', 'Túi', 'Túi chế phẩm máu'),
      ('BICH', 'Bịch', 'Bịch chế phẩm máu'),
      ('LO', 'Lọ', 'Lọ chế phẩm sinh học')
    `);
  }

  // Seed Volumes (Loại thể tích)
  const [existingVolumes] = await pool.query('SELECT COUNT(*) as cnt FROM volumes');
  if (existingVolumes[0].cnt === 0) {
    await pool.query(`
      INSERT INTO volumes (code, name, volume_ml, note) VALUES
      ('V150', '150 ml', 150, 'Thể tích 150ml (Huyết tương / Nhi khoa)'),
      ('V250', '250 ml', 250, 'Thể tích tiêu chuẩn 250ml'),
      ('V350', '350 ml', 350, 'Thể tích tiêu chuẩn 350ml'),
      ('V450', '450 ml', 450, 'Thể tích tiêu chuẩn 450ml')
    `);
  }

  // Seed Partners (Đơn vị đối tác)
  const [existingPartners] = await pool.query('SELECT COUNT(*) as cnt FROM partners');
  if (existingPartners[0].cnt === 0) {
    await pool.query(`
      INSERT INTO partners (code, name, partner_type, contact_person, phone, address, note) VALUES
      ('BV_HH_TM', 'Bệnh viện Truyền máu Huyết học', 'BOTH', 'BS.CKII Lê Quang Đạt', '028 3957 1342', '118 Hồng Bàng, Quận 5, TP.HCM', 'Đơn vị cung cấp chế phẩm máu chính & điều phối máu'),
      ('TT_TM_CR', 'Trung tâm Truyền máu Chợ Rẫy', 'BOTH', 'ThS.BS Phạm Hoàng Nam', '028 3855 4137', '201B Nguyễn Chí Thanh, Quận 5, TP.HCM', 'Đơn vị cung cấp và hỗ trợ mượn máu cấp cứu'),
      ('BV_DK_KV', 'Bệnh viện Đa khoa Khu vực Thủ Đức', 'BORROW_LEND', 'CNXN. Vũ Thanh Tuyền', '028 3722 3556', '64 Lê Văn Chí, TP. Thủ Đức', 'Đơn vị liên kết mượn / cho mượn chế phẩm máu'),
      ('BV_ND_115', 'Bệnh viện Nhân Dân 115 - Khoa Xét nghiệm', 'BORROW_LEND', 'BS. Nguyễn Trung Kiên', '028 3865 2368', '527 Sư Vạn Hạnh, Quận 10, TP.HCM', 'Đơn vị liên kết hỗ trợ máu hiếm & cấp cứu')
    `);
  }

  // Seed Departments (Khoa / Phòng)
  const [existingDepts] = await pool.query('SELECT COUNT(*) as cnt FROM departments');
  if (existingDepts[0].cnt === 0) {
    await pool.query(`
      INSERT INTO departments (code, name, note, is_active) VALUES
      ('CAP_CUU', 'Khoa Cấp cứu', 'Tiếp nhận và cấp cứu ban đầu', 1),
      ('PHAU_THUAT', 'Khoa Phẫu thuật - Gây mê hồi sức', 'Phòng mổ & hồi sức ngoại khoa', 1),
      ('HSCC', 'Khoa Hồi sức tích cực - Chống độc', 'Điều trị tích cực bệnh nhân nặng', 1),
      ('SAN_PHU', 'Khoa Phụ Sản', 'Sản phụ khoa & cấp cứu sản khoa', 1),
      ('NOI_TH', 'Khoa Nội Tổng hợp', 'Điều trị nội khoa tổng hợp', 1),
      ('NGOAI_TH', 'Khoa Ngoại Tổng hợp', 'Điều trị ngoại khoa tổng hợp', 1)
    `);
  }
}

module.exports = { initDatabase };
