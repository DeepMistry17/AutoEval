const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Force all queries to default to the sakec schema
pool.on('connect', (client) => {
  client.query(`SET search_path TO ${process.env.DB_SCHEMA || 'sakec'}, public`);
});

// --- NEW: Database Listener Function -----------------------------------------
pool.setupDatabaseListener = async (io) => {
  try {
    // Check out a dedicated client from the pool that stays open permanently
    const client = await pool.connect();
    
    // Subscribe to the PostgreSQL channel we created
    await client.query('LISTEN dashboard_update_channel');
    console.log('?? Connected to PostgreSQL LISTEN channel: dashboard_update_channel');

    // Whenever PostgreSQL sends a notification, this event fires
    client.on('notification', (msg) => {
      if (msg.channel === 'dashboard_update_channel') {
        const payload = JSON.parse(msg.payload);
        console.log(`?? DB Change Detected on table [${payload.table}] - Action: ${payload.action}`);
        
        // --- NEW: Route to Private Room if created_by is provided ---
        if (payload.created_by) {
          io.to(payload.created_by).emit('refresh_dashboard', payload);
        } else {
          // Fallback: If no created_by is attached, broadcast globally (for tables like teams/rosters)
          io.emit('refresh_dashboard', payload);
        }
      }
    });

    // Handle potential client errors so the listener doesn't crash the server
    client.on('error', (err) => {
      console.error('Database listener error:', err);
    });

  } catch (err) {
    console.error('Failed to setup database listener:', err);
  }
};

module.exports = pool;