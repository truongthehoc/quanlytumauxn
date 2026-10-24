const { getPool } = require('./db');

async function migrate() {
  const pool = getPool();
  try {
    const [colsLot] = await pool.query("SHOW COLUMNS FROM inventory_lots LIKE 'collection_date'");
    if (colsLot.length === 0) {
      console.log('Adding collection_date to inventory_lots...');
      await pool.query('ALTER TABLE inventory_lots ADD COLUMN collection_date DATE NULL DEFAULT NULL AFTER blood_code');
    } else {
      console.log('collection_date already exists in inventory_lots');
    }

    const [colsItem] = await pool.query("SHOW COLUMNS FROM transaction_items LIKE 'collection_date'");
    if (colsItem.length === 0) {
      console.log('Adding collection_date to transaction_items...');
      await pool.query('ALTER TABLE transaction_items ADD COLUMN collection_date DATE NULL DEFAULT NULL AFTER blood_code');
    } else {
      console.log('collection_date already exists in transaction_items');
    }

    console.log('Migration for collection_date completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
