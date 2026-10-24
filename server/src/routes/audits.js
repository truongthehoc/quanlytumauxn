const express = require('express');
const { getPool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { logActivity } = require('../logger');

const router = express.Router();

function generateAuditCode() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `KK-${ymd}-${rand}`;
}

async function recalculateAuditSummary(pool, auditId) {
  const [items] = await pool.query(
    `SELECT system_qty, actual_qty, diff_qty, status FROM inventory_audit_items WHERE audit_id = ?`,
    [auditId]
  );

  let totalSystem = 0;
  let totalActual = 0;
  let matchedCount = 0;
  let excessCount = 0;
  let deficitCount = 0;
  let uncountedCount = 0;

  for (const it of items) {
    totalSystem += Number(it.system_qty) || 0;
    totalActual += Number(it.actual_qty) || 0;
    if (it.status === 'MATCHED') matchedCount++;
    else if (it.status === 'EXCESS') excessCount++;
    else if (it.status === 'DEFICIT') deficitCount++;
    else if (it.status === 'UNCOUNTED') uncountedCount++;
  }

  const totalDiff = totalActual - totalSystem;

  await pool.query(
    `UPDATE inventory_audits SET
      total_system_qty = ?,
      total_actual_qty = ?,
      total_diff_qty = ?,
      matched_count = ?,
      excess_count = ?,
      deficit_count = ?,
      uncounted_count = ?
    WHERE id = ?`,
    [totalSystem, totalActual, totalDiff, matchedCount, excessCount, deficitCount, uncountedCount, auditId]
  );
}

// 1. GET /api/audits - Danh sách các kỳ kiểm kê
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { search, status, from_date, to_date } = req.query;

    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('a.status = ?');
      params.push(status);
    }
    if (from_date) {
      conditions.push('a.audit_date >= ?');
      params.push(from_date);
    }
    if (to_date) {
      conditions.push('a.audit_date <= ?');
      params.push(to_date);
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push('(a.code LIKE ? OR a.name LIKE ? OR a.creator_name LIKE ?)');
      params.push(q, q, q);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT
        a.*,
        u.full_name as creator_full_name,
        cu.full_name as completer_full_name,
        (SELECT COUNT(*) FROM inventory_audit_items WHERE audit_id = a.id) as total_items_count
      FROM inventory_audits a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN users cu ON a.completed_by = cu.id
      ${whereClause}
      ORDER BY a.audit_date DESC, a.id DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('Lỗi lấy danh sách kỳ kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy danh sách kỳ kiểm kê: ' + err.message });
  }
});

// GET /api/audits/helpers/users - Danh sách người dùng để chọn ban kiểm kê
router.get('/helpers/users', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.phone, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.is_active = 1
       ORDER BY u.full_name ASC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi lấy danh sách người dùng: ' + err.message });
  }
});

// 2. GET /api/audits/:id - Chi tiết 1 kỳ kiểm kê kèm danh sách chi tiết
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const auditId = Number(req.params.id);

    const [audits] = await pool.query(
      `SELECT
        a.*,
        u.full_name as creator_full_name,
        cu.full_name as completer_full_name
      FROM inventory_audits a
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN users cu ON a.completed_by = cu.id
      WHERE a.id = ?`,
      [auditId]
    );

    if (audits.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê yêu cầu' });
    }

    const audit = audits[0];

    // Fetch items with optional filter
    const { search, status, blood_group } = req.query;
    const itemConds = ['audit_id = ?'];
    const itemParams = [auditId];

    if (status && status !== 'ALL') {
      itemConds.push('status = ?');
      itemParams.push(status);
    }
    if (blood_group && blood_group !== 'ALL') {
      itemConds.push('blood_group = ?');
      itemParams.push(blood_group);
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      itemConds.push('(blood_code LIKE ? OR product_name LIKE ? OR note LIKE ?)');
      itemParams.push(q, q, q);
    }

    const [items] = await pool.query(
      `SELECT * FROM inventory_audit_items
      WHERE ${itemConds.join(' AND ')}
      ORDER BY
        CASE WHEN status = 'DEFICIT' THEN 1 WHEN status = 'EXCESS' THEN 2 WHEN status = 'UNCOUNTED' THEN 3 ELSE 4 END,
        expiry_date ASC, blood_code ASC`,
      itemParams
    );

    res.json({
      audit,
      items,
    });
  } catch (err) {
    console.error('Lỗi lấy chi tiết kỳ kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi lấy chi tiết kỳ kiểm kê: ' + err.message });
  }
});

// 3. POST /api/audits - Tạo mới kỳ kiểm kê kho (Snapshot tồn kho hiện tại)
router.post('/', authenticate, requirePermission('audit.create'), async (req, res) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const { name, audit_date, committee, note, init_actual_mode } = req.body;

    if (!name || !name.trim()) {
      await conn.rollback();
      return res.status(400).json({ error: 'Vui lòng nhập tên kỳ kiểm kê!' });
    }

    const code = req.body.code && req.body.code.trim() ? req.body.code.trim().toUpperCase() : generateAuditCode();
    const finalAuditDate = audit_date || new Date().toISOString().slice(0, 10);
    const creatorName = req.user ? req.user.full_name : 'Quản trị viên';
    const creatorId = req.user ? req.user.id : null;

    // Snapshot current active inventory lots
    const [lots] = await conn.query(`
      SELECT
        l.id as lot_id,
        l.blood_code,
        l.collection_date,
        l.expiry_date,
        l.quantity,
        l.blood_group,
        l.rh_factor,
        l.blood_product_id,
        bp.name as product_name,
        l.volume_id,
        v.name as volume_name,
        l.unit_id,
        u.name as unit_name
      FROM inventory_lots l
      JOIN blood_products bp ON l.blood_product_id = bp.id
      JOIN volumes v ON l.volume_id = v.id
      JOIN units u ON l.unit_id = u.id
      WHERE l.quantity > 0
      ORDER BY l.expiry_date ASC, l.blood_code ASC
    `);

    let totalSystemQty = 0;
    let totalActualQty = 0;
    let matchedCount = 0;
    let deficitCount = 0;
    let uncountedCount = 0;

    const isMatchInit = init_actual_mode === 'SYSTEM';

    lots.forEach((lot) => {
      const sysQty = Number(lot.quantity) || 0;
      totalSystemQty += sysQty;
      if (isMatchInit) {
        totalActualQty += sysQty;
        matchedCount++;
      } else {
        uncountedCount++;
      }
    });

    const totalDiffQty = totalActualQty - totalSystemQty;

    // Insert inventory_audits
    const [insertResult] = await conn.query(
      `INSERT INTO inventory_audits (
        code, name, audit_date, status, committee, note,
        total_system_qty, total_actual_qty, total_diff_qty,
        matched_count, excess_count, deficit_count, uncounted_count,
        created_by, creator_name
      ) VALUES (?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        code,
        name.trim(),
        finalAuditDate,
        committee || '',
        note || '',
        totalSystemQty,
        totalActualQty,
        totalDiffQty,
        matchedCount,
        deficitCount,
        uncountedCount,
        creatorId,
        creatorName,
      ]
    );

    const auditId = insertResult.insertId;

    // Batch insert items if lots exist
    if (lots.length > 0) {
      const itemValues = lots.map((lot) => {
        const sysQty = Number(lot.quantity) || 0;
        const actQty = isMatchInit ? sysQty : 0;
        const diffQty = actQty - sysQty;
        const status = isMatchInit ? 'MATCHED' : 'UNCOUNTED';
        return [
          auditId,
          lot.lot_id,
          lot.blood_code,
          lot.blood_product_id,
          lot.product_name,
          lot.blood_group,
          lot.rh_factor,
          lot.volume_id,
          lot.volume_name,
          lot.unit_id,
          lot.unit_name,
          lot.collection_date || null,
          lot.expiry_date,
          sysQty,
          actQty,
          diffQty,
          status,
          '',
          isMatchInit ? new Date() : null,
        ];
      });

      await conn.query(
        `INSERT INTO inventory_audit_items (
          audit_id, lot_id, blood_code, blood_product_id, product_name,
          blood_group, rh_factor, volume_id, volume_name, unit_id, unit_name,
          collection_date, expiry_date, system_qty, actual_qty, diff_qty,
          status, note, counted_at
        ) VALUES ?`,
        [itemValues]
      );
    }

    await conn.commit();

    await logActivity({
      req,
      actionType: 'AUDIT_CREATE',
      actionCategory: 'AUDIT',
      actionName: `Khởi tạo kỳ kiểm kê ${code}`,
      description: `Khởi tạo kỳ kiểm kê "${name}" (${code}) với ${lots.length} túi máu cần kiểm đếm`,
      status: 'SUCCESS',
      metadata: { audit_id: auditId, code, name, total_items: lots.length },
    });

    const [createdRows] = await conn.query(`SELECT * FROM inventory_audits WHERE id = ?`, [auditId]);
    conn.release();

    res.status(201).json({
      success: true,
      audit: createdRows[0],
      total_items: lots.length,
      message: `Đã khởi tạo kỳ kiểm kê "${code}" thành công với ${lots.length} túi máu/lô tồn kho!`,
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Lỗi tạo kỳ kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi khi tạo kỳ kiểm kê: ' + err.message });
  }
});

// 4. POST /api/audits/:id/scan - Quét hoặc nhập nhanh mã túi máu ghi nhận kiểm đếm
router.post('/:id/scan', authenticate, requirePermission('audit.execute'), async (req, res) => {
  try {
    const pool = getPool();
    const auditId = Number(req.params.id);
    const { blood_code } = req.body;

    if (!blood_code || !blood_code.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập hoặc quét mã túi máu!' });
    }

    const cleanCode = blood_code.trim().toUpperCase();

    // Check audit status
    const [audits] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);
    if (audits.length === 0) return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê' });
    if (audits[0].status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Kỳ kiểm kê này đã kết thúc hoặc đã hủy, không thể quét thêm!' });
    }

    // Find item by blood_code
    const [items] = await pool.query(
      `SELECT * FROM inventory_audit_items WHERE audit_id = ? AND UPPER(blood_code) = ?`,
      [auditId, cleanCode]
    );

    if (items.length > 0) {
      const item = items[0];
      const newActual = Number(item.actual_qty) + 1;
      const newDiff = newActual - Number(item.system_qty);
      const newStatus = newDiff === 0 ? 'MATCHED' : newDiff > 0 ? 'EXCESS' : 'DEFICIT';

      await pool.query(
        `UPDATE inventory_audit_items SET
          actual_qty = ?,
          diff_qty = ?,
          status = ?,
          counted_at = NOW()
        WHERE id = ?`,
        [newActual, newDiff, newStatus, item.id]
      );

      await recalculateAuditSummary(pool, auditId);

      const [updatedItem] = await pool.query('SELECT * FROM inventory_audit_items WHERE id = ?', [item.id]);
      const [updatedAudit] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);

      return res.json({
        success: true,
        action: 'INCREMENTED',
        item: updatedItem[0],
        audit: updatedAudit[0],
        message: `Đã kiểm đếm túi [${cleanCode}]: Thực tế = ${newActual} (Sổ sách: ${item.system_qty})`,
      });
    }

    // If blood_code is not in snapshot, check if it's in inventory_lots
    const [lots] = await pool.query(
      `SELECT l.*, bp.name as product_name, v.name as volume_name, u.name as unit_name
       FROM inventory_lots l
       JOIN blood_products bp ON l.blood_product_id = bp.id
       JOIN volumes v ON l.volume_id = v.id
       JOIN units u ON l.unit_id = u.id
       WHERE UPPER(l.blood_code) = ?
       ORDER BY l.id DESC`,
      [cleanCode]
    );

    if (lots.length > 0) {
      const lot = lots[0];
      // Add as EXCESS item (discovered bag that wasn't in snapshot)
      const [ins] = await pool.query(
        `INSERT INTO inventory_audit_items (
          audit_id, lot_id, blood_code, blood_product_id, product_name,
          blood_group, rh_factor, volume_id, volume_name, unit_id, unit_name,
          collection_date, expiry_date, system_qty, actual_qty, diff_qty,
          status, note, counted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 1, 'EXCESS', 'Túi máu phát hiện thừa thực tế (sổ sách = 0)', NOW())`,
        [
          auditId,
          lot.id,
          lot.blood_code,
          lot.blood_product_id,
          lot.product_name,
          lot.blood_group,
          lot.rh_factor,
          lot.volume_id,
          lot.volume_name,
          lot.unit_id,
          lot.unit_name,
          lot.collection_date || null,
          lot.expiry_date,
        ]
      );

      await recalculateAuditSummary(pool, auditId);

      const [newItem] = await pool.query('SELECT * FROM inventory_audit_items WHERE id = ?', [ins.insertId]);
      const [updatedAudit] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);

      return res.json({
        success: true,
        action: 'ADDED_EXCESS',
        item: newItem[0],
        audit: updatedAudit[0],
        message: `Đã phát hiện và ghi nhận túi máu thừa [${cleanCode}] (${lot.product_name})!`,
      });
    }

    return res.status(404).json({
      error: `Không tìm thấy túi máu có mã "${cleanCode}" trong kỳ kiểm kê lẫn kho lưu trữ!`,
    });
  } catch (err) {
    console.error('Lỗi khi quét túi máu kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi quét kiểm kê: ' + err.message });
  }
});

// 5. PUT /api/audits/:id/items/:itemId - Cập nhật trực tiếp số lượng thực tế & ghi chú
router.put('/:id/items/:itemId', authenticate, requirePermission('audit.execute'), async (req, res) => {
  try {
    const pool = getPool();
    const auditId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { actual_qty, note } = req.body;

    const [audits] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);
    if (audits.length === 0) return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê' });
    if (audits[0].status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Kỳ kiểm kê này đã chốt hoặc đã hủy, không thể chỉnh sửa!' });
    }

    const [items] = await pool.query('SELECT * FROM inventory_audit_items WHERE id = ? AND audit_id = ?', [itemId, auditId]);
    if (items.length === 0) return res.status(404).json({ error: 'Không tìm thấy mục kiểm kê yêu cầu' });

    const item = items[0];
    const newActual = Math.max(0, parseInt(actual_qty, 10) || 0);
    const newDiff = newActual - Number(item.system_qty);
    const newStatus = newDiff === 0 ? 'MATCHED' : newDiff > 0 ? 'EXCESS' : 'DEFICIT';

    await pool.query(
      `UPDATE inventory_audit_items SET
        actual_qty = ?,
        diff_qty = ?,
        status = ?,
        note = ?,
        counted_at = NOW()
      WHERE id = ?`,
      [newActual, newDiff, newStatus, note !== undefined ? note : item.note, itemId]
    );

    await recalculateAuditSummary(pool, auditId);

    const [updatedItem] = await pool.query('SELECT * FROM inventory_audit_items WHERE id = ?', [itemId]);
    const [updatedAudit] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);

    res.json({
      success: true,
      item: updatedItem[0],
      audit: updatedAudit[0],
    });
  } catch (err) {
    console.error('Lỗi cập nhật mục kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi cập nhật mục kiểm kê: ' + err.message });
  }
});

// 6. POST /api/audits/:id/bulk-action - Thao tác hàng loạt (khớp toàn bộ hoặc đặt chưa kiểm = 0)
router.post('/:id/bulk-action', authenticate, requirePermission('audit.execute'), async (req, res) => {
  try {
    const pool = getPool();
    const auditId = Number(req.params.id);
    const { action } = req.body;

    const [audits] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);
    if (audits.length === 0) return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê' });
    if (audits[0].status !== 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Kỳ kiểm kê này đã chốt hoặc đã hủy!' });
    }

    if (action === 'MATCH_ALL_REMAINING') {
      // Đặt tất cả các mục UNCOUNTED bằng số lượng sổ sách
      await pool.query(
        `UPDATE inventory_audit_items SET
          actual_qty = system_qty,
          diff_qty = 0,
          status = 'MATCHED',
          counted_at = NOW()
        WHERE audit_id = ? AND status = 'UNCOUNTED'`,
        [auditId]
      );
    } else if (action === 'SET_UNCOUNTED_TO_ZERO') {
      // Đặt tất cả các mục UNCOUNTED = 0 (coi như thiếu)
      await pool.query(
        `UPDATE inventory_audit_items SET
          actual_qty = 0,
          diff_qty = -system_qty,
          status = CASE WHEN system_qty = 0 THEN 'MATCHED' ELSE 'DEFICIT' END,
          counted_at = NOW()
        WHERE audit_id = ? AND status = 'UNCOUNTED'`,
        [auditId]
      );
    } else {
      return res.status(400).json({ error: 'Hành động không hợp lệ' });
    }

    await recalculateAuditSummary(pool, auditId);
    const [updatedAudit] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);

    res.json({
      success: true,
      audit: updatedAudit[0],
      message: 'Đã cập nhật hàng loạt thành công!',
    });
  } catch (err) {
    console.error('Lỗi thao tác hàng loạt:', err);
    res.status(500).json({ error: 'Lỗi thao tác hàng loạt: ' + err.message });
  }
});

// 7. POST /api/audits/:id/complete - Chốt kỳ kiểm kê & Cân bằng tồn kho thực tế (nếu chọn)
router.post('/:id/complete', authenticate, requirePermission('audit.close'), async (req, res) => {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const auditId = Number(req.params.id);
    const { balance_inventory, note } = req.body;

    const [audits] = await conn.query('SELECT * FROM inventory_audits WHERE id = ? FOR UPDATE', [auditId]);
    if (audits.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê' });
    }

    const audit = audits[0];
    if (audit.status === 'COMPLETED') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'Kỳ kiểm kê này đã được chốt hoàn tất trước đó!' });
    }

    // If balance_inventory is requested: Update inventory_lots.quantity = actual_qty
    let balancedFlag = 0;
    if (balance_inventory) {
      const [items] = await conn.query('SELECT * FROM inventory_audit_items WHERE audit_id = ?', [auditId]);

      for (const item of items) {
        if (item.diff_qty !== 0) {
          await conn.query('UPDATE inventory_lots SET quantity = ? WHERE id = ?', [
            item.actual_qty,
            item.lot_id,
          ]);
        }
      }
      balancedFlag = 1;
    }

    const completerName = req.user ? req.user.full_name : 'Quản trị viên';
    const completerId = req.user ? req.user.id : null;

    await conn.query(
      `UPDATE inventory_audits SET
        status = 'COMPLETED',
        is_balanced = ?,
        balanced_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
        completed_by = ?,
        completer_name = ?,
        completed_at = NOW(),
        note = CASE WHEN ? IS NOT NULL AND ? != '' THEN CONCAT(COALESCE(note, ''), '\n', ?) ELSE note END
      WHERE id = ?`,
      [balancedFlag, balancedFlag, completerId, completerName, note, note, note, auditId]
    );

    await conn.commit();
    conn.release();

    await logActivity({
      req,
      actionType: 'AUDIT_COMPLETE',
      actionCategory: 'AUDIT',
      actionName: `Chốt kỳ kiểm kê ${audit.code}`,
      description: `Đã chốt kỳ kiểm kê "${audit.name}" (${audit.code}) ${balancedFlag ? 'và CÂN BẰNG tồn kho' : ''}`,
      status: 'SUCCESS',
      metadata: { audit_id: auditId, code: audit.code, is_balanced: balancedFlag },
    });

    const pool = getPool();
    await recalculateAuditSummary(pool, auditId);
    const [finalAudit] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);

    res.json({
      success: true,
      audit: finalAudit[0],
      message: balancedFlag
        ? 'Đã chốt kỳ kiểm kê và tự động CÂN BẰNG kho lưu trữ theo số lượng thực tế!'
        : 'Đã chốt kỳ kiểm kê thành công (Lưu kết quả kiểm kê, không thay đổi tồn kho)!',
    });
  } catch (err) {
    await conn.rollback();
    conn.release();
    console.error('Lỗi chốt kỳ kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi khi chốt kỳ kiểm kê: ' + err.message });
  }
});

// 8. POST /api/audits/:id/cancel - Hủy kỳ kiểm kê
router.post('/:id/cancel', authenticate, requirePermission('audit.close'), async (req, res) => {
  try {
    const pool = getPool();
    const auditId = Number(req.params.id);

    const [audits] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);
    if (audits.length === 0) return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê' });
    if (audits[0].status === 'COMPLETED') {
      return res.status(400).json({ error: 'Kỳ kiểm kê đã hoàn tất, không thể hủy!' });
    }

    await pool.query(`UPDATE inventory_audits SET status = 'CANCELLED' WHERE id = ?`, [auditId]);

    res.json({
      success: true,
      message: 'Đã hủy kỳ kiểm kê!',
    });
  } catch (err) {
    console.error('Lỗi hủy kỳ kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi hủy kỳ kiểm kê: ' + err.message });
  }
});

// 9. DELETE /api/audits/:id - Xóa kỳ kiểm kê (chỉ khi chưa hoàn tất hoặc admin)
router.delete('/:id', authenticate, requirePermission('audit.delete'), async (req, res) => {
  try {
    const pool = getPool();
    const auditId = Number(req.params.id);

    const [audits] = await pool.query('SELECT * FROM inventory_audits WHERE id = ?', [auditId]);
    if (audits.length === 0) return res.status(404).json({ error: 'Không tìm thấy kỳ kiểm kê' });

    if (audits[0].status === 'COMPLETED' && req.user.role_code !== 'ADMIN') {
      return res.status(403).json({ error: 'Chỉ Quản trị viên mới có quyền xóa kỳ kiểm kê đã hoàn tất!' });
    }

    await pool.query('DELETE FROM inventory_audits WHERE id = ?', [auditId]);

    res.json({
      success: true,
      message: 'Đã xóa kỳ kiểm kê thành công!',
    });
  } catch (err) {
    console.error('Lỗi xóa kỳ kiểm kê:', err);
    res.status(500).json({ error: 'Lỗi xóa kỳ kiểm kê: ' + err.message });
  }
});

module.exports = router;
