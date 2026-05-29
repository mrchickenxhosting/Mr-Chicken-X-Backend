const app = require('./src/app');
const pool = require('./src/config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    const client = await pool.connect();

    const res = await client.query('SELECT NOW()');

    console.log('✅ Database connected successfully');
    console.log('🕒 DB Time:', res.rows[0].now);

    client.release();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ Database connection failed');
    console.error(err);

    // DON'T kill the process
    // process.exit(1);
  }
}

// Log unexpected pool issues
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Log crashes that would otherwise be silent
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

startServer();