require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

// ─── NEW: Import the database pool ───────────────────────────────────────────
const db = require('./config/db');

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

// ─── WEBSOCKET BRIDGE ───────────────────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN, // Dynamically sourced from .env
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

app.set('io', io);

// ─── NEW: Initialize Database Listener ───────────────────────────────────────
db.setupDatabaseListener(io);

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // Dynamically sourced from .env
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ❌ DELETED: The /api/webhook/n8n-graded route has been removed. 

// ─── Protected routes ───────────────────────────────────────────────────────
app.use('/api/auth', authMiddleware, authRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.use('/api/teams', authMiddleware, teamsRoutes);
app.use('/api/assignments', authMiddleware, assignmentsRoutes);
app.use('/api/submissions', authMiddleware, submissionsRoutes);

app.use(errorHandler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SAKEC API server running with WebSockets on http://0.0.0.0:${PORT}`);
  console.log(`   CORS origin: ${process.env.CORS_ORIGIN}`);
  console.log(`   Environment: ${process.env.NODE_ENV}`);
});