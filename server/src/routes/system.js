const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { getPool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { PERMISSION_MODULES } = require('../permissions');
const {
  BACKUP_DIR,
  createBackup,
  enforceBackupRetention,
  restoreFromPayload,
} = require('../backupManager');
const { logActivity } = require('../logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ==================== 1. CẤU HÌNH HỆ THỐNG & THÔNG TIN HỆ THỐNG ====================
router.get('/config', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT config_key, config_value FROM system_config');
    const config = {};
    for (const r of rows) {
      config[r.config_key] = r.config_value;
    }
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/config', authenticate, requirePermission('system.config'), async (req, res) => {
  try {
    const pool = getPool();
    const updates = req.body || {};

    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO system_config (config_key, config_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [key, String(value ?? '')]
      );
    }

    try {
      await enforceBackupRetention();
    } catch (bErr) {
      console.warn('Backup retention check warning:', bErr.message);
    }

    res.json({ message: 'Lưu cấu hình hệ thống thành công' });
  } catch (err) {
    console.error('Lỗi lưu cấu hình:', err);
    res.status(500).json({ error: 'Lỗi lưu cấu hình: ' + err.message });
  }
});

// ==================== 2. NHÓM QUYỀN & PHÂN QUYỀN CHI TIẾT ====================
router.get('/permissions', authenticate, (req, res) => {
  res.json(PERMISSION_MODULES);
});

router.get('/roles', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(`
      SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
      FROM roles r
      ORDER BY r.id ASC
    `);
    const result = rows.map((r) => {
      let permissions = [];
      try {
        permissions = JSON.parse(r.permissions || '[]');
      } catch {
        permissions = [];
      }
      return { ...r, permissions };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/roles', authenticate, requirePermission('system.roles'), async (req, res) => {
  try {
    const { code, name, description, permissions } = req.body;
    if (!code || !name) {
      return res.status(400).json({ error: 'Mã nhóm quyền và Tên nhóm quyền là bắt buộc' });
    }
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO roles (code, name, description, permissions, is_system)
       VALUES (?, ?, ?, ?, 0)`,
      [
        code.trim().toUpperCase(),
        name.trim(),
        description || '',
        JSON.stringify(Array.isArray(permissions) ? permissions : []),
      ]
    );
    res.json({ id: result.insertId, message: 'Tạo nhóm quyền thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Mã nhóm quyền đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/roles/:id', authenticate, requirePermission('system.roles'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    const pool = getPool();
    await pool.query(
      `UPDATE roles SET name = ?, description = ?, permissions = ? WHERE id = ?`,
      [
        name.trim(),
        description || '',
        JSON.stringify(Array.isArray(permissions) ? permissions : []),
        req.params.id,
      ]
    );
    res.json({ message: 'Cập nhật phân quyền cho nhóm quyền thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/roles/:id', authenticate, requirePermission('system.roles'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT is_system FROM roles WHERE id = ?', [req.params.id]);
    if (rows[0]?.is_system) {
      return res.status(400).json({ error: 'Không thể xóa nhóm quyền mặc định của hệ thống' });
    }
    const [[userCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM users WHERE role_id = ?',
      [req.params.id]
    );
    if (userCheck.cnt > 0) {
      return res.status(400).json({ error: 'Không thể xóa nhóm quyền đang có người dùng ràng buộc!' });
    }
    await pool.query('DELETE FROM roles WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa nhóm quyền' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa nhóm quyền đang có người dùng' });
  }
});

// ==================== 3. NGƯỜI DÙNG (USERS) ====================
router.get('/users', authenticate, requirePermission('system.users'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role_id, u.is_active, u.created_at, u.last_login,
              r.code AS role_code, r.name AS role_name,
              (SELECT COUNT(*) FROM transactions WHERE created_by = u.id OR cancel_requested_by = u.id OR cancel_approved_by = u.id) AS tx_count,
              (SELECT COUNT(*) FROM inventory_audits WHERE created_by = u.id OR completed_by = u.id) AS audit_count
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.id ASC`
    );

    const mapped = rows.map((u) => {
      const hasLogin = Boolean(u.last_login) || u.username === 'admin';
      const hasOps = Number(u.tx_count) > 0 || Number(u.audit_count) > 0;
      const hasHistory = hasLogin || hasOps;
      let deletePreventReason = '';
      if (u.username === 'admin') {
        deletePreventReason = 'Tài khoản Quản trị viên hệ thống (Admin), không thể xóa';
      } else if (hasOps) {
        deletePreventReason = 'Tài khoản đã phát sinh dữ liệu giao dịch hoặc kiểm kê, không thể xóa';
      } else if (hasLogin) {
        deletePreventReason = 'Tài khoản đã có lịch sử đăng nhập hệ thống, không thể xóa';
      }
      return {
        ...u,
        has_history: hasHistory,
        can_delete: !hasHistory && u.username !== 'admin',
        delete_prevent_reason: deletePreventReason,
      };
    });

    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users', authenticate, requirePermission('system.users'), async (req, res) => {
  try {
    const { username, password, full_name, phone, email, role_id, is_active } = req.body;
    if (!username || !password || !full_name || !role_id) {
      return res.status(400).json({ error: 'Vui lòng nhập Tên đăng nhập, Mật khẩu, Họ tên và Nhóm quyền' });
    }
    const hash = await bcrypt.hash(password, 10);
    const pool = getPool();
    const [result] = await pool.query(
      `INSERT INTO users (username, password_hash, full_name, phone, email, role_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        username.trim(),
        hash,
        full_name.trim(),
        phone || '',
        email || '',
        Number(role_id),
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
      ]
    );
    await logActivity({
      req,
      actionType: 'USER_CREATE',
      actionCategory: 'SYSTEM',
      actionName: `Tạo tài khoản người dùng "${username.trim()}"`,
      description: `Tạo mới tài khoản "${username.trim()}" cho nhân sự "${full_name.trim()}"`,
      status: 'SUCCESS',
      metadata: { user_id: result.insertId, username: username.trim(), full_name: full_name.trim() },
    });
    res.json({ id: result.insertId, message: 'Tạo tài khoản người dùng thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/status', authenticate, requirePermission('system.users'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { is_active } = req.body;
    const newStatus = is_active ? 1 : 0;

    const pool = getPool();
    const [[targetUser]] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản người dùng' });
    }

    if (req.user.id === targetId && newStatus === 0) {
      return res.status(400).json({ error: 'Không thể ngưng hoạt động tài khoản đang đăng nhập' });
    }

    if (targetUser.username === 'admin' && newStatus === 0) {
      return res.status(400).json({ error: 'Không thể ngưng hoạt động tài khoản Quản trị viên hệ thống (Admin)' });
    }

    await pool.query('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, targetId]);

    await logActivity({
      req,
      actionType: 'USER_STATUS',
      actionCategory: 'SYSTEM',
      actionName: newStatus
        ? `Kích hoạt tài khoản "${targetUser.username}"`
        : `Ngưng hoạt động tài khoản "${targetUser.username}"`,
      description: `Đổi trạng thái tài khoản "${targetUser.username}" thành ${newStatus ? 'Hoạt động' : 'Đã khóa'}`,
      status: 'SUCCESS',
      metadata: { target_id: targetId, username: targetUser.username, is_active: newStatus },
    });

    res.json({
      message: newStatus
        ? `Đã kích hoạt tài khoản "${targetUser.username}"`
        : `Đã ngưng hoạt động tài khoản "${targetUser.username}"`,
      is_active: newStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id', authenticate, requirePermission('system.users'), async (req, res) => {
  try {
    const { full_name, phone, email, role_id, is_active, password } = req.body;
    const pool = getPool();

    if (password && password.trim().length > 0) {
      const hash = await bcrypt.hash(password.trim(), 10);
      await pool.query(
        `UPDATE users SET full_name = ?, phone = ?, email = ?, role_id = ?, is_active = ?, password_hash = ? WHERE id = ?`,
        [full_name.trim(), phone || '', email || '', Number(role_id), is_active ? 1 : 0, hash, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE users SET full_name = ?, phone = ?, email = ?, role_id = ?, is_active = ? WHERE id = ?`,
        [full_name.trim(), phone || '', email || '', Number(role_id), is_active ? 1 : 0, req.params.id]
      );
    }

    await logActivity({
      req,
      actionType: 'USER_UPDATE',
      actionCategory: 'SYSTEM',
      actionName: `Cập nhật người dùng ID ${req.params.id}`,
      description: `Cập nhật thông tin tài khoản nhân sự: "${full_name.trim()}"`,
      status: 'SUCCESS',
      metadata: { user_id: req.params.id, full_name: full_name.trim() },
    });

    res.json({ message: 'Cập nhật thông tin người dùng thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', authenticate, requirePermission('system.users'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập' });
    }
    const pool = getPool();
    const [[targetUser]] = await pool.query('SELECT * FROM users WHERE id = ?', [targetId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng' });
    }

    if (targetUser.username === 'admin') {
      return res.status(400).json({ error: 'Không thể xóa tài khoản Quản trị viên hệ thống (Admin)' });
    }

    if (targetUser.last_login) {
      return res.status(400).json({
        error: 'Không thể xóa tài khoản đã có lịch sử đăng nhập hệ thống! Hãy sử dụng nút gạt ngưng kích hoạt tài khoản.',
      });
    }

    const [[txCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM transactions WHERE created_by = ? OR cancel_requested_by = ? OR cancel_approved_by = ?',
      [targetId, targetId, targetId]
    );
    if (txCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa người dùng đã có dữ liệu giao dịch liên quan!',
      });
    }

    const [[auditCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM inventory_audits WHERE created_by = ? OR completed_by = ?',
      [targetId, targetId]
    );
    if (auditCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa người dùng đã tham gia vào các kỳ kiểm kê!',
      });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [targetId]);

    await logActivity({
      req,
      actionType: 'USER_DELETE',
      actionCategory: 'SYSTEM',
      actionName: `Xóa tài khoản người dùng "${targetUser.username}"`,
      description: `Đã xóa tài khoản "${targetUser.username}" (${targetUser.full_name})`,
      status: 'SUCCESS',
      metadata: { target_id: targetId, username: targetUser.username },
    });

    res.json({ message: 'Đã xóa tài khoản người dùng thành công' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa người dùng đã có dữ liệu liên quan' });
  }
});

// ==================== 4. SAO LƯU & KHÔI PHỤC (BACKUP & RESTORE) ====================
router.get('/backups', authenticate, requirePermission('system.backup'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM backups ORDER BY created_at DESC, id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/backups/manual', authenticate, requirePermission('system.backup'), async (req, res) => {
  try {
    const { note, backup_type } = req.body;
    const type = backup_type === 'AUTO' ? 'AUTO' : 'MANUAL';
    const created = await createBackup({
      backupType: type,
      note: note || (type === 'AUTO' ? 'Sao lưu tự động (Giữ tối đa 3 bản)' : 'Sao lưu thủ công bởi người dùng'),
      createdBy: req.user.full_name || req.user.username,
    });
    res.json({
      backup: created,
      message: 'Đã tạo bản sao lưu thành công',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/backups/:id/download', authenticate, requirePermission('system.backup'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM backups WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy bản sao lưu' });
    }
    const filePath = path.join(BACKUP_DIR, rows[0].file_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File sao lưu không tồn tại trên ổ đĩa' });
    }
    res.download(filePath, rows[0].file_name);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/backups/:id/restore', authenticate, requirePermission('system.backup'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM backups WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy bản sao lưu' });
    }
    const filePath = path.join(BACKUP_DIR, rows[0].file_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File sao lưu không còn tồn tại trên máy chủ' });
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const payload = JSON.parse(raw);
    await restoreFromPayload(payload);

    res.json({ message: `Đã khôi phục dữ liệu thành công từ bản sao lưu "${rows[0].file_name}"` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/backups/upload-restore',
  authenticate,
  requirePermission('system.backup'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Vui lòng chọn file sao lưu (.json)' });
      }
      const content = req.file.buffer.toString('utf8');
      const payload = JSON.parse(content);
      await restoreFromPayload(payload);

      res.json({ message: `Khôi phục dữ liệu từ file "${req.file.originalname}" thành công!` });
    } catch (err) {
      res.status(400).json({ error: 'Không thể khôi phục từ file này: ' + err.message });
    }
  }
);

router.delete('/backups/:id', authenticate, requirePermission('system.backup'), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM backups WHERE id = ?', [req.params.id]);
    if (rows.length) {
      const filePath = path.join(BACKUP_DIR, rows[0].file_name);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await pool.query('DELETE FROM backups WHERE id = ?', [req.params.id]);
    }
    res.json({ message: 'Đã xóa bản sao lưu' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 5. NHẬT KÝ HOẠT ĐỘNG (ACTIVITY LOGS) ====================
router.get('/logs', authenticate, async (req, res) => {
  try {
    const user = req.user;
    const canViewLogs =
      user.role_code === 'ADMIN' ||
      (Array.isArray(user.permissions) &&
        (user.permissions.includes('system.logs') || user.permissions.includes('system.config')));

    if (!canViewLogs) {
      return res.status(403).json({ error: 'Bạn không có quyền xem nhật ký hoạt động hệ thống' });
    }

    const {
      category,
      status,
      user_id,
      from_date,
      to_date,
      search,
      page = 1,
      pageSize = 20,
    } = req.query;

    const pool = getPool();
    const where = [];
    const params = [];

    if (category && category !== 'ALL') {
      where.push('l.action_category = ?');
      params.push(category);
    }

    if (status && status !== 'ALL') {
      where.push('l.status = ?');
      params.push(status);
    }

    if (user_id) {
      where.push('l.user_id = ?');
      params.push(Number(user_id));
    }

    if (from_date) {
      where.push('DATE(l.created_at) >= ?');
      params.push(from_date);
    }

    if (to_date) {
      where.push('DATE(l.created_at) <= ?');
      params.push(to_date);
    }

    if (search && search.trim().length > 0) {
      const q = `%${search.trim()}%`;
      where.push('(l.action_name LIKE ? OR l.description LIKE ? OR l.username LIKE ? OR l.full_name LIKE ? OR l.ip_address LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Count
    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM activity_logs l ${whereClause}`,
      params
    );
    const total = Number(countRow.total || 0);

    // Pagination
    const limit = Math.max(1, Math.min(100, parseInt(pageSize, 10) || 20));
    const offset = Math.max(0, (parseInt(page, 10) || 1) - 1) * limit;

    const [rows] = await pool.query(
      `SELECT l.* FROM activity_logs l ${whereClause} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Stats
    const [[statsRow]] = await pool.query(`
      SELECT 
        COUNT(*) AS total_logs,
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END), 0) AS today_logs,
        COALESCE(SUM(CASE WHEN action_category = 'AUTH' THEN 1 ELSE 0 END), 0) AS auth_count,
        COALESCE(SUM(CASE WHEN action_category = 'TRANSACTION' THEN 1 ELSE 0 END), 0) AS tx_count,
        COALESCE(SUM(CASE WHEN action_category = 'AUDIT' THEN 1 ELSE 0 END), 0) AS audit_count,
        COALESCE(SUM(CASE WHEN action_category = 'CATEGORY' THEN 1 ELSE 0 END), 0) AS category_count,
        COALESCE(SUM(CASE WHEN action_category = 'SYSTEM' THEN 1 ELSE 0 END), 0) AS system_count
      FROM activity_logs
    `);

    res.json({
      logs: rows,
      total,
      page: parseInt(page, 10) || 1,
      pageSize: limit,
      stats: {
        total_logs: Number(statsRow?.total_logs || 0),
        today_logs: Number(statsRow?.today_logs || 0),
        auth_count: Number(statsRow?.auth_count || 0),
        tx_count: Number(statsRow?.tx_count || 0),
        audit_count: Number(statsRow?.audit_count || 0),
        category_count: Number(statsRow?.category_count || 0),
        system_count: Number(statsRow?.system_count || 0),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
