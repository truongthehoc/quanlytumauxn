const express = require('express');
const { getPool } = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, async (req, res) => {
  try {
    const pool = getPool();

    // 1. Cấu hình mốc cảnh báo HSD
    const [cfgRows] = await pool.query(
      `SELECT config_key, config_value FROM system_config WHERE config_key IN ('expiry_warning_days', 'expiry_warning_milestones')`
    );
    let warningDays = 7;
    const msRow = cfgRows.find((r) => r.config_key === 'expiry_warning_milestones');
    const legacyRow = cfgRows.find((r) => r.config_key === 'expiry_warning_days');
    if (msRow?.config_value) {
      try {
        const parsed = JSON.parse(msRow.config_value);
        const warningMilestones = parsed.filter((m) => !m.isExpired && !m.isSafe && Number(m.days) > 0);
        if (warningMilestones.length) {
          warningDays = Math.max(...warningMilestones.map((m) => Number(m.days)));
        }
      } catch (e) {
        warningDays = parseInt(legacyRow?.config_value || '7', 10) || 7;
      }
    } else if (legacyRow?.config_value) {
      warningDays = parseInt(legacyRow.config_value, 10) || 7;
    }

    // 2. Thống kê tồn kho tổng quan & cảnh báo
    const [[stockStats]] = await pool.query(
      `SELECT 
         COALESCE(SUM(il.quantity), 0) AS total_units,
         COALESCE(SUM(il.quantity * v.volume_ml), 0) AS total_volume_ml,
         COALESCE(SUM(CASE WHEN DATEDIFF(il.expiry_date, CURDATE()) < 0 THEN il.quantity ELSE 0 END), 0) AS expired_units,
         COALESCE(SUM(CASE WHEN DATEDIFF(il.expiry_date, CURDATE()) >= 0 AND DATEDIFF(il.expiry_date, CURDATE()) <= ? THEN il.quantity ELSE 0 END), 0) AS warning_units,
         COALESCE(SUM(CASE WHEN DATEDIFF(il.expiry_date, CURDATE()) > ? THEN il.quantity ELSE 0 END), 0) AS safe_units
       FROM inventory_lots il
       JOIN volumes v ON il.volume_id = v.id
       WHERE il.quantity > 0`,
      [warningDays, warningDays]
    );

    // 3. Cơ cấu nhóm máu ABO/Rh
    const [groupDistribution] = await pool.query(
      `SELECT 
         blood_group,
         rh_factor,
         SUM(quantity) AS quantity
       FROM inventory_lots
       WHERE quantity > 0
       GROUP BY blood_group, rh_factor
       ORDER BY blood_group ASC, rh_factor DESC`
    );

    // 4. Cơ cấu theo loại chế phẩm máu
    const [productDistribution] = await pool.query(
      `SELECT 
         bp.id,
         bp.code,
         bp.name,
         COALESCE(SUM(il.quantity), 0) AS quantity,
         COALESCE(SUM(il.quantity * v.volume_ml), 0) AS volume_ml
       FROM blood_products bp
       LEFT JOIN inventory_lots il ON il.blood_product_id = bp.id AND il.quantity > 0
       LEFT JOIN volumes v ON il.volume_id = v.id
       WHERE bp.is_active = 1
       GROUP BY bp.id, bp.code, bp.name
       ORDER BY quantity DESC, bp.name ASC`
    );

    // 5. Giao dịch Hôm nay & 30 ngày gần nhất
    const [todayTxs] = await pool.query(
      `SELECT 
         t.tx_type,
         COUNT(DISTINCT t.id) AS tx_count,
         COALESCE(SUM(ti.quantity), 0) AS total_units
       FROM transactions t
       JOIN transaction_items ti ON ti.transaction_id = t.id
       WHERE DATE(t.tx_date) = CURDATE() AND t.status != 'CANCELLED'
       GROUP BY t.tx_type`
    );

    const [monthTxs] = await pool.query(
      `SELECT 
         t.tx_type,
         COUNT(DISTINCT t.id) AS tx_count,
         COALESCE(SUM(ti.quantity), 0) AS total_units
       FROM transactions t
       JOIN transaction_items ti ON ti.transaction_id = t.id
       WHERE DATE(t.tx_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND t.status != 'CANCELLED'
       GROUP BY t.tx_type`
    );

    // 6. Số lượng Mượn / Cho mượn chưa hoàn trả
    const [[lendStats]] = await pool.query(
      `SELECT 
         COALESCE(SUM(CASE WHEN t.tx_type = 'LEND' THEN ti.quantity ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN t.tx_type = 'RETURN_LEND' THEN ti.quantity ELSE 0 END), 0) AS pending_lend_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'BORROW' THEN ti.quantity ELSE 0 END), 0) -
         COALESCE(SUM(CASE WHEN t.tx_type = 'RETURN_BORROW' THEN ti.quantity ELSE 0 END), 0) AS pending_borrow_qty
       FROM transactions t
       JOIN transaction_items ti ON ti.transaction_id = t.id
       WHERE t.status != 'CANCELLED'`
    );

    // 7. Yêu cầu hủy chờ duyệt
    const [[cancelStats]] = await pool.query(
      `SELECT COUNT(*) AS pending_cancel_count FROM transactions WHERE status = 'PENDING_CANCEL'`
    );

    // 8. Top các túi máu sắp hết hạn (Ưu tiên xuất FEFO)
    const [expiringLots] = await pool.query(
      `SELECT 
         il.id,
         il.blood_code,
         il.blood_group,
         il.rh_factor,
         il.expiry_date,
         il.quantity,
         DATEDIFF(il.expiry_date, CURDATE()) AS days_remaining,
         bp.name AS product_name,
         v.name AS volume_name,
         u.name AS unit_name
       FROM inventory_lots il
       JOIN blood_products bp ON il.blood_product_id = bp.id
       JOIN volumes v ON il.volume_id = v.id
       JOIN units u ON il.unit_id = u.id
       WHERE il.quantity > 0 AND DATEDIFF(il.expiry_date, CURDATE()) <= ?
       ORDER BY il.expiry_date ASC, il.id ASC
       LIMIT 8`,
      [warningDays]
    );

    // 9. Xu hướng Nhập vs Xuất 7 ngày gần nhất
    const [trend7Days] = await pool.query(
      `SELECT 
         DATE_FORMAT(dates.dt, '%d/%m') AS date_label,
         dates.dt AS full_date,
         COALESCE(SUM(CASE WHEN t.tx_type = 'IMPORT' THEN ti.quantity ELSE 0 END), 0) AS import_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'EXPORT' THEN ti.quantity ELSE 0 END), 0) AS export_qty
       FROM (
         SELECT CURDATE() - INTERVAL (a.a) DAY AS dt
         FROM (SELECT 0 AS a UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) a
       ) dates
       LEFT JOIN transactions t ON DATE(t.tx_date) = dates.dt AND t.status != 'CANCELLED'
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       GROUP BY dates.dt
       ORDER BY dates.dt ASC`
    );

    // 10. Kỳ kiểm kê mới nhất
    const [latestAudits] = await pool.query(
      `SELECT id, code, name, audit_date, status, total_system_qty, total_actual_qty, total_diff_qty, created_at
       FROM inventory_audits
       ORDER BY id DESC
       LIMIT 1`
    );

    // Format map tiện lợi cho frontend
    const todayMap = {};
    for (const row of todayTxs) todayMap[row.tx_type] = Number(row.total_units);

    const monthMap = {};
    for (const row of monthTxs) monthMap[row.tx_type] = Number(row.total_units);

    res.json({
      stockStats: {
        total_units: Number(stockStats?.total_units || 0),
        total_volume_ml: Number(stockStats?.total_volume_ml || 0),
        expired_units: Number(stockStats?.expired_units || 0),
        warning_units: Number(stockStats?.warning_units || 0),
        safe_units: Number(stockStats?.safe_units || 0),
        warning_days: warningDays,
      },
      activity: {
        today_import: todayMap.IMPORT || 0,
        today_export: todayMap.EXPORT || 0,
        month_import: monthMap.IMPORT || 0,
        month_export: monthMap.EXPORT || 0,
        pending_lend_qty: Math.max(0, Number(lendStats?.pending_lend_qty || 0)),
        pending_borrow_qty: Math.max(0, Number(lendStats?.pending_borrow_qty || 0)),
        pending_cancel_count: Number(cancelStats?.pending_cancel_count || 0),
      },
      groupDistribution,
      productDistribution,
      expiringLots,
      trend7Days,
      latestAudit: latestAudits[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
