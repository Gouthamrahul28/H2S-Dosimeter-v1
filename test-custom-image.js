/**
 * test-custom-image.js
 * 
 * CLI Tool to test real-world dosimeter badge photos against the optical pipeline.
 * 
 * Usage:
 *   node test-custom-image.js <path-to-image> [workerId] [temperature] [humidity]
 * 
 * Example:
 *   node test-custom-image.js backend/uploads/sample-w1023-shift1.jpg W1023 32.5 60
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const imagePathArg = process.argv[2];
const workerId = process.argv[3] || 'W1023';
const ambientTemp = parseFloat(process.argv[4]) || 25.0;
const ambientHumidity = parseFloat(process.argv[5]) || 50.0;

if (!imagePathArg) {
  console.log('========================================================================');
  console.log('📸 H2S DOSIMETER — REAL-TIME IMAGE TESTING UTILITY');
  console.log('========================================================================');
  console.log('\nUsage:');
  console.log('  node test-custom-image.js <image-path> [workerId] [temp_C] [humidity_%]');
  console.log('\nExamples:');
  console.log('  node test-custom-image.js backend/uploads/sample-w1023-shift1.jpg');
  console.log('  node test-custom-image.js "C:\\path\\to\\my-real-badge.jpg" W1024 33.0 65\n');
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), imagePathArg);

if (!fs.existsSync(resolvedPath)) {
  console.error(`❌ Error: File not found at "${resolvedPath}"`);
  process.exit(1);
}

console.log('========================================================================');
console.log('🧪 PROCESSING REAL IMAGE THROUGH OPTICAL PIPELINE');
console.log(`📁 File: ${resolvedPath}`);
console.log(`👷 Worker ID: ${workerId} | Temp: ${ambientTemp}°C | Humidity: ${ambientHumidity}%`);
console.log('========================================================================\n');

const fileBuffer = fs.readFileSync(resolvedPath);
const ext = path.extname(resolvedPath).toLowerCase();
const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
const base64Data = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;

const payload = JSON.stringify({
  workerId,
  shiftId: `TEST-${new Date().toISOString().slice(0, 10)}`,
  imageBase64: base64Data,
  ambientTemp,
  ambientHumidity,
  capturedAt: new Date().toISOString()
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/readings',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  },
  (res) => {
    let data = '';
    res.on('data', (chunk) => (data += chunk));
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        if (res.statusCode !== 201) {
          console.error(`❌ API Error (${res.statusCode}):`, result.error || data);
          process.exit(1);
        }

        console.log('✅ Optical Pipeline & Reading Successfully Processed!\n');
        console.log('------------------------------------------------------------------------');
        console.log(`📊 Reading ID:              ${result.readingId}`);
        console.log(`🏷️ Expiry Patch Status:     ${(result.expiryPatchStatus || 'valid').toUpperCase()}`);
        console.log('------------------------------------------------------------------------');
        console.log(`🎨 Raw Reference RGB:       (${result.referenceColorRGB.r}, ${result.referenceColorRGB.g}, ${result.referenceColorRGB.b})`);
        console.log(`🎨 Raw Strip RGB:           (${result.stripColorRGB.r}, ${result.stripColorRGB.g}, ${result.stripColorRGB.b})`);
        console.log(`✨ Corrected Strip RGB:     (${result.correctedColorRGB.r}, ${result.correctedColorRGB.g}, ${result.correctedColorRGB.b})`);
        console.log('------------------------------------------------------------------------');
        console.log(`⚡ Estimated Shift Dose:    ${Number(result.estimatedDosePpmHours).toFixed(1)} ppm·hours`);

        // Fetch cumulative status
        http.get(`http://localhost:5000/api/v1/workers/${workerId}/cumulative-dose`, (cumRes) => {
          let cumData = '';
          cumRes.on('data', (c) => (cumData += c));
          cumRes.on('end', () => {
            try {
              const cum = JSON.parse(cumData);
              const total = cum.totalDosePpmHours || result.estimatedDosePpmHours;
              const threshold = cum.thresholdPpmHours || 80.0;
              const pct = ((total / threshold) * 100).toFixed(1);

              console.log(`📈 Worker Cumulative Dose:  ${total.toFixed(1)} / ${threshold.toFixed(1)} ppm·hours (${pct}%)`);
              if (cum.overThreshold) {
                console.log(`🚨 STATUTORY STATUS:        🔴 OVER DGMS/OISD LIMIT (${pct}%)`);
              } else if (total >= threshold * 0.75) {
                console.log(`⚠️  STATUTORY STATUS:        🟡 APPROACHING LIMIT WARNING (${pct}%)`);
              } else {
                console.log(`🛡️  STATUTORY STATUS:        🟢 SAFE / WITHIN COMPLIANCE (${pct}%)`);
              }
            } catch (e) {}
            console.log('------------------------------------------------------------------------\n');
            console.log('👉 View live updates on the Supervisor Dashboard: http://localhost:5174');
          });
        });
      } catch (err) {
        console.error('❌ Failed to parse response:', err.message, data);
      }
    });
  }
);

req.on('error', (err) => {
  console.error('❌ Could not connect to backend server at http://localhost:5000:', err.message);
  console.error('Make sure the backend is running (`npm start --prefix backend`).');
});

req.write(payload);
req.end();
