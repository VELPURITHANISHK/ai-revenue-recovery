require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const connectDB = require('./config/db');
const { startWorker } = require('./workers/recoveryWorker');

connectDB();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/recovery', require('./routes/recoveryRoutes'));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'recovery-api',
    database: require('mongoose').connection.readyState === 1 ? 'connected' : 'disconnected',
    redis: require('./config/redis').redisConnection.status === 'ready' ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => res.json({ service: 'AI Revenue Recovery API', status: 'running' }));

// Start BullMQ worker (non-fatal if Redis is unavailable)
try {
  startWorker();
} catch (err) {
  console.warn(`[Server] BullMQ worker could not start: ${err.message}`);
  console.warn('[Server] Recovery scheduling will be disabled. Start Redis to enable it.');
}

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  AI Revenue Recovery API running on http://127.0.0.1:${PORT}`);
  console.log(`    DEMO_MODE: ${process.env.DEMO_MODE}`);
  console.log(`    MongoDB:   ${process.env.MONGODB_URI}\n`);
});


module.exports = app;
