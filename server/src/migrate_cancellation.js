const { getPool } = require('./db');

async function migrateCancellation() {
  const pool = getPool();
  try {
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'transactions' AND COLUMN_NAME = 'status'
    `);

    if (cols.length === 0) {
      console.log('Adding cancellation columns to transactions table...');
      await pool.query(`
        ALTER TABLE transactions
        ADD COLUMN status ENUM('COMPLETED', 'PENDING_CANCEL', 'CANCELLED') NOT NULL DEFAULT 'COMPLETED' AFTER return_status,
        ADD COLUMN cancel_reason TEXT NULL AFTER note,
        ADD COLUMN cancel_requested_by INT NULL AFTER cancel_reason,
        ADD COLUMN cancel_requested_at DATETIME NULL AFTER cancel_requested_by,
        ADD COLUMN cancel_approved_by INT NULL AFTER cancel_requested_at,
        ADD COLUMN cancel_approved_at DATETIME NULL AFTER cancel_approved_by,
        ADD COLUMN cancel_reject_reason TEXT NULL AFTER cancel_approved_at,
        ADD CONSTRAINT fk_tx_cancel_req FOREIGN KEY (cancel_requested_by) REFERENCES users(id) ON DELETE SET NULL,
        ADD CONSTRAINT fk_tx_cancel_app FOREIGN KEY (cancel_approved_by) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('Successfully added cancellation columns to transactions.');
    } else {
      console.log('Cancellation columns already exist in transactions.');
    }
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

if (require.main === module) {
  migrateCancellation()
    .then(() => {
      console.log('Migration finished.');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { migrateCancellation };
