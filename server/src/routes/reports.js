const express = require('express');
const { getPool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.get('/summary', authenticate, requirePermission('reports.view'), async (req, res) => {
  try {
    const pool = getPool();
    const { from_date, to_date } = req.query;

    const dateFilter = [];
    const params = [];
    if (from_date) {
      dateFilter.push(`DATE(t.tx_date) >= ?`);
      params.push(from_date);
    }
    if (to_date) {
      dateFilter.push(`DATE(t.tx_date) <= ?`);
      params.push(to_date);
    }
    const txDateCondition = dateFilter.length ? `AND ${dateFilter.join(' AND ')}` : '';

    // 1. Báo cáo Nhập - Xuất - Mượn - Cho mượn theo Loại chế phẩm + Nhóm máu ABO/Rh
    const [txSummary] = await pool.query(
      `SELECT 
         ti.blood_product_id,
         ti.blood_group,
         ti.rh_factor,
         COALESCE(SUM(CASE WHEN t.tx_type = 'IMPORT' THEN ti.quantity ELSE 0 END), 0) AS imported_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'EXPORT' THEN ti.quantity ELSE 0 END), 0) AS exported_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'LEND' THEN ti.quantity ELSE 0 END), 0) AS lent_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'BORROW' THEN ti.quantity ELSE 0 END), 0) AS borrowed_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'RETURN_LEND' THEN ti.quantity ELSE 0 END), 0) AS return_lent_qty,
         COALESCE(SUM(CASE WHEN t.tx_type = 'RETURN_BORROW' THEN ti.quantity ELSE 0 END), 0) AS return_borrowed_qty
       FROM transaction_items ti
       JOIN transactions t ON ti.transaction_id = t.id AND t.status != 'CANCELLED' ${txDateCondition}
       GROUP BY ti.blood_product_id, ti.blood_group, ti.rh_factor`,
      params
    );

    const [currentStocks] = await pool.query(
      `SELECT 
         blood_product_id,
         blood_group,
         rh_factor,
         COALESCE(SUM(quantity), 0) AS current_stock,
         COALESCE(SUM(CASE WHEN expiry_date < CURDATE() THEN quantity ELSE 0 END), 0) AS expired_stock
       FROM inventory_lots
       GROUP BY blood_product_id, blood_group, rh_factor`
    );

    const [products] = await pool.query('SELECT * FROM blood_products');
    const prodMap = {};
    for (const p of products) prodMap[p.id] = p;

    const combinedMap = {};
    for (const s of currentStocks) {
      const key = `${s.blood_product_id}_${s.blood_group}_${s.rh_factor}`;
      const bp = prodMap[s.blood_product_id] || {};
      combinedMap[key] = {
        blood_product_id: key,
        product_code: bp.code || '',
        product_name: bp.name || '',
        product_group: bp.name || '',
        blood_group: s.blood_group,
        rh_factor: s.rh_factor,
        imported_qty: 0,
        exported_qty: 0,
        lent_qty: 0,
        borrowed_qty: 0,
        return_lent_qty: 0,
        return_borrowed_qty: 0,
        current_stock: Number(s.current_stock),
        expired_stock: Number(s.expired_stock),
      };
    }

    for (const tx of txSummary) {
      const key = `${tx.blood_product_id}_${tx.blood_group}_${tx.rh_factor}`;
      const bp = prodMap[tx.blood_product_id] || {};
      if (!combinedMap[key]) {
        combinedMap[key] = {
          blood_product_id: key,
          product_code: bp.code || '',
          product_name: bp.name || '',
          product_group: bp.name || '',
          blood_group: tx.blood_group,
          rh_factor: tx.rh_factor,
          current_stock: 0,
          expired_stock: 0,
        };
      }
      combinedMap[key].imported_qty = Number(tx.imported_qty);
      combinedMap[key].exported_qty = Number(tx.exported_qty);
      combinedMap[key].lent_qty = Number(tx.lent_qty);
      combinedMap[key].borrowed_qty = Number(tx.borrowed_qty);
      combinedMap[key].return_lent_qty = Number(tx.return_lent_qty);
      combinedMap[key].return_borrowed_qty = Number(tx.return_borrowed_qty);
    }

    const movementReport = Object.values(combinedMap);

    // 2. Báo cáo Công nợ Mượn / Cho mượn theo Đơn vị đối tác
    const [partnerBorrowLend] = await pool.query(
      `SELECT 
         p.id AS partner_id,
         p.code AS partner_code,
         p.name AS partner_name,
         p.partner_type,
         p.phone,
         COALESCE(SUM(CASE WHEN t.tx_type = 'LEND' THEN ti.quantity ELSE 0 END), 0) AS total_lent,
         COALESCE(SUM(CASE WHEN t.tx_type = 'LEND' THEN ti.returned_quantity ELSE 0 END), 0) AS lent_returned,
         COALESCE(SUM(CASE WHEN t.tx_type = 'LEND' THEN (ti.quantity - ti.returned_quantity) ELSE 0 END), 0) AS lent_remaining,
         COALESCE(SUM(CASE WHEN t.tx_type = 'BORROW' THEN ti.quantity ELSE 0 END), 0) AS total_borrowed,
         COALESCE(SUM(CASE WHEN t.tx_type = 'BORROW' THEN ti.returned_quantity ELSE 0 END), 0) AS borrowed_returned,
         COALESCE(SUM(CASE WHEN t.tx_type = 'BORROW' THEN (ti.quantity - ti.returned_quantity) ELSE 0 END), 0) AS borrowed_remaining
       FROM partners p
       LEFT JOIN transactions t ON t.partner_id = p.id AND t.tx_type IN ('LEND', 'BORROW') AND t.status != 'CANCELLED'
       LEFT JOIN transaction_items ti ON ti.transaction_id = t.id
       GROUP BY p.id
       ORDER BY p.name ASC`
    );

    res.json({
      movementReport,
      partnerBorrowLend: partnerBorrowLend.map((r) => ({
        ...r,
        total_lent: Number(r.total_lent),
        lent_returned: Number(r.lent_returned),
        lent_remaining: Number(r.lent_remaining),
        total_borrowed: Number(r.total_borrowed),
        borrowed_returned: Number(r.borrowed_returned),
        borrowed_remaining: Number(r.borrowed_remaining),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
