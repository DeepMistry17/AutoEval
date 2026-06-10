require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const http = require('http'); // <-- NEW: Required for WebSockets
const { Server } = require('socket.io'); // <-- NEW: Required for WebSockets

const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const teamsRoutes = require('./routes/teams.routes');
const assignmentsRoutes = require('./routes/assignments.routes');
const submissionsRoutes = require('./routes/submissions.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── NEW WEBSOCKET BRIDGE ───────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://172.16.151.3:8081',
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    credentials: true
  }
});

io.on('connection', (socket) => {
  console.log(`🟢 Dashboard connected via WebSocket: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔴 Dashboard disconnected: ${socket.id}`);
  });
});

// Make 'io' globally accessible to your route files
app.set('io', io);
// ────────────────────────────────────────────────────────────────────────────

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());

// Strict CORS — only allow the frontend origin
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://172.16.151.3:8081',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Health check (no auth) ─────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── NEW: n8n Webhook Receiver (Tells UI to refresh) ────────────────────────
app.post('/api/webhook/n8n-graded', (req, res) => {
  const { secret } = req.body;

  // Security check to ensure only your n8n canvas can hit this route
  if (secret !== 'sakec_n8n_secret_2026') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  // Retrieve the WebSocket instance
  const globalIo = req.app.get('io');
  
  if (globalIo) {
    // Broadcast a universal refresh instruction to the React frontend
    globalIo.emit('refresh_dashboard');
    console.log('⚡ Received finish signal from n8n. Broadcasted refresh command to UI.');
  }

  res.status(200).json({ success: true, message: 'UI refresh broadcasted' });
});
// ────────────────────────────────────────────────────────────────────────────

// ─── Protected routes ───────────────────────────────────────────────────────
app.use('/api/auth', authMiddleware, authRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/teams', authMiddleware, teamsRoutes);
app.use('/api/assignments', authMiddleware, assignmentsRoutes);
app.use('/api/submissions', authMiddleware, submissionsRoutes);

// ─── Error handler (must be last) ───────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ───────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SAKEC API server running with WebSockets on http://0.0.0.0:${PORT}`);
  console.log(`   CORS origin: ${process.env.CORS_ORIGIN || 'http://172.16.151.3:8081'}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});