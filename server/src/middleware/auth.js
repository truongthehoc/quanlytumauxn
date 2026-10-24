const jwt = require('jsonwebtoken');
const { getPool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'blood_bank_secret_key_2026';

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục' });
    }
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.phone, u.email, u.role_id, u.is_active,
              r.code as role_code, r.name as role_name, r.permissions
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    const user = rows[0];
    let perms = [];
    try {
      perms = JSON.parse(user.permissions || '[]');
    } catch {
      perms = [];
    }

    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      phone: user.phone,
      email: user.email,
      role_id: user.role_id,
      role: user.role_code,
      role_code: user.role_code,
      role_name: user.role_name,
      permissions: perms,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập hết hạn hoặc không hợp lệ' });
  }
}

function requirePermission(permKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Chưa xác thực' });
    }
    if (
      req.user.role_code === 'ADMIN' ||
      req.user.permissions.includes(permKey)
    ) {
      return next();
    }
    return res.status(403).json({
      error: `Bạn không có quyền thực hiện thao tác này (${permKey})`,
    });
  };
}

module.exports = {
  JWT_SECRET,
  authenticate,
  requirePermission,
};
