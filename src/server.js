require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { execSync } = require('child_process');
const pool = require('./config/database');
const { authenticate, authorize } = require('./middleware/auth');
const { runMigrations } = require('./utils/runMigrations');

const app = express();
const PORT = process.env.PORT || 3000;

const defaultOrigins = ['https://accounts.natiwear.in', 'http://localhost:3000'];
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : defaultOrigins;

const startedAt = new Date().toISOString();
let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch (err) {
  console.warn('Unable to resolve git SHA for /api/version');
}

const versionInfo = {
  git_sha: gitSha,
  started_at: startedAt,
  env: process.env.NODE_ENV || 'development'
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
const uploadRoutes = require('./routes/uploadRoutes');
const billRoutes = require('./routes/billRoutes');
const reportRoutes = require('./routes/reportRoutes');
const brainRoutes = require('./routes/brainRoutes');
const authRoutes = require('./routes/authRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const metaRoutes = require('./routes/metaRoutes');
const dropRoutes = require('./routes/dropRoutes');

// Request logger for API errors
app.use('/api', (req, res, next) => {
  const orig = res.json.bind(res);
  res.json = function(body) {
    if (res.statusCode >= 400) {
      console.error(`[API ${res.statusCode}] ${req.method} ${req.path}`, body?.error || body);
    }
    return orig(body);
  };
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api', authenticate, uploadRoutes);
app.use('/api', authenticate, billRoutes);
app.use('/api', authenticate, reportRoutes);
app.use('/api', authenticate, metaRoutes);
app.use('/api', authenticate, dropRoutes);
app.use('/api', authenticate, require('./routes/billItemRoutes'));
app.use('/api', authenticate, require('./routes/tagRoutes'));
app.use('/api', authenticate, require('./routes/skuRoutes'));
app.use('/api/brain', authenticate, brainRoutes);
app.use('/api', authenticate, qualityRoutes);
app.use('/api', authenticate, require('./routes/vendorRoutes'));
app.use('/api', authenticate, require('./routes/recurringRoutes'));

app.get('/api/diag', authenticate, authorize('admin'), async (req, res) => {
  try {
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM documents) AS docs,
        (SELECT COUNT(*) FROM bills) AS bills,
        (SELECT COUNT(*) FROM payments) AS payments,
        (SELECT COUNT(*) FROM bill_items) AS bill_items
    `);
    // Test the actual documents query with LIMIT 1
    let queryErr = null;
    try {
      await pool.query(`
        SELECT d.document_id, b.bill_id,
          GREATEST(0, COALESCE(b.total_amount,0) - COALESCE(paid.total_paid,0)) AS outstanding_amount
        FROM documents d
        LEFT JOIN bills b ON b.document_id = d.document_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(amount_paid),0) AS total_paid FROM payments WHERE bill_id = b.bill_id
        ) paid ON true
        LIMIT 1
      `);
    } catch(e) { queryErr = e.message; }
    res.json({ ok: true, counts: counts.rows[0], queryErr });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as time');
    const userCount = await pool.query('SELECT COUNT(*) as count FROM users');
    const docCount = await pool.query('SELECT COUNT(*) as count FROM documents');
    
    res.json({
      status: 'OK',
      message: 'NATI Accounting System is running!',
      database: 'Connected',
      timestamp: result.rows[0].time,
      stats: {
        users: parseInt(userCount.rows[0].count),
        documents: parseInt(docCount.rows[0].count)
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: error.message
    });
  }
});

app.get('/api/version', (_req, res) => {
  res.json({
    ...versionInfo,
    status: 'OK'
  });
});

// Global error handler — catches serialization errors that escape route handlers
app.use((err, req, res, next) => {
  console.error(`[UNHANDLED] ${req.method} ${req.path}:`, err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, async () => {
  await runMigrations();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 NATI Accounting System Started!');
  console.log(`📍 Dashboard: http://localhost:${PORT}`);
  console.log(`📊 Reports: http://localhost:${PORT}/reports.html`);
  console.log(`🤖 AI Provider: OpenAI (primary)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

module.exports = app;
