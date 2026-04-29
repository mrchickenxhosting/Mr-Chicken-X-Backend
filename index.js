const app = require('./src/app');
const pool = require('./src/config/db'); // adjust path if different

const PORT = process.env.PORT || 5000;

// 🔥 DB check before starting server
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
    console.error(err.message);

    process.exit(1); // stop server if DB fails
  }
}

startServer();