const express = require('express');
const { getPool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get inventory lots + dashboard/summary stats
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { includeZero } = req.query;

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

    const whereClause = includeZero === 'true' ? '' : 'WHERE il.quantity > 0';

    const [lots] = await pool.query(
      `SELECT 
         il.id,
         il.blood_code,
         il.collection_date,
         il.blood_product_id,
         il.blood_group,
         il.rh_factor,
         il.volume_id,
         il.unit_id,
         il.expiry_date,
         il.quantity,
         il.updated_at,
         DATEDIFF(il.expiry_date, CURDATE()) AS days_remaining,
         bp.code AS product_code,
         bp.name AS product_name,
         bp.name AS product_group,
         v.code AS volume_code,
         v.name AS volume_name,
         v.volume_ml,
         u.code AS unit_code,
         u.name AS unit_name
       FROM inventory_lots il
       JOIN blood_products bp ON il.blood_product_id = bp.id
       JOIN volumes v ON il.volume_id = v.id
       JOIN units u ON il.unit_id = u.id
       ${whereClause}
       ORDER BY il.expiry_date ASC, il.blood_group ASC, il.rh_factor ASC`
    );

    const enrichedLots = lots.map((lot) => {
      let expiry_status = 'SAFE';
      if (lot.days_remaining < 0) {
        expiry_status = 'EXPIRED';
      } else if (lot.days_remaining <= warningDays) {
        expiry_status = 'WARNING';
      }
      return {
        ...lot,
        expiry_status,
      };
    });

    // Summary by blood group (ABO + Rh)
    const bloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const byBloodType = {};
    for (const bt of bloodTypes) {
      byBloodType[bt] = {
        blood_type: bt,
        total_quantity: 0,
        safe_quantity: 0,
        warning_quantity: 0,
        expired_quantity: 0,
        lot_count: 0,
      };
    }

    let totalUnits = 0;
    let totalVolumeMl = 0;
    let expiredUnits = 0;
    let warningUnits = 0;
    let safeUnits = 0;

    for (const lot of enrichedLots) {
      if (lot.quantity <= 0) continue;
      const bt = `${lot.blood_group}${lot.rh_factor}`;
      totalUnits += lot.quantity;
      totalVolumeMl += lot.quantity * (lot.volume_ml || 0);

      if (byBloodType[bt]) {
        byBloodType[bt].total_quantity += lot.quantity;
        byBloodType[bt].lot_count += 1;
      }

      if (lot.expiry_status === 'EXPIRED') {
        expiredUnits += lot.quantity;
        if (byBloodType[bt]) byBloodType[bt].expired_quantity += lot.quantity;
      } else if (lot.expiry_status === 'WARNING') {
        warningUnits += lot.quantity;
        if (byBloodType[bt]) byBloodType[bt].warning_quantity += lot.quantity;
      } else {
        safeUnits += lot.quantity;
        if (byBloodType[bt]) byBloodType[bt].safe_quantity += lot.quantity;
      }
    }

    // Pending Borrow / Lend stats
    const [borrowLendStats] = await pool.query(`
      SELECT 
        t.tx_type,
        COUNT(DISTINCT t.id) AS slip_count,
        SUM(ti.quantity - ti.returned_quantity) AS remaining_units
      FROM transactions t
      JOIN transaction_items ti ON ti.transaction_id = t.id
      WHERE t.tx_type IN ('LEND', 'BORROW') AND t.return_status IN ('PENDING', 'PARTIAL')
      GROUP BY t.tx_type
    `);

    let pendingLendUnits = 0;
    let pendingBorrowUnits = 0;
    for (const row of borrowLendStats) {
      if (row.tx_type === 'LEND') pendingLendUnits = Number(row.remaining_units || 0);
      if (row.tx_type === 'BORROW') pendingBorrowUnits = Number(row.remaining_units || 0);
    }

    res.json({
      warningDays,
      summary: {
        totalUnits,
        totalVolumeMl,
        safeUnits,
        warningUnits,
        expiredUnits,
        pendingLendUnits,
        pendingBorrowUnits,
      },
      byBloodType: Object.values(byBloodType),
      lots: enrichedLots,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global Search toàn hệ thống (túi máu, phiếu giao dịch, kỳ kiểm kê)
router.get('/global-search', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const q = req.query.q ? req.query.q.trim() : '';
    if (!q || q.length < 1) {
      return res.json({ lots: [], transactions: [], audits: [] });
    }

    const searchLike = `%${q}%`;

    // 1. Search inventory lots (túi máu trong kho)
    const [lots] = await pool.query(
      `SELECT 
        il.id, il.blood_code, il.blood_group, il.rh_factor, il.expiry_date, il.quantity,
        bp.name as product_name, v.name as volume_name, v.volume_ml, u.name as unit_name,
        DATEDIFF(il.expiry_date, CURDATE()) as days_remaining
      FROM inventory_lots il
      JOIN blood_products bp ON il.blood_product_id = bp.id
      JOIN volumes v ON il.volume_id = v.id
      JOIN units u ON il.unit_id = u.id
      WHERE il.blood_code LIKE ?
         OR bp.name LIKE ?
         OR CONCAT(il.blood_group, il.rh_factor) LIKE ?
      ORDER BY il.quantity DESC, il.expiry_date ASC
      LIMIT 6`,
      [searchLike, searchLike, searchLike]
    );

    // 2. Search transactions (phiếu nhập, xuất, mượn)
    const [transactions] = await pool.query(
      `SELECT 
        t.id, t.code, t.tx_type, t.tx_date, t.department_info, t.person_name, t.status,
        u.full_name as creator_name,
        p.name as partner_name,
        (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id) as item_count,
        (SELECT COALESCE(SUM(ti.quantity), 0) FROM transaction_items ti WHERE ti.transaction_id = t.id) as total_qty
      FROM transactions t
      LEFT JOIN partners p ON t.partner_id = p.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.code LIKE ?
         OR t.department_info LIKE ?
         OR t.person_name LIKE ?
         OR p.name LIKE ?
         OR u.full_name LIKE ?
      ORDER BY t.id DESC
      LIMIT 6`,
      [searchLike, searchLike, searchLike, searchLike, searchLike]
    );

    // 3. Search inventory audits (kỳ kiểm kê)
    const [audits] = await pool.query(
      `SELECT id, code, name, audit_date, status, total_system_qty, total_actual_qty, total_diff_qty
      FROM inventory_audits
      WHERE code LIKE ? OR name LIKE ?
      ORDER BY id DESC
      LIMIT 5`,
      [searchLike, searchLike]
    );

    res.json({
      lots,
      transactions,
      audits,
    });
  } catch (err) {
    console.error('Lỗi global search:', err);
    res.status(500).json({ error: err.message });
  }
});

// Adjust or delete an expired/damaged lot quantity
router.post('/adjust', authenticate, requirePermission('inventory.adjust'), async (req, res) => {
  try {
    const { lot_id, new_quantity, reason } = req.body;
    if (lot_id === undefined || new_quantity === undefined || Number(new_quantity) < 0) {
      return res.status(400).json({ error: 'Số lượng điều chỉnh không hợp lệ' });
    }
    const pool = getPool();
    await pool.query(
      `UPDATE inventory_lots SET quantity = ? WHERE id = ?`,
      [Number(new_quantity), Number(lot_id)]
    );
    res.json({ message: 'Đã cập nhật số lượng lô chế phẩm thành công', reason });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
