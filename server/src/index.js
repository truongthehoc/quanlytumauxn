require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./initDb');
const { startAutoBackupScheduler } = require('./backupManager');

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const inventoryRoutes = require('./routes/inventory');
const transactionRoutes = require('./routes/transactions');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audits');
const systemRoutes = require('./routes/system');

const app = express();
const PORT = process.env.PORT || 5005;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'BloodBank Lab Server', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audits', auditRoutes);
app.use('/api/system', systemRoutes);

async function startServer() {
  try {
    console.log('[*] Đang kết nối MySQL và khởi tạo cấu trúc dữ liệu (blood_bank)...');
    await initDatabase();
    console.log('[+] Cơ sở dữ liệu MySQL đã sẵn sàng!');

    startAutoBackupScheduler();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=====================================================`);
      console.log(`  BloodBank Lab API Server đang chạy tại port ${PORT}`);
      console.log(`  URL: http://localhost:${PORT}`);
      console.log(`=====================================================`);
    });
  } catch (err) {
    console.error('[!] Lỗi khởi động Server:', err);
    process.exit(1);
  }
}

startServer();
