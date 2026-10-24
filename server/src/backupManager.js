const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const TABLES_TO_BACKUP = [
  'roles',
  'users',
  'system_config',
  'partners',
  'departments',
  'units',
  'volumes',
  'blood_products',
  'inventory_lots',
  'transactions',
  'transaction_items',
];

async function createBackup({ backupType = 'MANUAL', note = '', createdBy = 'System' } = {}) {
  const pool = getPool();
  const data = {};

  for (const table of TABLES_TO_BACKUP) {
    const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
    data[table] = rows;
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const prefix = backupType === 'AUTO' ? 'auto_backup' : 'manual_backup';
  const fileName = `${prefix}_${timestamp}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  const payload = {
    meta: {
      app: 'BloodBank Lab Management System',
      version: '2.0.0',
      backup_type: backupType,
      created_at: now.toISOString(),
      created_by: createdBy,
      note,
    },
    tables: data,
  };

  const jsonContent = JSON.stringify(payload, null, 2);
  fs.writeFileSync(filePath, jsonContent, 'utf8');
  const stats = fs.statSync(filePath);

  const [res] = await pool.query(
    `INSERT INTO backups (file_name, file_size, backup_type, note, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [fileName, stats.size, backupType, note || (backupType === 'AUTO' ? 'Sao lưu tự động theo lịch' : 'Sao lưu thủ công'), createdBy]
  );

  // Enforce retention policy (Giữ tối đa N phiên bản sao lưu tự động, mặc định 3)
  await enforceBackupRetention();

  return {
    id: res.insertId,
    file_name: fileName,
    file_size: stats.size,
    backup_type: backupType,
    note,
    created_by: createdBy,
    created_at: now.toISOString(),
  };
}

async function enforceBackupRetention() {
  const pool = getPool();
  const [cfgRows] = await pool.query(
    `SELECT config_value FROM system_config WHERE config_key = 'auto_backup_max_files'`
  );
  const maxFiles = Math.max(1, parseInt(cfgRows[0]?.config_value || '3', 10) || 3);

  // Get all AUTO backups ordered newest first
  const [autoBackups] = await pool.query(
    `SELECT id, file_name FROM backups WHERE backup_type = 'AUTO' ORDER BY created_at DESC, id DESC`
  );

  if (autoBackups.length > maxFiles) {
    const toDelete = autoBackups.slice(maxFiles);
    for (const item of toDelete) {
      const fPath = path.join(BACKUP_DIR, item.file_name);
      if (fs.existsSync(fPath)) {
        try {
          fs.unlinkSync(fPath);
        } catch (e) {
          console.error('Failed to delete old backup file:', e.message);
        }
      }
      await pool.query(`DELETE FROM backups WHERE id = ?`, [item.id]);
    }
  }
}

async function restoreFromPayload(payload) {
  if (!payload || !payload.tables || typeof payload.tables !== 'object') {
    throw new Error('File sao lưu không đúng định dạng hoặc bị hỏng');
  }

  const pool = getPool();
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of TABLES_TO_BACKUP) {
      if (Array.isArray(payload.tables[table])) {
        await conn.query(`TRUNCATE TABLE \`${table}\``);
        const rows = payload.tables[table];
        for (const row of rows) {
          const keys = Object.keys(row);
          if (keys.length === 0) continue;
          const cols = keys.map((k) => `\`${k}\``).join(', ');
          const placeholders = keys.map(() => '?').join(', ');
          const values = keys.map((k) => row[k]);
          await conn.query(
            `INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`,
            values
          );
        }
      }
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
  } catch (err) {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Auto-backup scheduler
let schedulerInterval = null;

function startAutoBackupScheduler() {
  if (schedulerInterval) clearInterval(schedulerInterval);

  // Check every 1 minute if an auto-backup is due
  const checkAndRunAutoBackup = async () => {
    try {
      const pool = getPool();
      const [cfgRows] = await pool.query(
        `SELECT config_key, config_value FROM system_config WHERE config_key IN ('auto_backup_enabled', 'auto_backup_time', 'auto_backup_interval_hours', 'auto_backup_max_files')`
      );
      const cfg = {};
      for (const r of cfgRows) cfg[r.config_key] = r.config_value;

      if (cfg.auto_backup_enabled !== 'true') return;

      const targetTime = cfg.auto_backup_time || '23:00';
      const [tHourStr, tMinStr] = (targetTime || '23:00').split(':');
      const targetHour = parseInt(tHourStr, 10) || 0;
      const targetMin = parseInt(tMinStr, 10) || 0;
      const targetTotalMinutes = targetHour * 60 + targetMin;

      const intervalHours = Math.max(1, parseFloat(cfg.auto_backup_interval_hours || '24') || 24);
      const maxFiles = Math.max(1, parseInt(cfg.auto_backup_max_files || '3', 10) || 3);

      const [lastAuto] = await pool.query(
        `SELECT created_at FROM backups WHERE backup_type = 'AUTO' ORDER BY created_at DESC LIMIT 1`
      );

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let shouldRun = false;
      let runReason = '';

      if (lastAuto.length === 0) {
        // Chưa từng có bản sao lưu tự động -> Chạy nếu đã đến hoặc qua khung giờ hẹn hôm nay
        if (currentMinutes >= targetTotalMinutes) {
          shouldRun = true;
          runReason = `Sao lưu tự động theo lịch (${targetTime} hàng ngày)`;
        }
      } else {
        const lastDate = new Date(lastAuto[0].created_at);
        const lastDateStr = `${lastDate.getFullYear()}-${pad(lastDate.getMonth() + 1)}-${pad(lastDate.getDate())}`;
        const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

        // Trường hợp 1: Hôm nay chưa chạy bản tự động nào VÀ hiện tại đã đến hoặc qua khung giờ hẹn
        if (lastDateStr !== todayStr && currentMinutes >= targetTotalMinutes) {
          shouldRun = true;
          runReason = `Sao lưu tự động định kỳ hàng ngày lúc ${targetTime}`;
        }
        // Trường hợp 2: Khoảng cách từ lần sao lưu tự động trước đó đã vượt quá intervalHours
        else if (diffHours >= intervalHours) {
          shouldRun = true;
          runReason = `Sao lưu tự động bù chu kỳ ${intervalHours} giờ`;
        }
      }

      if (shouldRun) {
        console.log(`[AutoBackup] Bắt đầu tự động sao lưu: ${runReason}`);
        await createBackup({
          backupType: 'AUTO',
          note: `${runReason} (Lưu tối đa ${maxFiles} bản)`,
          createdBy: 'Hệ thống (Auto)',
        });
      }
    } catch (err) {
      console.error('Auto backup check error:', err.message);
    }
  };

  // Run initial check after 5 seconds
  setTimeout(checkAndRunAutoBackup, 5000);
  schedulerInterval = setInterval(checkAndRunAutoBackup, 60 * 1000);
}

module.exports = {
  BACKUP_DIR,
  createBackup,
  enforceBackupRetention,
  restoreFromPayload,
  startAutoBackupScheduler,
};
