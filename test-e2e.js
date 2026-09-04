/**
 * test-e2e.js
 * 
 * End-to-end automated pipeline test verifying Cu-PAN backend API endpoints,
 * scan processing, color extraction, lighting correction, DGMS reports,
 * and the 200-sample Calibration & Model metrology engine.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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
  console.log('🧪 RUNNING Cu-PAN H2S DOSIMETER END-TO-END PIPELINE TESTS');
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
  await test('Backend Health Check (/health & /api/v1/health)', async () => {
    const res = await new Promise((resolve, reject) => {
      http.get(`http://${BASE_HOST}:${BASE_PORT}/health`, (r) => {
        let d = '';
        r.on('data', (c) => (d += c));
        r.on('end', () => resolve({ status: r.statusCode, data: JSON.parse(d) }));
      }).on('error', reject);
    });
    if (res.status !== 200 || res.data.status !== 'ok' || res.data.chemistry !== 'Cu-PAN') {
      throw new Error(`Expected 200 ok Cu-PAN, got status ${res.status}: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 2: Cu-PAN Calibration Profile
  await test('GET /calibration/cupan', async () => {
    const res = await makeRequest('GET', '/calibration/cupan');
    if (res.status !== 200 || res.data.chemistry !== 'Cu-PAN' || !res.data.virgin_baseline_lab) {
      throw new Error(`Cu-PAN calibration profile failed: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 3: List Workers
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

  // Test 4: Get Cumulative Dose
  await test('GET /workers/W1023/cumulative-dose', async () => {
    const res = await makeRequest('GET', '/workers/W1023/cumulative-dose');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    const { workerId, totalDosePpmHours, readingCount, thresholdPpmHours, overThreshold } = res.data;
    if (workerId !== 'W1023' || typeof totalDosePpmHours !== 'number' || typeof overThreshold !== 'boolean') {
      throw new Error(`Invalid cumulative dose shape: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 5: Get Worker Readings
  await test('GET /workers/W1023/readings', async () => {
    const res = await makeRequest('GET', '/workers/W1023/readings');
    if (res.status !== 200 || !Array.isArray(res.data)) throw new Error(`Status ${res.status}`);
    const reading = res.data[0];
    if (!reading.readingId || !reading.stripColorRGB || !reading.referenceColorRGB || !reading.correctedColorRGB) {
      throw new Error(`Reading missing RGB/ID contract fields: ${JSON.stringify(reading)}`);
    }
  });

  // Test 6: Submit New Cu-PAN Scan (POST /scan)
  await test('POST /scan (Cu-PAN Optical Pipeline)', async () => {
    const testWorkerId = `W_E2E_${Date.now().toString().slice(-4)}`;
    const testStripId = `CUPAN-STRIP-E2E-${Date.now().toString().slice(-4)}`;

    await makeRequest('POST', '/workers', {
      workerId: testWorkerId,
      name: 'E2E Optical Worker',
      department: 'Analytical Lab'
    });

    await makeRequest('POST', '/strip/activate', {
      workerId: testWorkerId,
      stripId: testStripId,
      batchId: 'CUPAN-BATCH-001'
    });

    const sampleImgPath = path.join(__dirname, 'backend/uploads/sample-w1024-shift1.jpg');
    const testImage = fs.existsSync(sampleImgPath)
      ? `data:image/jpeg;base64,${fs.readFileSync(sampleImgPath).toString('base64')}`
      : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjuAAAAAElFTkSuQmCC';
    const payload = {
      workerId: testWorkerId,
      shiftId: '2026-09-01-AUTO-TEST',
      imageBase64: testImage,
      ambientTemp: 25.0,
      ambientHumidity: 50.0,
      capturedAt: new Date().toISOString()
    };

    const res = await makeRequest('POST', '/scan', payload);
    if (res.status !== 201) throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`);
    const data = res.data;
    if (!data.readingId || (data.chemistry !== 'Cu-PAN' && data.chemistry !== 'CU_PAN') || typeof data.dose !== 'number' || data.unit !== 'ppm·h') {
      throw new Error(`Response missing Cu-PAN contract keys: ${JSON.stringify(data)}`);
    }
  });

  // Test 7: DGMS Report Generation
  await test('GET /reports/dgms', async () => {
    const res = await makeRequest('GET', '/reports/dgms');
    if (res.status !== 200 || !Array.isArray(res.data)) throw new Error(`Status ${res.status}`);
    const reportItem = res.data[0];
    if (!reportItem.workerId || typeof reportItem.totalDosePpmHours !== 'number') {
      throw new Error(`Report item missing required fields: ${JSON.stringify(reportItem)}`);
    }
  });

  // --- SECTION: 200-SAMPLE CALIBRATION & MODEL SUITE ---

  // Test 8: Calibration Summary
  await test('GET /calibration/summary', async () => {
    const res = await makeRequest('GET', '/calibration/summary');
    if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    const { dataset_status, active_model, calibrated_domain } = res.data;
    if (!dataset_status || dataset_status.total_samples < 200 || dataset_status.real_experimental_count < 200) {
      throw new Error(`Invalid dataset sample counts: ${JSON.stringify(dataset_status)}`);
    }
    if (typeof active_model.test_r2 !== 'number' || typeof active_model.test_mae !== 'number') {
      throw new Error(`Invalid active model metrics: ${JSON.stringify(active_model)}`);
    }
  });

  // Test 9: Calibration Dataset (Filtering & Pagination)
  await test('GET /calibration/dataset (All, Experimental, Synthetic)', async () => {
    const allRes = await makeRequest('GET', '/calibration/dataset?limit=300');
    if (allRes.status !== 200 || allRes.data.total < 200) {
      throw new Error(`Expected at least 200 total samples, got ${allRes.data.total}`);
    }

    const expRes = await makeRequest('GET', '/calibration/dataset?type=experimental');
    if (expRes.status !== 200 || expRes.data.total < 10) {
      throw new Error(`Expected at least 10 real experimental samples, got ${expRes.data.total}`);
    }
  });

  // Test 10: Calibration Metrics (Multi-model comparison)
  await test('GET /calibration/metrics', async () => {
    const res = await makeRequest('GET', '/calibration/metrics');
    if (res.status !== 200 || !res.data.model_comparison) {
      throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const comparison = res.data.model_comparison;
    const requiredModels = ['piecewise_spline', 'linear_regression', 'polynomial_surface', 'gradient_boosted'];
    for (const m of requiredModels) {
      if (!comparison[m] || typeof comparison[m].test.r2 !== 'number') {
        throw new Error(`Missing candidate model ${m} in comparison: ${JSON.stringify(comparison)}`);
      }
    }
  });

  // Test 11: Calibration Graphs
  await test('GET /calibration/graphs', async () => {
    const res = await makeRequest('GET', '/calibration/graphs');
    if (res.status !== 200 || !res.data.calibration_curve) {
      throw new Error(`Missing graphs payload: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 12: Active Calibration Model
  await test('GET /calibration/model', async () => {
    const res = await makeRequest('GET', '/calibration/model');
    if (res.status !== 200 || !res.data.model_version.startsWith('CUPAN-MODEL-v')) {
      throw new Error(`Invalid model version: ${JSON.stringify(res.data)}`);
    }
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests();
