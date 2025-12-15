const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const analyzeRouter = require('./routes/analyze');
const { initDatabase } = require('./db/init');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));

// Body parser with size limit for large transcripts
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware (simple)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Interview Analyzer Backend is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/analyze', analyzeRouter);

// Features routes (only if DATABASE_URL is configured)
if (process.env.DATABASE_URL) {
  const featuresRouter = require('./routes/features');
  app.use('/api/features', featuresRouter);

  const transcriptsRouter = require('./routes/transcripts');
  app.use('/api/transcripts', transcriptsRouter);
}

// Serve static files (optional - for serving frontend from same server)
app.use(express.static(path.join(__dirname, '../')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

// Initialize database and start server
async function startServer() {
  // Initialize database if DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      await initDatabase();
      console.log('✓ Database ready');
    } catch (error) {
      console.error('⚠️  Database initialization failed:', error.message);
      console.log('Server will continue without database features');
    }
  } else {
    console.log('ℹ️  DATABASE_URL not configured - running without database features');
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   Interview Analyzer Backend Server                   ║
╚════════════════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🔐 CORS enabled for: ${process.env.CORS_ORIGIN || '*'}
📊 Health check: http://localhost:${PORT}/health
${process.env.DATABASE_URL ? '💾 Database: Connected' : '💾 Database: Not configured'}

Ready to analyze interviews! 🎯
    `);
  });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
