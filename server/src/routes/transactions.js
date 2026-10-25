const express = require('express');
const { getPool } = require('../db');
const { authenticate, requirePermission } = require('../middleware/auth');
const { logActivity } = require('../logger');

const router = express.Router();

function generateTxCode(prefix) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ym = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${ym}-${rand}`;
}

function formatPersonName(str = '') {
  return String(str)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1).toLocaleLowerCase('vi-VN'))
    .join(' ');
}

// Get list of transactions with items
router.get('/', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const { tx_type, return_status, status, partner_id, from_date, to_date, search } = req.query;

    const conditions = [];
    const params = [];

    if (tx_type) {
      const types = String(tx_type).split(',');
      conditions.push(`t.tx_type IN (${types.map(() => '?').join(',')})`);
      params.push(...types);
    }
    if (return_status) {
      const statuses = String(return_status).split(',');
      conditions.push(`t.return_status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (status) {
      const statuses = String(status).split(',');
      conditions.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
    if (partner_id) {
      conditions.push(`t.partner_id = ?`);
      params.push(Number(partner_id));
    }
    if (from_date) {
      conditions.push(`DATE(t.tx_date) >= ?`);
      params.push(from_date);
    }
    if (to_date) {
      conditions.push(`DATE(t.tx_date) <= ?`);
      params.push(to_date);
    }
    if (search) {
      conditions.push(`(t.code LIKE ? OR t.person_name LIKE ? OR t.department_info LIKE ? OR p.name LIKE ? OR t.note LIKE ? OR t.cancel_reason LIKE ?)`);
      const kw = `%${search.trim()}%`;
      params.push(kw, kw, kw, kw, kw, kw);
    }

    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [txs] = await pool.query(
      `SELECT 
         t.*,
         p.code AS partner_code,
         p.name AS partner_name,
         p.phone AS partner_phone,
         p.address AS partner_address,
         u.full_name AS creator_name,
         u_req.full_name AS cancel_requester_name,
         u_app.full_name AS cancel_approver_name,
         pt.code AS parent_tx_code
       FROM transactions t
       LEFT JOIN partners p ON t.partner_id = p.id
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users u_req ON t.cancel_requested_by = u_req.id
       LEFT JOIN users u_app ON t.cancel_approved_by = u_app.id
       LEFT JOIN transactions pt ON t.parent_tx_id = pt.id
       ${whereSql}
       ORDER BY t.tx_date DESC, t.id DESC
       LIMIT 300`,
      params
    );

    if (txs.length === 0) {
      return res.json([]);
    }

    const txIds = txs.map((t) => t.id);
    const [items] = await pool.query(
      `SELECT 
         ti.*,
         bp.code AS product_code,
         bp.name AS product_name,
         bp.name AS product_group,
         v.name AS volume_name,
         v.volume_ml,
         un.name AS unit_name
       FROM transaction_items ti
       JOIN blood_products bp ON ti.blood_product_id = bp.id
       JOIN volumes v ON ti.volume_id = v.id
       JOIN units un ON ti.unit_id = un.id
       WHERE ti.transaction_id IN (${txIds.map(() => '?').join(',')})
       ORDER BY ti.id ASC`,
      txIds
    );

    const itemsByTx = {};
    for (const item of items) {
      if (!itemsByTx[item.transaction_id]) itemsByTx[item.transaction_id] = [];
      itemsByTx[item.transaction_id].push(item);
    }

    const result = txs.map((t) => {
      const txItems = itemsByTx[t.id] || [];
      const total_quantity = txItems.reduce((s, i) => s + Number(i.quantity || 0), 0);
      const total_returned = txItems.reduce((s, i) => s + Number(i.returned_quantity || 0), 0);
      return {
        ...t,
        total_quantity,
        total_returned,
        items: txItems,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lấy tóm tắt số lượng phiếu đang chờ duyệt hủy (cho người có quyền duyệt)
router.get('/pending-summary', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT tx_type, COUNT(*) as cnt 
       FROM transactions 
       WHERE status = 'PENDING_CANCEL' 
       GROUP BY tx_type`
    );
    let importPending = 0;
    let exportPending = 0;
    for (const r of rows) {
      if (r.tx_type === 'IMPORT') importPending = Number(r.cnt || 0);
      if (r.tx_type === 'EXPORT') exportPending = Number(r.cnt || 0);
    }
    res.json({
      totalPending: importPending + exportPending,
      importPending,
      exportPending,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single transaction detail (for printing or viewing)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [txs] = await pool.query(
      `SELECT 
         t.*,
         p.code AS partner_code,
         p.name AS partner_name,
         p.phone AS partner_phone,
         p.address AS partner_address,
         u.full_name AS creator_name,
         u_req.full_name AS cancel_requester_name,
         u_app.full_name AS cancel_approver_name,
         pt.code AS parent_tx_code
       FROM transactions t
       LEFT JOIN partners p ON t.partner_id = p.id
       LEFT JOIN users u ON t.created_by = u.id
       LEFT JOIN users u_req ON t.cancel_requested_by = u_req.id
       LEFT JOIN users u_app ON t.cancel_approved_by = u_app.id
       LEFT JOIN transactions pt ON t.parent_tx_id = pt.id
       WHERE t.id = ?`,
      [req.params.id]
    );
    if (!txs.length) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu giao dịch' });
    }
    const [items] = await pool.query(
      `SELECT 
         ti.*,
         bp.code AS product_code,
         bp.name AS product_name,
         bp.name AS product_group,
         v.name AS volume_name,
         v.volume_ml,
         un.name AS unit_name
       FROM transaction_items ti
       JOIN blood_products bp ON ti.blood_product_id = bp.id
       JOIN volumes v ON ti.volume_id = v.id
       JOIN units un ON ti.unit_id = un.id
       WHERE ti.transaction_id = ?`,
      [req.params.id]
    );
    const [returnHistory] = await pool.query(
      `SELECT t.*, u.full_name AS creator_name
       FROM transactions t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.parent_tx_id = ?
       ORDER BY t.tx_date DESC`,
      [req.params.id]
    );

    res.json({
      ...txs[0],
      items,
      returnHistory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== 1. NHẬP CHẾ PHẨM MÁU VÀO KHO (IMPORT) ====================
router.post('/import', authenticate, requirePermission('import.create'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { partner_id, person_name, tx_date, note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Vui lòng nhập ít nhất 1 dòng chế phẩm máu' });
    }

    await conn.beginTransaction();

    const code = generateTxCode('NK');
    const [txRes] = await conn.query(
      `INSERT INTO transactions (code, tx_type, tx_date, partner_id, person_name, return_status, note, created_by)
       VALUES (?, 'IMPORT', ?, ?, ?, 'NONE', ?, ?)`,
      [
        code,
        tx_date || new Date(),
        partner_id ? Number(partner_id) : null,
        formatPersonName(person_name),
        note || '',
        req.user.id,
      ]
    );

    const txId = txRes.insertId;

    for (const item of items) {
      const qty = Number(item.quantity);
      const bloodGroup = item.blood_group || 'O';
      const rhFactor = item.rh_factor || '+';
      const rawBloodCode = item.blood_code ? String(item.blood_code).trim().toUpperCase() : null;
      const bloodCode = rawBloodCode || null;

      let volumeId = item.volume_id ? Number(item.volume_id) : null;
      if (!volumeId) {
        const [bpVol] = await conn.query('SELECT volume_ml FROM blood_products WHERE id = ?', [Number(item.blood_product_id)]);
        const volMl = bpVol[0]?.volume_ml || 250;
        let [vRow] = await conn.query('SELECT id FROM volumes WHERE volume_ml = ? LIMIT 1', [volMl]);
        if (vRow.length > 0) {
          volumeId = vRow[0].id;
        } else {
          const [ins] = await conn.query('INSERT INTO volumes (code, name, volume_ml, note) VALUES (?, ?, ?, ?)', [
            `VOL_${volMl}`, `${volMl}ml`, volMl, 'Tự động tạo theo loại chế phẩm'
          ]);
          volumeId = ins.insertId;
        }
      }

      if (!item.blood_product_id || !volumeId || !item.expiry_date || qty <= 0) {
        throw new Error('Thông tin Loại chế phẩm, Nhóm máu ABO/Rh, Thể tích, Hạn sử dụng và Số lượng (>0) là bắt buộc');
      }

      if (bloodCode) {
        // Kiểm tra tính duy nhất: mỗi bịch chỉ có 1 mã máu trong kho
        const [existing] = await conn.query(
          'SELECT id FROM inventory_lots WHERE blood_code = ? AND quantity > 0',
          [bloodCode]
        );
        if (existing.length > 0) {
          throw new Error(`Mã máu "${bloodCode}" đã tồn tại trong kho (chưa xuất)!`);
        }

        // Dọn dẹp bản ghi cũ nếu túi máu từng bị hủy hoặc số lượng <= 0
        await conn.query('DELETE FROM inventory_lots WHERE blood_code = ? AND quantity <= 0', [bloodCode]);
      }

      // Look up default unit_id from blood_products if not provided
      const [bpRows] = await conn.query('SELECT unit_id FROM blood_products WHERE id = ?', [
        Number(item.blood_product_id),
      ]);
      const unitId = Number(item.unit_id || bpRows[0]?.unit_id || 1);

      const collectionDate = item.collection_date ? String(item.collection_date).slice(0, 10) : null;

      // Insert transaction item
      await conn.query(
        `INSERT INTO transaction_items (transaction_id, blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          bloodCode,
          collectionDate,
          Number(item.blood_product_id),
          bloodGroup,
          rhFactor,
          volumeId,
          unitId,
          item.expiry_date,
          qty,
          item.note || '',
        ]
      );

      // Upsert into inventory_lots (lưu kèm mã máu và ngày lấy máu của bịch)
      await conn.query(
        `INSERT INTO inventory_lots (blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           quantity = quantity + VALUES(quantity), 
           collection_date = VALUES(collection_date),
           expiry_date = VALUES(expiry_date)`,
        [
          bloodCode,
          collectionDate,
          Number(item.blood_product_id),
          bloodGroup,
          rhFactor,
          volumeId,
          unitId,
          item.expiry_date,
          qty,
        ]
      );
    }

    await conn.commit();

    await logActivity({
      req,
      actionType: 'IMPORT',
      actionCategory: 'TRANSACTION',
      actionName: `Tạo phiếu nhập máu ${code}`,
      description: `Nhập ${items.length} túi máu vào kho theo phiếu ${code}`,
      status: 'SUCCESS',
      metadata: { tx_id: txId, code, count: items.length },
    });

    res.json({ id: txId, code, message: 'Nhập chế phẩm máu vào kho thành công' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ==================== 2. XUẤT CHẾ PHẨM MÁU (EXPORT) ====================
router.post('/export', authenticate, requirePermission('export.create'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { person_name, department_info, tx_date, note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn chế phẩm máu cần xuất' });
    }

    await conn.beginTransaction();

    const code = generateTxCode('XK');
    const [txRes] = await conn.query(
      `INSERT INTO transactions (code, tx_type, tx_date, person_name, department_info, return_status, note, created_by)
       VALUES (?, 'EXPORT', ?, ?, ?, 'NONE', ?, ?)`,
      [
        code,
        tx_date || new Date(),
        formatPersonName(person_name),
        department_info || '',
        note || '',
        req.user.id,
      ]
    );
    const txId = txRes.insertId;

    for (const item of items) {
      const qty = Number(item.quantity || 1);
      if (qty <= 0) {
        throw new Error('Số lượng xuất phải lớn hơn 0');
      }

      const [lotRows] = await conn.query(
        `SELECT il.*, bp.name as product_name FROM inventory_lots il
         JOIN blood_products bp ON il.blood_product_id = bp.id
         WHERE il.id = ? FOR UPDATE`,
        [Number(item.lot_id)]
      );
      const lot = lotRows[0];

      if (!lot) {
        throw new Error('Không tìm thấy lô chế phẩm máu phù hợp để xuất');
      }
      if (lot.quantity < qty) {
        throw new Error(`Chế phẩm "${lot.product_name}" [${lot.blood_group}${lot.rh_factor}] (HSD: ${lot.expiry_date}) chỉ còn tồn ${lot.quantity}, không đủ xuất ${qty}`);
      }

      await conn.query(
        `UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?`,
        [qty, lot.id]
      );

      await conn.query(
        `INSERT INTO transaction_items (transaction_id, blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txId,
          lot.blood_code || null,
          lot.collection_date || null,
          lot.blood_product_id,
          lot.blood_group,
          lot.rh_factor,
          lot.volume_id,
          lot.unit_id,
          lot.expiry_date,
          qty,
          item.note || '',
        ]
      );
    }

    await conn.commit();

    await logActivity({
      req,
      actionType: 'EXPORT',
      actionCategory: 'TRANSACTION',
      actionName: `Tạo phiếu xuất máu ${code}`,
      description: `Xuất ${items.length} túi máu cho "${person_name || 'khoa phòng'}" (${department_info || ''}) theo phiếu ${code}`,
      status: 'SUCCESS',
      metadata: { tx_id: txId, code, count: items.length, person: person_name, department: department_info },
    });

    res.json({ id: txId, code, message: 'Xuất chế phẩm máu thành công' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ==================== 3. CHO MƯỢN CHẾ PHẨM MÁU (LEND) ====================
router.post('/lend', authenticate, requirePermission('borrow_lend.create'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { partner_id, person_name, due_date, tx_date, note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 chế phẩm máu cho mượn' });
    }

    await conn.beginTransaction();

    const code = generateTxCode('CM');
    const [txRes] = await conn.query(
      `INSERT INTO transactions (code, tx_type, tx_date, partner_id, person_name, return_status, due_date, note, created_by)
       VALUES (?, 'LEND', ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [
        code,
        tx_date || new Date(),
        partner_id ? Number(partner_id) : null,
        person_name ? formatPersonName(person_name) : '',
        due_date || null,
        note || '',
        req.user.id,
      ]
    );
    const txId = txRes.insertId;

    for (const item of items) {
      const qty = Number(item.quantity || 1);
      if (!item.lot_id || qty <= 0) {
        throw new Error('Vui lòng chọn lô chế phẩm trong kho và số lượng cho mượn hợp lệ');
      }

      const [lotRows] = await conn.query(
        `SELECT il.*, bp.name as product_name FROM inventory_lots il
         JOIN blood_products bp ON il.blood_product_id = bp.id
         WHERE il.id = ? FOR UPDATE`,
        [Number(item.lot_id)]
      );
      const lot = lotRows[0];
      if (!lot || lot.quantity < qty) {
        throw new Error(`Tồn kho không đủ để cho mượn (${lot ? lot.product_name : ''})`);
      }

      await conn.query(
        `UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?`,
        [qty, lot.id]
      );

      await conn.query(
        `INSERT INTO transaction_items (transaction_id, blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity, returned_quantity, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          txId,
          lot.blood_code || null,
          lot.collection_date || null,
          lot.blood_product_id,
          lot.blood_group,
          lot.rh_factor,
          lot.volume_id,
          lot.unit_id,
          lot.expiry_date,
          qty,
          item.note || '',
        ]
      );
    }

    await conn.commit();
    res.json({ id: txId, code, message: 'Tạo phiếu Cho mượn chế phẩm máu thành công' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ==================== 4. MƯỢN CHẾ PHẨM MÁU (BORROW) ====================
router.post('/borrow', authenticate, requirePermission('borrow_lend.create'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { partner_id, person_name, due_date, tx_date, note, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Vui lòng nhập ít nhất 1 chế phẩm máu mượn' });
    }

    await conn.beginTransaction();

    const code = generateTxCode('VM');
    const [txRes] = await conn.query(
      `INSERT INTO transactions (code, tx_type, tx_date, partner_id, person_name, return_status, due_date, note, created_by)
       VALUES (?, 'BORROW', ?, ?, ?, 'PENDING', ?, ?, ?)`,
      [
        code,
        tx_date || new Date(),
        partner_id ? Number(partner_id) : null,
        person_name ? formatPersonName(person_name) : '',
        due_date || null,
        note || '',
        req.user.id,
      ]
    );
    const txId = txRes.insertId;

    for (const item of items) {
      const qty = Number(item.quantity || 1);
      const bloodGroup = item.blood_group || 'O';
      const rhFactor = item.rh_factor || '+';

      let volumeId = item.volume_id ? Number(item.volume_id) : null;
      if (!volumeId) {
        const [bpVol] = await conn.query('SELECT volume_ml FROM blood_products WHERE id = ?', [Number(item.blood_product_id)]);
        const volMl = bpVol[0]?.volume_ml || 250;
        let [vRow] = await conn.query('SELECT id FROM volumes WHERE volume_ml = ? LIMIT 1', [volMl]);
        if (vRow.length > 0) {
          volumeId = vRow[0].id;
        } else {
          const [ins] = await conn.query('INSERT INTO volumes (code, name, volume_ml, note) VALUES (?, ?, ?, ?)', [
            `VOL_${volMl}`, `${volMl}ml`, volMl, 'Tự động tạo theo loại chế phẩm'
          ]);
          volumeId = ins.insertId;
        }
      }

      if (!item.blood_product_id || !volumeId || !item.expiry_date || qty <= 0) {
        throw new Error('Vui lòng nhập đầy đủ Loại chế phẩm, ABO/Rh, Thể tích, Hạn sử dụng và Số lượng mượn');
      }

      const [bpRows] = await conn.query('SELECT unit_id FROM blood_products WHERE id = ?', [
        Number(item.blood_product_id),
      ]);
      const unitId = Number(item.unit_id || bpRows[0]?.unit_id || 1);

      const rawBloodCode = item.blood_code ? String(item.blood_code).trim().toUpperCase() : null;
      const bloodCode = rawBloodCode || null;
      const collectionDate = item.collection_date ? String(item.collection_date).slice(0, 10) : null;

      await conn.query(
        `INSERT INTO transaction_items (transaction_id, blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity, returned_quantity, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          txId,
          bloodCode,
          collectionDate,
          Number(item.blood_product_id),
          bloodGroup,
          rhFactor,
          volumeId,
          unitId,
          item.expiry_date,
          qty,
          item.note || '',
        ]
      );

      // Cộng vào tồn kho theo lô (lưu kèm mã máu nếu có)
      await conn.query(
        `INSERT INTO inventory_lots (blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), collection_date = COALESCE(VALUES(collection_date), collection_date)`,
        [
          bloodCode,
          collectionDate,
          Number(item.blood_product_id),
          bloodGroup,
          rhFactor,
          volumeId,
          unitId,
          item.expiry_date,
          qty,
        ]
      );
    }

    await conn.commit();
    res.json({ id: txId, code, message: 'Tạo phiếu Mượn chế phẩm máu và nhập kho thành công' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ==================== 5. HOÀN TRẢ PHIẾU MƯỢN / CHO MƯỢN (RETURN) ====================
router.post('/:id/return', authenticate, requirePermission('borrow_lend.return'), async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const parentId = Number(req.params.id);
    const { person_name, note, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Vui lòng nhập số lượng hoàn trả' });
    }

    await conn.beginTransaction();

    const [parentRows] = await conn.query(
      `SELECT * FROM transactions WHERE id = ? FOR UPDATE`,
      [parentId]
    );
    if (!parentRows.length) {
      throw new Error('Không tìm thấy phiếu Mượn / Cho mượn gốc');
    }
    const parentTx = parentRows[0];
    if (!['LEND', 'BORROW'].includes(parentTx.tx_type)) {
      throw new Error('Chỉ có thể hoàn trả cho phiếu Mượn hoặc Cho mượn');
    }

    const returnTxType = parentTx.tx_type === 'LEND' ? 'RETURN_LEND' : 'RETURN_BORROW';
    const returnCode = generateTxCode('HT');

    const [retTxRes] = await conn.query(
      `INSERT INTO transactions (code, tx_type, tx_date, partner_id, person_name, parent_tx_id, return_status, note, created_by)
       VALUES (?, ?, NOW(), ?, ?, ?, 'COMPLETED', ?, ?)`,
      [
        returnCode,
        returnTxType,
        parentTx.partner_id,
        formatPersonName(person_name || parentTx.person_name || ''),
        parentId,
        note || `Hoàn trả cho phiếu ${parentTx.code}`,
        req.user.id,
      ]
    );
    const returnTxId = retTxRes.insertId;

    let anyReturned = false;

    for (const rItem of items) {
      const returnQty = Number(rItem.return_quantity || 0);
      if (returnQty <= 0) continue;
      anyReturned = true;

      const [origItemRows] = await conn.query(
        `SELECT * FROM transaction_items WHERE id = ? AND transaction_id = ? FOR UPDATE`,
        [Number(rItem.item_id), parentId]
      );
      if (!origItemRows.length) {
        throw new Error('Dòng chế phẩm hoàn trả không hợp lệ');
      }
      const origItem = origItemRows[0];
      const remaining = origItem.quantity - origItem.returned_quantity;
      if (returnQty > remaining) {
        throw new Error(`Số lượng trả (${returnQty}) vượt quá số lượng còn nợ (${remaining})`);
      }

      // Update returned_quantity on original item
      await conn.query(
        `UPDATE transaction_items SET returned_quantity = returned_quantity + ? WHERE id = ?`,
        [returnQty, origItem.id]
      );

      if (parentTx.tx_type === 'LEND') {
        const expDate = rItem.expiry_date || origItem.expiry_date;
        const colDate = origItem.collection_date || null;
        await conn.query(
          `INSERT INTO inventory_lots (blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), collection_date = COALESCE(VALUES(collection_date), collection_date)`,
          [
            origItem.blood_code || null,
            colDate,
            origItem.blood_product_id,
            origItem.blood_group,
            origItem.rh_factor,
            origItem.volume_id,
            origItem.unit_id,
            expDate,
            returnQty,
          ]
        );

        await conn.query(
          `INSERT INTO transaction_items (transaction_id, blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity, parent_item_id, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            returnTxId,
            origItem.blood_code || null,
            colDate,
            origItem.blood_product_id,
            origItem.blood_group,
            origItem.rh_factor,
            origItem.volume_id,
            origItem.unit_id,
            expDate,
            returnQty,
            origItem.id,
            rItem.note || 'Nhận hoàn trả máu cho mượn',
          ]
        );
      } else {
        // Khoa Xét nghiệm xuất máu trả lại cho đơn vị đã cho mượn (BORROW)
        const [lots] = await conn.query(
          `SELECT * FROM inventory_lots
           WHERE blood_product_id = ? AND blood_group = ? AND rh_factor = ? AND volume_id = ? AND quantity >= ?
           ORDER BY expiry_date ASC LIMIT 1 FOR UPDATE`,
          [
            origItem.blood_product_id,
            origItem.blood_group,
            origItem.rh_factor,
            origItem.volume_id,
            returnQty,
          ]
        );
        const targetLot = lots[0];

        if (!targetLot || targetLot.quantity < returnQty) {
          throw new Error('Tồn kho hiện tại không đủ chế phẩm cùng loại và nhóm máu để xuất hoàn trả cho đối tác');
        }

        await conn.query(
          `UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?`,
          [returnQty, targetLot.id]
        );

        await conn.query(
          `INSERT INTO transaction_items (transaction_id, blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity, parent_item_id, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            returnTxId,
            targetLot.blood_code || origItem.blood_code || null,
            targetLot.collection_date || origItem.collection_date || null,
            origItem.blood_product_id,
            origItem.blood_group,
            origItem.rh_factor,
            origItem.volume_id,
            origItem.unit_id,
            targetLot.expiry_date,
            returnQty,
            origItem.id,
            rItem.note || 'Xuất hoàn trả máu đã mượn',
          ]
        );
      }
    }

    if (!anyReturned) {
      throw new Error('Vui lòng nhập số lượng hoàn trả lớn hơn 0');
    }

    const [updatedItems] = await conn.query(
      `SELECT quantity, returned_quantity FROM transaction_items WHERE transaction_id = ?`,
      [parentId]
    );
    const totalQty = updatedItems.reduce((s, i) => s + i.quantity, 0);
    const totalRet = updatedItems.reduce((s, i) => s + i.returned_quantity, 0);

    let newStatus = 'PENDING';
    if (totalRet >= totalQty) {
      newStatus = 'COMPLETED';
    } else if (totalRet > 0) {
      newStatus = 'PARTIAL';
    }

    await conn.query(`UPDATE transactions SET return_status = ? WHERE id = ?`, [
      newStatus,
      parentId,
    ]);

    await conn.commit();
    res.json({
      returnTxId,
      returnCode,
      newStatus,
      message:
        newStatus === 'COMPLETED'
          ? 'Đã hoàn trả đầy đủ (Hoàn tất phiếu)'
          : 'Đã ghi nhận hoàn trả một phần',
    });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ==================== 5. HỦY PHIẾU (GỬI YÊU CẦU & DUYỆT HỦY) ====================

// 5.1 Gửi yêu cầu hủy phiếu (IMPORT hoặc EXPORT)
router.post('/:id/cancel-request', authenticate, async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do yêu cầu hủy phiếu' });
    }

    const [txRows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!txRows.length) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu giao dịch' });
    }
    const tx = txRows[0];

    const isImport = tx.tx_type === 'IMPORT';
    const isExport = tx.tx_type === 'EXPORT';
    if (!isImport && !isExport) {
      return res.status(400).json({ error: 'Chức năng yêu cầu hủy chỉ áp dụng cho Phiếu Nhập và Phiếu Xuất' });
    }

    const permNeeded = isImport ? 'import.cancel_request' : 'export.cancel_request';
    const altPerm = isImport ? 'import.delete' : 'export.delete';
    const userPerms = req.user.permissions || [];
    const userRole = req.user.role || req.user.role_code;
    const hasPerm = userRole === 'ADMIN' || userPerms.includes(permNeeded) || userPerms.includes(altPerm);

    if (!hasPerm) {
      return res.status(403).json({ error: 'Bạn không có quyền gửi yêu cầu hủy phiếu này' });
    }

    if (tx.status === 'PENDING_CANCEL') {
      return res.status(400).json({ error: 'Phiếu này đã được gửi yêu cầu hủy và đang chờ phê duyệt' });
    }
    if (tx.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Phiếu này đã bị hủy trước đó' });
    }

    await pool.query(
      `UPDATE transactions SET 
         status = 'PENDING_CANCEL', 
         cancel_reason = ?, 
         cancel_requested_by = ?, 
         cancel_requested_at = NOW(), 
         cancel_reject_reason = NULL 
       WHERE id = ?`,
      [reason.trim(), req.user.id, id]
    );

    await logActivity({
      req,
      actionType: 'CANCEL_REQUEST',
      actionCategory: 'TRANSACTION',
      actionName: `Yêu cầu hủy phiếu ${tx.code}`,
      description: `Gửi yêu cầu hủy phiếu ${tx.code}. Lý do: "${reason.trim()}"`,
      status: 'WARNING',
      metadata: { tx_id: tx.id, code: tx.code, reason: reason.trim() },
    });

    res.json({ message: 'Đã gửi yêu cầu hủy phiếu thành công. Đang chờ cấp quản lý phê duyệt.', status: 'PENDING_CANCEL' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5.2 Duyệt hủy phiếu (Hoàn nguyên tồn kho)
router.post('/:id/cancel-approve', authenticate, async (req, res) => {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;

    const [txRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!txRows.length) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu giao dịch' });
    }
    const tx = txRows[0];

    const isImport = tx.tx_type === 'IMPORT';
    const isExport = tx.tx_type === 'EXPORT';
    if (!isImport && !isExport) {
      return res.status(400).json({ error: 'Chức năng chỉ áp dụng cho Phiếu Nhập và Phiếu Xuất' });
    }

    const permNeeded = isImport ? 'import.cancel_approve' : 'export.cancel_approve';
    const userPerms = req.user.permissions || [];
    const userRole = req.user.role || req.user.role_code;
    const hasPerm = userRole === 'ADMIN' || userPerms.includes(permNeeded);

    if (!hasPerm) {
      return res.status(403).json({ error: 'Bạn không có quyền duyệt hủy phiếu này' });
    }

    if (tx.status !== 'PENDING_CANCEL') {
      return res.status(400).json({ error: `Phiếu hiện không ở trạng thái Chờ duyệt hủy (Trạng thái hiện tại: ${tx.status})` });
    }

    await conn.beginTransaction();

    // Lấy danh sách các dòng chế phẩm của phiếu
    const [items] = await conn.query(
      `SELECT ti.*, bp.name AS product_name 
       FROM transaction_items ti
       JOIN blood_products bp ON ti.blood_product_id = bp.id
       WHERE ti.transaction_id = ?`,
      [id]
    );

    if (isImport) {
      // HỦY PHIẾU NHẬP: Trừ trả lại số lượng đã nhập vào kho
      for (const it of items) {
        if (it.blood_code) {
          const [lotRows] = await conn.query(
            'SELECT * FROM inventory_lots WHERE blood_code = ? FOR UPDATE',
            [it.blood_code]
          );
          if (!lotRows.length || lotRows[0].quantity < it.quantity) {
            throw new Error(`Không thể duyệt hủy: Túi máu mã "${it.blood_code}" (${it.product_name}) đã được xuất hoặc sử dụng khỏi kho!`);
          }
          if (lotRows[0].quantity <= it.quantity) {
            await conn.query('DELETE FROM inventory_lots WHERE id = ?', [lotRows[0].id]);
          } else {
            await conn.query(
              'UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?',
              [it.quantity, lotRows[0].id]
            );
          }
        } else {
          // Khớp theo thông số lô
          const [lotRows] = await conn.query(
            `SELECT * FROM inventory_lots 
             WHERE blood_product_id = ? AND blood_group = ? AND rh_factor = ? AND volume_id = ? AND expiry_date = ? 
             FOR UPDATE`,
            [it.blood_product_id, it.blood_group, it.rh_factor, it.volume_id, it.expiry_date]
          );
          const totalStock = lotRows.reduce((sum, r) => sum + r.quantity, 0);
          if (totalStock < it.quantity) {
            throw new Error(`Không thể duyệt hủy: Tồn kho hiện tại của "${it.product_name}" (${totalStock}) không đủ để hoàn nguyên ${it.quantity} do đã bị xuất bớt!`);
          }
          let needed = it.quantity;
          for (const lr of lotRows) {
            if (needed <= 0) break;
            const deduct = Math.min(lr.quantity, needed);
            if (lr.quantity <= deduct) {
              await conn.query('DELETE FROM inventory_lots WHERE id = ?', [lr.id]);
            } else {
              await conn.query('UPDATE inventory_lots SET quantity = quantity - ? WHERE id = ?', [deduct, lr.id]);
            }
            needed -= deduct;
          }
        }
      }
    } else if (isExport) {
      // HỦY PHIẾU XUẤT: Hoàn trả lại số lượng vào kho
      for (const it of items) {
        if (it.blood_code) {
          const [lotRows] = await conn.query(
            'SELECT id FROM inventory_lots WHERE blood_code = ? FOR UPDATE',
            [it.blood_code]
          );
          if (lotRows.length > 0) {
            await conn.query('UPDATE inventory_lots SET quantity = quantity + ? WHERE id = ?', [
              it.quantity,
              lotRows[0].id,
            ]);
          } else {
            await conn.query(
              `INSERT INTO inventory_lots (blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                it.blood_code,
                it.collection_date || null,
                it.blood_product_id,
                it.blood_group,
                it.rh_factor,
                it.volume_id,
                it.unit_id,
                it.expiry_date,
                it.quantity,
              ]
            );
          }
        } else {
          await conn.query(
            `INSERT INTO inventory_lots (blood_code, collection_date, blood_product_id, blood_group, rh_factor, volume_id, unit_id, expiry_date, quantity)
             VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
            [
              it.collection_date || null,
              it.blood_product_id,
              it.blood_group,
              it.rh_factor,
              it.volume_id,
              it.unit_id,
              it.expiry_date,
              it.quantity,
            ]
          );
        }
      }
    }

    await conn.query(
      `UPDATE transactions SET 
         status = 'CANCELLED', 
         cancel_approved_by = ?, 
         cancel_approved_at = NOW() 
       WHERE id = ?`,
      [req.user.id, id]
    );

    await conn.commit();

    await logActivity({
      req,
      actionType: 'CANCEL_APPROVE',
      actionCategory: 'TRANSACTION',
      actionName: `Phê duyệt hủy phiếu ${tx.code}`,
      description: `Đã phê duyệt hủy phiếu ${tx.code} và hoàn nguyên tồn kho`,
      status: 'SUCCESS',
      metadata: { tx_id: tx.id, code: tx.code },
    });

    res.json({ message: 'Duyệt hủy phiếu thành công. Toàn bộ tồn kho đã được hoàn nguyên chính xác!', status: 'CANCELLED' });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// 5.3 Từ chối yêu cầu hủy phiếu
router.post('/:id/cancel-reject', authenticate, async (req, res) => {
  const pool = getPool();
  try {
    const { id } = req.params;
    const { reject_reason } = req.body;

    const [txRows] = await pool.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!txRows.length) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu giao dịch' });
    }
    const tx = txRows[0];

    const isImport = tx.tx_type === 'IMPORT';
    const isExport = tx.tx_type === 'EXPORT';
    if (!isImport && !isExport) {
      return res.status(400).json({ error: 'Chức năng chỉ áp dụng cho Phiếu Nhập và Phiếu Xuất' });
    }

    const permNeeded = isImport ? 'import.cancel_approve' : 'export.cancel_approve';
    const userPerms = req.user.permissions || [];
    const userRole = req.user.role || req.user.role_code;
    const hasPerm = userRole === 'ADMIN' || userPerms.includes(permNeeded);

    if (!hasPerm) {
      return res.status(403).json({ error: 'Bạn không có quyền từ chối duyệt hủy phiếu này' });
    }

    if (tx.status !== 'PENDING_CANCEL') {
      return res.status(400).json({ error: `Phiếu hiện không ở trạng thái Chờ duyệt hủy (Trạng thái hiện tại: ${tx.status})` });
    }

    await pool.query(
      `UPDATE transactions SET 
         status = 'COMPLETED', 
         cancel_reject_reason = ?, 
         cancel_approved_by = ?, 
         cancel_approved_at = NOW() 
       WHERE id = ?`,
      [reject_reason ? reject_reason.trim() : 'Từ chối yêu cầu hủy', req.user.id, id]
    );

    res.json({ message: 'Đã từ chối yêu cầu hủy phiếu. Phiếu vẫn giữ nguyên trạng thái hoạt động.', status: 'COMPLETED' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
