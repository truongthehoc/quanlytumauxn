const { getPool } = require('./db');

/**
 * Ghi lịch sử hoạt động vào bảng activity_logs
 * @param {Object} params
 * @param {Object} [params.req] - Express request (để lấy user, ip, user-agent)
 * @param {number} [params.userId] - ID người dùng (nếu không truyền req)
 * @param {string} [params.username] - Tên đăng nhập
 * @param {string} [params.fullName] - Họ tên người dùng
 * @param {string} params.actionType - Mã hành động (vd: 'LOGIN', 'IMPORT_CREATE', 'EXPORT_CREATE', 'AUDIT_CREATE', 'USER_CREATE'...)
 * @param {string} params.actionCategory - Phân loại ('AUTH', 'TRANSACTION', 'AUDIT', 'CATEGORY', 'SYSTEM')
 * @param {string} params.actionName - Tên hành động tiếng Việt dễ hiểu
 * @param {string} [params.description] - Chi tiết nội dung thao tác
 * @param {string} [params.status] - 'SUCCESS' | 'FAILED' | 'WARNING'
 * @param {Object} [params.metadata] - Dữ liệu JSON đi kèm
 */
async function logActivity({
  req,
  userId,
  username,
  fullName,
  actionType,
  actionCategory = 'SYSTEM',
  actionName,
  description = '',
  status = 'SUCCESS',
  metadata = null,
}) {
  try {
    const pool = getPool();
    const finalUserId = req?.user?.id || userId || null;
    const finalUsername = req?.user?.username || username || (finalUserId ? '' : 'system');
    const finalFullName = req?.user?.full_name || fullName || (finalUserId ? '' : 'Hệ thống');

    let ipAddress = req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
    if (typeof ipAddress === 'string' && ipAddress.includes(',')) {
      ipAddress = ipAddress.split(',')[0].trim();
    }
    // Clean IPv6 prefix like ::ffff:
    if (typeof ipAddress === 'string' && ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.replace('::ffff:', '');
    }

    const userAgent = req?.headers?.['user-agent'] || '';

    await pool.query(
      `INSERT INTO activity_logs (
        user_id, username, full_name, action_type, action_category,
        action_name, description, ip_address, user_agent, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        finalUserId,
        finalUsername ? String(finalUsername).slice(0, 50) : '',
        finalFullName ? String(finalFullName).slice(0, 100) : '',
        actionType,
        actionCategory,
        actionName,
        description || '',
        ipAddress ? String(ipAddress).slice(0, 45) : '',
        userAgent ? String(userAgent).slice(0, 255) : '',
        status,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[!] Lỗi ghi nhật ký hoạt động:', err.message);
  }
}

module.exports = {
  logActivity,
};
