require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const readingRoutes = require('./routes/readingRoutes');
const workerRoutes = require('./routes/workerRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev to avoid CORS blocking
      }
    },
    credentials: true
  })
);

// High-limit parser for base64 image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'h2s-dosimeter-backend',
    time: new Date().toISOString()
  });
});

// API Routes (Contract Base: /api/v1)
app.use('/api/v1/readings', readingRoutes);
app.use('/api/v1/workers', workerRoutes);
app.use('/api/v1/reports', reportRoutes);
app.get('/api/v1/calibration/curves', require('./controllers/reportController').getCalibrationCurves);


// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  H2S Dosimeter Backend API running on port ${PORT}`);
    console.log(`  Base URL: http://localhost:${PORT}/api/v1`);
    console.log(`  Health Check: http://localhost:${PORT}/health`);
    console.log(`=================================================`);
  });
}

module.exports = app;
