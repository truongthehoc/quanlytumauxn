const express = require('express');
const { getPool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { logActivity } = require('../logger');

const router = express.Router();

// Get all categories at once for dropdowns
router.get('/all', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [partners] = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.partner_id = p.id) AS usage_count
      FROM partners p
      ORDER BY p.name ASC
    `);
    const [bloodProducts] = await pool.query(`
      SELECT bp.*, u.name AS unit_name, u.code AS unit_code,
        (
          (SELECT COUNT(*) FROM inventory_lots il WHERE il.blood_product_id = bp.id) +
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.blood_product_id = bp.id)
        ) AS usage_count
      FROM blood_products bp
      LEFT JOIN units u ON bp.unit_id = u.id
      ORDER BY bp.id ASC
    `);
    const [volumes] = await pool.query(`
      SELECT v.*,
        (
          (SELECT COUNT(*) FROM inventory_lots il WHERE il.volume_id = v.id) +
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.volume_id = v.id)
        ) AS usage_count
      FROM volumes v
      ORDER BY v.volume_ml ASC
    `);
    const [units] = await pool.query(`
      SELECT u.*,
        (
          (SELECT COUNT(*) FROM blood_products bp WHERE bp.unit_id = u.id) +
          (SELECT COUNT(*) FROM inventory_lots il WHERE il.unit_id = u.id) +
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.unit_id = u.id)
        ) AS usage_count
      FROM units u
      ORDER BY u.id ASC
    `);
    const [departments] = await pool.query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.department_info = d.name) AS usage_count
      FROM departments d
      ORDER BY d.id ASC
    `);
    const [users] = await pool.query(`
      SELECT u.id, u.full_name, u.username, u.phone, r.name AS role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.is_active = 1
      ORDER BY u.full_name ASC
    `);

    res.json({
      partners,
      bloodProducts,
      volumes,
      units,
      departments,
      users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cấu hình các mốc cảnh báo Hạn sử dụng (HSD)
router.get('/expiry-milestones', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT config_key, config_value FROM system_config WHERE config_key IN ('expiry_warning_milestones', 'expiry_warning_days')`
    );
    const msRow = rows.find((r) => r.config_key === 'expiry_warning_milestones');
    const daysRow = rows.find((r) => r.config_key === 'expiry_warning_days');
    res.json({
      expiry_warning_milestones: msRow?.config_value || '',
      expiry_warning_days: daysRow?.config_value || '7',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/expiry-milestones', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const canManage =
      user.role_code === 'ADMIN' ||
      (Array.isArray(user.permissions) &&
        (user.permissions.includes('categories.manage') || user.permissions.includes('system.config')));

    if (!canManage) {
      return res.status(403).json({ error: 'Bạn không có quyền cập nhật cấu hình cảnh báo' });
    }

    const { milestones } = req.body;
    if (!milestones || !Array.isArray(milestones)) {
      return res.status(400).json({ error: 'Dữ liệu mốc cảnh báo không hợp lệ' });
    }

    const warningList = milestones.filter(
      (m) => !m.isExpired && !m.isSafe && Number(m.days) > 0
    );
    const computedWarningDays = warningList.length
      ? Math.max(...warningList.map((m) => Number(m.days)))
      : 7;

    const pool = getPool();
    const strMilestones = JSON.stringify(milestones);
    const strDays = String(computedWarningDays);

    await pool.query(
      `INSERT INTO system_config (config_key, config_value) VALUES ('expiry_warning_milestones', ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [strMilestones]
    );

    await pool.query(
      `INSERT INTO system_config (config_key, config_value) VALUES ('expiry_warning_days', ?)
       ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
      [strDays]
    );

    await logActivity({
      req,
      actionType: 'CONFIG_EXPIRY',
      actionCategory: 'CATEGORY',
      actionName: 'Cập nhật cấu hình cảnh báo HSD',
      description: `Cập nhật các mốc cảnh báo hạn dùng (Mốc cảnh báo tối đa: ${strDays} ngày)`,
      status: 'SUCCESS',
      metadata: { expiry_warning_days: strDays, count: milestones.length },
    });

    res.json({
      message: 'Cập nhật cấu hình cảnh báo HSD thành công',
      expiry_warning_days: strDays,
      expiry_warning_milestones: strMilestones,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 1. ĐƠN VỊ ĐỐI TÁC (PARTNERS) ====================
router.get('/partners', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.partner_id = p.id) AS usage_count
      FROM partners p
      ORDER BY p.id DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/partners', authenticate, async (req, res) => {
  try {
    const { code, name, partner_type, contact_person, phone, address, note, is_active } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Mã đơn vị và Tên đơn vị đối tác là bắt buộc' });
    }
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO partners (code, name, partner_type, contact_person, phone, address, note, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        partner_type || 'BOTH',
        contact_person || '',
        phone || '',
        address || '',
        note || '',
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );
    res.json({ id: result.insertId, message: 'Thêm đơn vị đối tác thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã đơn vị đối tác đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/partners/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { name, partner_type, contact_person, phone, address, note, is_active } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE partners
       SET name = ?, partner_type = ?, contact_person = ?, phone = ?, address = ?, note = ?, is_active = ?
       WHERE id = ?`,
      [
        name.trim(),
        partner_type || 'BOTH',
        contact_person || '',
        phone || '',
        address || '',
        note || '',
        is_active ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ message: 'Cập nhật đơn vị đối tác thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/partners/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const pool = getPool();
    const [[txCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM transactions WHERE partner_id = ?',
      [req.params.id]
    );
    if (txCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa đơn vị đối tác này vì đã tồn tại dữ liệu giao dịch liên quan!',
      });
    }
    await pool.query('DELETE FROM partners WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa đơn vị đối tác' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa đơn vị đối tác đã có dữ liệu liên quan!' });
  }
});

// ==================== 2. LOẠI CHẾ PHẨM MÁU (BLOOD PRODUCTS): Mã loại - Tên - Đơn vị tính - Trạng thái ====================
router.get('/blood-products', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT bp.*, u.name AS unit_name, u.code AS unit_code,
        (
          (SELECT COUNT(*) FROM inventory_lots il WHERE il.blood_product_id = bp.id) +
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.blood_product_id = bp.id)
        ) AS usage_count
      FROM blood_products bp
      LEFT JOIN units u ON bp.unit_id = u.id
      ORDER BY bp.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/blood-products', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { code, name, volume_ml, unit_id, is_active } = req.body;
    if (!code || !name || !unit_id) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ Mã loại, Tên chế phẩm và Đơn vị tính' });
    }
    const pool = getPool();
    const ml = Number(volume_ml) || 250;
    const [existVol] = await pool.query('SELECT id FROM volumes WHERE volume_ml = ? LIMIT 1', [ml]);
    if (existVol.length === 0) {
      await pool.query('INSERT INTO volumes (code, name, volume_ml, note) VALUES (?, ?, ?, ?)', [
        `VOL_${ml}`,
        `${ml}ml`,
        ml,
        'Tự động tạo theo loại chế phẩm',
      ]);
    }
    const [result] = await pool.query(
      `INSERT INTO blood_products (code, name, volume_ml, unit_id, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        ml,
        Number(unit_id),
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );
    res.json({ id: result.insertId, message: 'Thêm loại chế phẩm máu thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã loại chế phẩm máu đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/blood-products/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { name, volume_ml, unit_id, is_active } = req.body;
    const pool = getPool();
    const ml = Number(volume_ml) || 250;
    const [existVol] = await pool.query('SELECT id FROM volumes WHERE volume_ml = ? LIMIT 1', [ml]);
    if (existVol.length === 0) {
      await pool.query('INSERT INTO volumes (code, name, volume_ml, note) VALUES (?, ?, ?, ?)', [
        `VOL_${ml}`,
        `${ml}ml`,
        ml,
        'Tự động tạo theo loại chế phẩm',
      ]);
    }
    await pool.query(
      `UPDATE blood_products
       SET name = ?, volume_ml = ?, unit_id = ?, is_active = ?
       WHERE id = ?`,
      [
        name.trim(),
        ml,
        Number(unit_id),
        is_active ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ message: 'Cập nhật loại chế phẩm máu thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/blood-products/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const pool = getPool();
    const [[lotCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM inventory_lots WHERE blood_product_id = ?',
      [req.params.id]
    );
    const [[txItemCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM transaction_items WHERE blood_product_id = ?',
      [req.params.id]
    );
    if (lotCheck.cnt > 0 || txItemCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa loại chế phẩm máu này vì đã tồn tại dữ liệu trong kho hoặc phiếu giao dịch!',
      });
    }
    await pool.query('DELETE FROM blood_products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa loại chế phẩm máu' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa loại chế phẩm máu đang có dữ liệu ràng buộc!' });
  }
});

// ==================== 3. LOẠI THỂ TÍCH (VOLUMES) ====================
router.get('/volumes', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT v.*,
        (
          (SELECT COUNT(*) FROM inventory_lots il WHERE il.volume_id = v.id) +
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.volume_id = v.id)
        ) AS usage_count
      FROM volumes v
      ORDER BY v.volume_ml ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/volumes', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { code, name, volume_ml, note, is_active } = req.body;
    if (!code || !name || !volume_ml) {
      return res.status(400).json({ error: 'Vui lòng nhập Mã, Tên và Giá trị thể tích (ml)' });
    }
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO volumes (code, name, volume_ml, note, is_active) VALUES (?, ?, ?, ?, ?)`,
      [code.trim().toUpperCase(), name.trim(), Number(volume_ml), note || '', is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );
    res.json({ id: result.insertId, message: 'Thêm loại thể tích thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã thể tích đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/volumes/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { name, volume_ml, note, is_active } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE volumes SET name = ?, volume_ml = ?, note = ?, is_active = ? WHERE id = ?`,
      [name.trim(), Number(volume_ml), note || '', is_active ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Cập nhật loại thể tích thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/volumes/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const pool = getPool();
    const [[lotCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM inventory_lots WHERE volume_id = ?',
      [req.params.id]
    );
    const [[txItemCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM transaction_items WHERE volume_id = ?',
      [req.params.id]
    );
    if (lotCheck.cnt > 0 || txItemCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa loại thể tích này vì đã tồn tại dữ liệu trong kho hoặc phiếu giao dịch!',
      });
    }
    await pool.query('DELETE FROM volumes WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa loại thể tích' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa loại thể tích đang có dữ liệu ràng buộc!' });
  }
});

// ==================== 4. ĐƠN VỊ TÍNH (UNITS) ====================
router.get('/units', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT u.*,
        (
          (SELECT COUNT(*) FROM blood_products bp WHERE bp.unit_id = u.id) +
          (SELECT COUNT(*) FROM inventory_lots il WHERE il.unit_id = u.id) +
          (SELECT COUNT(*) FROM transaction_items ti WHERE ti.unit_id = u.id)
        ) AS usage_count
      FROM units u
      ORDER BY u.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/units', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { code, name, note, is_active } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Vui lòng nhập Mã và Tên đơn vị tính' });
    }
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO units (code, name, note, is_active) VALUES (?, ?, ?, ?)`,
      [code.trim().toUpperCase(), name.trim(), note || '', is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );
    res.json({ id: result.insertId, message: 'Thêm đơn vị tính thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã đơn vị tính đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/units/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { name, note, is_active } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE units SET name = ?, note = ?, is_active = ? WHERE id = ?`,
      [name.trim(), note || '', is_active ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Cập nhật đơn vị tính thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/units/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const pool = getPool();
    const [[bpCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM blood_products WHERE unit_id = ?',
      [req.params.id]
    );
    if (bpCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa đơn vị tính này vì đang được sử dụng trong danh mục Loại chế phẩm máu!',
      });
    }
    const [[lotCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM inventory_lots WHERE unit_id = ?',
      [req.params.id]
    );
    const [[txItemCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM transaction_items WHERE unit_id = ?',
      [req.params.id]
    );
    if (lotCheck.cnt > 0 || txItemCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa đơn vị tính này vì đã tồn tại dữ liệu trong kho hoặc phiếu giao dịch!',
      });
    }
    await pool.query('DELETE FROM units WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa đơn vị tính' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa đơn vị tính đang có dữ liệu ràng buộc!' });
  }
});

// ==================== 5. KHOA / PHÒNG (DEPARTMENTS) ====================
router.get('/departments', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT d.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.department_info = d.name) AS usage_count
      FROM departments d
      ORDER BY d.id ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/departments', authenticate, async (req, res) => {
  try {
    const { code, name, note, is_active } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Vui lòng nhập Mã khoa/phòng và Tên khoa/phòng' });
    }
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO departments (code, name, note, is_active) VALUES (?, ?, ?, ?)`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        note || '',
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );
    res.json({ id: result.insertId, message: 'Thêm Khoa/Phòng thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã Khoa/Phòng đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/departments/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const { name, note, is_active } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE departments SET name = ?, note = ?, is_active = ? WHERE id = ?`,
      [name.trim(), note || '', is_active ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Cập nhật Khoa/Phòng thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/departments/:id', authenticate, requirePermission('categories.manage'), async (req, res) => {
  try {
    const pool = getPool();
    const [deptRows] = await pool.query('SELECT name FROM departments WHERE id = ?', [req.params.id]);
    if (deptRows.length > 0) {
      const [[txCheck]] = await pool.query(
        'SELECT COUNT(*) AS cnt FROM transactions WHERE department_info = ?',
        [deptRows[0].name]
      );
      if (txCheck.cnt > 0) {
        return res.status(400).json({
          error: 'Không thể xóa Khoa/Phòng này vì đã tồn tại dữ liệu phiếu xuất máu liên quan!',
        });
      }
    }
    await pool.query('DELETE FROM departments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa Khoa/Phòng' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa Khoa/Phòng đang có dữ liệu ràng buộc!' });
  }
});

module.exports = router;
