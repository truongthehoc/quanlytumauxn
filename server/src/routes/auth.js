const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { JWT_SECRET, authenticate } = require('../middleware/auth');
const { logActivity } = require('../logger');

const router = express.Router();

// Public info for header & login screen
router.get('/system-info', async (req, res) => {
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

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.*, r.code as role_code, r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username.trim()]
    );

    if (!rows.length) {
      await logActivity({
        req,
        username: username ? String(username).trim() : 'Unknown',
        actionType: 'LOGIN_FAILED',
        actionCategory: 'AUTH',
        actionName: 'Đăng nhập thất bại',
        description: `Đăng nhập không thành công (Tên đăng nhập không tồn tại: "${username}")`,
        status: 'FAILED',
      });
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    const user = rows[0];
    if (!user.is_active) {
      await logActivity({
        req,
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        actionType: 'LOGIN_BLOCKED',
        actionCategory: 'AUTH',
        actionName: 'Đăng nhập bị từ chối',
        description: `Tài khoản "${user.username}" đang bị ngưng hoạt động / khóa`,
        status: 'WARNING',
      });
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      await logActivity({
        req,
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        actionType: 'LOGIN_FAILED',
        actionCategory: 'AUTH',
        actionName: 'Đăng nhập sai mật khẩu',
        description: `Người dùng "${user.username}" nhập sai mật khẩu`,
        status: 'FAILED',
      });
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' });
    }

    let permissions = [];
    try {
      permissions = JSON.parse(user.permissions || '[]');
    } catch {
      permissions = [];
    }

    // Cập nhật thời điểm đăng nhập gần nhất
    try {
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    } catch (errLastLogin) {
      console.error('Không thể cập nhật last_login:', errLastLogin);
    }

    await logActivity({
      req,
      userId: user.id,
      username: user.username,
      fullName: user.full_name,
      actionType: 'LOGIN',
      actionCategory: 'AUTH',
      actionName: 'Đăng nhập hệ thống',
      description: `Người dùng "${user.full_name}" (${user.username}) đăng nhập thành công`,
      status: 'SUCCESS',
    });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        email: user.email,
        role_id: user.role_id,
        role_code: user.role_code,
        role_name: user.role_name,
        permissions,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Current logged-in user
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// Change password
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 4 ký tự' });
    }

    const pool = getPool();
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [
      req.user.id,
    ]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin tài khoản người dùng' });
    }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      await logActivity({
        req,
        userId: req.user.id,
        username: req.user.username,
        fullName: req.user.full_name,
        actionType: 'USER_CHANGE_PASSWORD_FAILED',
        actionCategory: 'AUTH',
        actionName: 'Đổi mật khẩu thất bại',
        description: `Người dùng "${req.user.username}" đổi mật khẩu không thành công (sai mật khẩu hiện tại)`,
        status: 'FAILED',
      });
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);

    await logActivity({
      req,
      userId: req.user.id,
      username: req.user.username,
      fullName: req.user.full_name,
      actionType: 'USER_CHANGE_PASSWORD',
      actionCategory: 'AUTH',
      actionName: 'Đổi mật khẩu tài khoản',
      description: `Người dùng "${req.user.full_name}" (${req.user.username}) đã đổi mật khẩu thành công`,
      status: 'SUCCESS',
    });

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
