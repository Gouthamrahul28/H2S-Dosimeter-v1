/**
 * test-e2e.js
 * 
 * End-to-end automated pipeline test verifying backend API endpoints,
 * image uploading, color extraction, lighting correction, and DGMS report generation.
 */

const http = require('http');

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: BASE_HOST,
        port: BASE_PORT,
        path: `/api/v1${path}`,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let resData = '';
        res.on('data', (chunk) => (resData += chunk));
        res.on('end', () => {
          try {
            const parsed = resData ? JSON.parse(resData) : {};
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: resData });
          }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING H2S DOSIMETER END-TO-END PIPELINE TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // Test 1: Health check
  await test('Backend Health Check (/health)', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get(`http://${BASE_HOST}:${BASE_PORT}/health`, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve({ status: r.statusCode, data: JSON.parse(d) }));
      }).on('error', reject);
    });
    if (res.status !== 200 || res.data.status !== 'ok') {
      throw new Error(`Expected 200 ok, got ${res.status}`);
    }
  });

  // Test 2: List Workers
  await test('GET /workers', async () => {
    const res = await makeRequest('GET', '/workers');
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length < 3) {
      throw new Error(`Expected array with at least 3 workers, got ${JSON.stringify(res.data)}`);
    }
    const sample = res.data[0];
    if (!sample.workerId || !sample.name || !sample.department) {
      throw new Error(`Worker missing contract fields: ${JSON.stringify(sample)}`);
    }
  });

  // Test 3: Get Cumulative Dose
  await test('GET /workers/W1023/cumulative-dose', async () => {
    const res = await makeRequest('GET', '/workers/W1023/cumulative-dose');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const { workerId, totalDosePpmHours, readingCount, thresholdPpmHours, overThreshold } = res.data;
    if (workerId !== 'W1023' || typeof totalDosePpmHours !== 'number' || typeof overThreshold !== 'boolean') {
      throw new Error(`Invalid cumulative dose shape: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 4: Get Worker Readings
  await test('GET /workers/W1023/readings', async () => {
    const res = await makeRequest('GET', '/workers/W1023/readings');
    if (res.status !== 200 || !Array.isArray(res.data)) throw new Error(`Status ${res.status}`);
    const reading = res.data[0];
    if (!reading.readingId || !reading.stripColorRGB || !reading.referenceColorRGB || !reading.correctedColorRGB) {
      throw new Error(`Reading missing RGB/ID contract fields: ${JSON.stringify(reading)}`);
    }
  });

  // Test 5: Submit New Reading (POST /readings)
  await test('POST /readings (Full Optical Pipeline)', async () => {
    // 1x1 base64 png
    const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjuAAAAAElFTkSuQmCC';
    const payload = {
      workerId: 'W1024',
      shiftId: '2026-08-31-AUTO-TEST',
      imageBase64: testImage,
      ambientTemp: 33.0,
      ambientHumidity: 65,
      capturedAt: new Date().toISOString()
    };

    const res = await makeRequest('POST', '/readings', payload);
    if (res.status !== 201) throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`);
    const data = res.data;
    if (!data.readingId || !data.estimatedDosePpmHours || !data.correctedColorRGB || !data.expiryPatchStatus) {
      throw new Error(`Response missing required contract keys: ${JSON.stringify(data)}`);
    }
  });

  // Test 6: DGMS Report Generation
  await test('GET /reports/dgms', async () => {
    const res = await makeRequest('GET', '/reports/dgms');
    if (res.status !== 200 || !Array.isArray(res.data)) throw new Error(`Status ${res.status}`);
    const reportItem = res.data[0];
    if (!reportItem.workerId || typeof reportItem.totalDosePpmHours !== 'number') {
      throw new Error(`Report item missing required fields: ${JSON.stringify(reportItem)}`);
    }
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests();
