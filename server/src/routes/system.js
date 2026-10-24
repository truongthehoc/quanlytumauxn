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

    await enforceBackupRetention();
    res.json({ message: 'Lưu cấu hình hệ thống thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role_id, u.is_active, u.created_at,
              r.code AS role_code, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.id ASC`
    );
    res.json(rows);
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
    res.json({ id: result.insertId, message: 'Tạo tài khoản người dùng thành công' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại' });
    }
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
    res.json({ message: 'Cập nhật thông tin người dùng thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/users/:id', authenticate, requirePermission('system.users'), async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Không thể tự xóa tài khoản đang đăng nhập' });
    }
    const pool = getPool();
    const [[txCheck]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM transactions WHERE created_by = ?',
      [req.params.id]
    );
    if (txCheck.cnt > 0) {
      return res.status(400).json({
        error: 'Không thể xóa người dùng đã có dữ liệu giao dịch liên quan!',
      });
    }
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa tài khoản người dùng' });
  } catch (err) {
    res.status(400).json({ error: 'Không thể xóa người dùng đã có dữ liệu giao dịch' });
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

module.exports = router;
