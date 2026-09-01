require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');

const readingRoutes = require('./routes/readingRoutes');
const workerRoutes = require('./routes/workerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const calibrationRoutes = require('./routes/calibrationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile native apps, curl, Postman) or any local dev origin
      if (
        !origin ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('192.168.') ||
        origin.includes('10.') ||
        origin.includes('172.')
      ) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in local development
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
  })
);

// High-limit parser for base64 image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root landing endpoint
app.get('/', (req, res) => {
  if (req.accepts('html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cu-PAN H₂S Dosimeter System — API Gateway</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
          .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 600px; width: 100%; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h1 { font-size: 1.5rem; color: #38bdf8; margin-top: 0; }
          p { color: #94a3b8; line-height: 1.6; }
          .badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; background: rgba(16,185,129,0.2); color: #34d399; font-weight: 600; font-size: 0.8rem; margin-bottom: 16px; }
          .links { display: flex; flex-direction: column; gap: 10px; margin-top: 24px; }
          a.btn { display: block; text-decoration: none; padding: 12px 16px; border-radius: 8px; font-weight: 600; text-align: center; transition: all 0.2s; }
          .btn-primary { background: #0284c7; color: white; }
          .btn-primary:hover { background: #0369a1; }
          .btn-secondary { background: #334155; color: #f8fafc; }
          .btn-secondary:hover { background: #475569; }
          code { background: #090d16; padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-family: monospace; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">● ONLINE — Cu-PAN SYSTEM OPERATIONAL</span>
          <h1>Cu-PAN H₂S Dosimeter Backend API</h1>
          <p>Optical Cu-PAN exposure reading, chromatic normalization, and DGMS/OISD regulatory reporting services are active.</p>
          <div class="links">
            <a class="btn btn-primary" href="http://localhost:5174" target="_blank">Open Safety Supervisor Dashboard (Port 5174) &rarr;</a>
            <a class="btn btn-secondary" href="http://localhost:5173" target="_blank">Open Mobile Field Capture App (Port 5173) &rarr;</a>
            <a class="btn btn-secondary" href="/health">View Health Check (<code>/health</code>)</a>
            <a class="btn btn-secondary" href="/api/v1/calibration/cupan">View Cu-PAN Calibration (<code>/api/v1/calibration/cupan</code>)</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  res.json({
    status: 'ok',
    system: 'Cu-PAN H2S Dosimeter System API',
    chemistry: 'Cu-PAN',
    indicator: 'Copper(II)-PAN',
    unit: 'ppm·h',
    version: '2.0.0',
    endpoints: {
      health: '/health',
      healthApi: '/api/v1/health',
      scan: '/api/v1/scan',
      workers: '/api/v1/workers',
      readings: '/api/v1/readings',
      reports: '/api/v1/reports',
      calibrationCuPAN: '/api/v1/calibration/cupan',
      calibrationCamera: '/api/v1/calibration/camera'
    }
  });
});

// Health check endpoints
const handleHealth = (req, res) => {
  res.json({
    status: 'ok',
    service: 'h2s-dosimeter-backend',
    chemistry: 'Cu-PAN',
    indicator: 'Copper(II)-PAN',
    unit: 'ppm·h',
    time: new Date().toISOString()
  });
};

app.get('/health', handleHealth);
app.get('/api/v1/health', handleHealth);

// Minimal Image Test Upload Endpoint (multipart or JSON base64)
const handleTestUpload = (req, res) => {
  const { imageBase64, filename = 'cupan_photo.jpg' } = req.body || {};
  let sizeBytes = 0;
  let contentType = 'image/jpeg';

  if (imageBase64) {
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      contentType = parts[0].replace('data:', '') || 'image/jpeg';
      sizeBytes = Buffer.from(parts[1], 'base64').length;
    } else {
      sizeBytes = Buffer.from(imageBase64, 'base64').length;
    }
  }

  console.log(`[Backend Test Upload] Received ${filename} (${sizeBytes} bytes, ${contentType})`);
  return res.json({
    status: 'received',
    filename,
    chemistry: 'Cu-PAN',
    size_bytes: sizeBytes,
    content_type: contentType,
    timestamp: new Date().toISOString()
  });
};

app.post('/test-upload', handleTestUpload);
app.post('/api/v1/test-upload', handleTestUpload);

const stripRoutes = require('./routes/stripRoutes');

// API Routes (Contract Base: /api/v1)
app.use('/api/v1/readings', readingRoutes);
app.use('/api/v1/workers', workerRoutes);
app.use('/api/v1/strip', stripRoutes);
app.use('/api/v1/admin', stripRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/calibration', calibrationRoutes);
app.use('/scan', readingRoutes);
app.use('/api/v1/scan', readingRoutes);
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
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(`  Cu-PAN H2S Dosimeter Backend API running on port ${PORT}`);
    console.log(`  Listening on: 0.0.0.0:${PORT} (All Network Interfaces)`);
    console.log(`  Chemistry: Cu-PAN (Copper(II)-PAN)`);
    console.log(`  Base URL: http://localhost:${PORT}/api/v1`);
    console.log(`  Health Check: http://localhost:${PORT}/health`);
    console.log(`=================================================`);
  });
}

module.exports = app;
