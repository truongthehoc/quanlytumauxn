const { getPool } = require('./db');

async function migrate() {
  const pool = getPool();
  try {
    const [colsLot] = await pool.query("SHOW COLUMNS FROM inventory_lots LIKE 'blood_code'");
    if (colsLot.length === 0) {
      console.log('Adding blood_code to inventory_lots...');
      await pool.query('ALTER TABLE inventory_lots ADD COLUMN blood_code VARCHAR(50) NULL DEFAULT NULL AFTER id');
    } else {
      console.log('blood_code already exists in inventory_lots');
    }

    const [colsItem] = await pool.query("SHOW COLUMNS FROM transaction_items LIKE 'blood_code'");
    if (colsItem.length === 0) {
      console.log('Adding blood_code to transaction_items...');
      await pool.query('ALTER TABLE transaction_items ADD COLUMN blood_code VARCHAR(50) NULL DEFAULT NULL AFTER transaction_id');
    } else {
      console.log('blood_code already exists in transaction_items');
    }

    try {
      await pool.query('ALTER TABLE inventory_lots ADD INDEX idx_bp (blood_product_id)');
      console.log('Added idx_bp');
    } catch (e) {
      console.log('idx_bp note:', e.message);
    }

    try {
      await pool.query('ALTER TABLE inventory_lots DROP INDEX uk_lot');
      console.log('Dropped old uk_lot index');
    } catch (e) {
      console.log('uk_lot might not exist or already dropped:', e.message);
    }

    try {
      await pool.query('ALTER TABLE inventory_lots ADD UNIQUE KEY uk_lot (blood_product_id, blood_group, rh_factor, volume_id, expiry_date, blood_code)');
      console.log('Added updated uk_lot with blood_code');
    } catch (e) {
      console.log('uk_lot already updated or error:', e.message);
    }

    try {
      await pool.query('ALTER TABLE inventory_lots ADD INDEX idx_blood_code (blood_code)');
      console.log('Added idx_blood_code index');
    } catch (e) {
      console.log('idx_blood_code already exists or error:', e.message);
    }

    console.log('Migration finished successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

migrate();
