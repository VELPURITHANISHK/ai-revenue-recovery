const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('[DB] Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`[DB] MongoDB Connected: ${conn.connection.host} / ${conn.connection.name}`);
  } catch (error) {
    console.error(`[DB] MongoDB connection FAILED: ${error.message}`);
    console.error('[DB] Check: (1) Atlas IP whitelist, (2) MONGODB_URI in .env, (3) DB user password');
    process.exit(1);
  }
};

module.exports = connectDB;
