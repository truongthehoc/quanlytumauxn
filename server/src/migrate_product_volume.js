const { getPool } = require('./db');

async function migrate() {
  const pool = getPool();
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM blood_products LIKE 'volume_ml'");
    if (cols.length === 0) {
      console.log('Adding volume_ml to blood_products...');
      await pool.query('ALTER TABLE blood_products ADD COLUMN volume_ml INT NOT NULL DEFAULT 250 AFTER name');
    } else {
      console.log('volume_ml already exists in blood_products');
    }

    // Set initial volumes for standard blood products if 250 default
    await pool.query("UPDATE blood_products SET volume_ml = 250 WHERE code = 'HCL'");
    await pool.query("UPDATE blood_products SET volume_ml = 200 WHERE code = 'HTTDL'");
    await pool.query("UPDATE blood_products SET volume_ml = 150 WHERE code = 'TC'");

    console.log('Migration for product volume_ml completed successfully!');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
