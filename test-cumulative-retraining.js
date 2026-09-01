/**
 * test-cumulative-retraining.js
 * 
 * Comprehensive automated test suite for the Cumulative Cu-PAN Retraining Engine:
 * 1. Data Ingestion & Quality Gate Validation (Rejection of invalid samples)
 * 2. Cumulative Master Dataset Merge (Master vN+1 = Master vN + New Validated Data)
 * 3. Candidate Model Training & Generalization Evaluation
 * 4. Side-by-Side Model Comparison (Delta MAE, Delta R², Verdict)
 * 5. Candidate Publication & Worker Scan Traceability
 * 6. Model Rollback & State Restoration
 * 7. Coverage Heatmap Matrix & Priority Recommendations
 * 8. Historical Dataset Growth & Accuracy Trends
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

const TEST_PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjuAAAAAElFTkSuQmCC';

async function runCumulativeRetrainingTests() {
  console.log('================================================================');
  console.log('🧪  SIH26118 — CUMULATIVE Cu-PAN MODEL RETRAINING TESTS');
  console.log('================================================================\n');

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

  // Test 1: Ingest invalid data & verify quality gate rejection
  await test('Quality Gate: Rejection of invalid experimental samples (POST /calibration/data/add)', async () => {
    const res = await makeRequest('POST', '/calibration/data/add', [
      {
        sample_id: 'INVALID_TEMP_001',
        dose_ppm_h: 15.0,
        temperature_c: 85.0, // Invalid: exceeds 50°C
        humidity_percent: 50.0,
        L: 50.0,
        a: 20.0,
        b: 10.0
      },
      {
        sample_id: 'INVALID_LAB_002',
        dose_ppm_h: 10.0,
        temperature_c: 25.0,
        humidity_percent: 50.0,
        L: 150.0, // Invalid: exceeds 100
        a: 0.0,
        b: 0.0
      }
    ]);

    if (res.status !== 200 || res.data.rejected_count !== 2 || res.data.accepted_count !== 0) {
      throw new Error(`Expected 2 rejected samples, got ${JSON.stringify(res.data)}`);
    }
  });

  // Test 2: Ingest valid experimental samples into PENDING_VALIDATION
  const testSampleId = `REAL_LAB_TEST_${Date.now()}`;
  await test('Data Ingestion: Ingest valid laboratory sample (POST /calibration/data/add)', async () => {
    const res = await makeRequest('POST', '/calibration/data/add', {
      sample_id: testSampleId,
      chemistry: 'Cu-PAN',
      dose_ppm_h: 22.5,
      temperature_c: 26.0,
      humidity_percent: 52.0,
      L: 56.20,
      a: 22.40,
      b: 14.10,
      delta_e00: 24.50,
      strip_batch: 'CUPAN-BATCH-002',
      source: 'REAL'
    });

    if (res.status !== 200 || res.data.accepted_count !== 1 || res.data.status !== 'PENDING_VALIDATION') {
      throw new Error(`Failed to ingest sample: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 3: List pending incoming data
  await test('Data Queue: GET /calibration/data/pending lists unapproved samples', async () => {
    const res = await makeRequest('GET', '/calibration/data/pending');
    if (res.status !== 200 || res.data.total_pending < 1) {
      throw new Error(`Expected pending samples, got ${JSON.stringify(res.data)}`);
    }
  });

  // Test 4: Approve pending samples & verify cumulative master dataset creation
  await test('Cumulative Merge: POST /calibration/data/approve builds new cumulative dataset version', async () => {
    const res = await makeRequest('POST', '/calibration/data/approve');
    if (res.status !== 200 || !res.data.new_dataset_version) {
      throw new Error(`Approval failed: ${JSON.stringify(res.data)}`);
    }
    if (res.data.cumulative_sample_count <= res.data.prior_sample_count) {
      throw new Error(`Cumulative count did not increase: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 5: Train candidate model on cumulative master dataset
  await test('Candidate Training: POST /calibration/candidate/train fits model on cumulative master', async () => {
    const res = await makeRequest('POST', '/calibration/candidate/train');
    if (res.status !== 200 || !res.data.candidate_model) {
      throw new Error(`Candidate training failed: ${JSON.stringify(res.data)}`);
    }
    const cand = res.data.candidate_model;
    if (typeof cand.test_r2 !== 'number' || typeof cand.test_mae !== 'number' || cand.status !== 'VALIDATED') {
      throw new Error(`Invalid candidate model payload: ${JSON.stringify(cand)}`);
    }
  });

  // Test 6: Side-by-side model comparison
  await test('Comparison: GET /calibration/candidate/compare returns delta metrics', async () => {
    const res = await makeRequest('GET', '/calibration/candidate/compare');
    if (res.status !== 200 || !res.data.comparison) {
      throw new Error(`Comparison endpoint failed: ${JSON.stringify(res.data)}`);
    }
    const comp = res.data.comparison;
    if (typeof comp.delta_mae !== 'number' || typeof comp.delta_r2 !== 'number' || !comp.verdict) {
      throw new Error(`Invalid comparison shape: ${JSON.stringify(comp)}`);
    }
  });

  // Test 7: Publish candidate model to production
  await test('Publishing: POST /calibration/candidate/publish promotes candidate to active production', async () => {
    const res = await makeRequest('POST', '/calibration/candidate/publish');
    if (res.status !== 200 || !res.data.active_model) {
      throw new Error(`Publishing failed: ${JSON.stringify(res.data)}`);
    }
    if (res.data.active_model.status !== 'PUBLISHED') {
      throw new Error(`Active model status not PUBLISHED: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 8: Worker scan uses and records the newly published model version
  await test('Audit Traceability: Scan logs published model_version', async () => {
    const testWorkerId = `W_TRACE_${Date.now().toString().slice(-4)}`;
    const testStripId = `CUPAN-STRIP-TR-${Date.now().toString().slice(-4)}`;

    await makeRequest('POST', '/workers', {
      workerId: testWorkerId,
      name: 'Traceability Worker',
      department: 'Compliance'
    });

    await makeRequest('POST', '/strip/activate', {
      workerId: testWorkerId,
      stripId: testStripId,
      batchId: 'CUPAN-BATCH-001'
    });

    const res = await makeRequest('POST', '/scan', {
      workerId: testWorkerId,
      imageBase64: TEST_PNG_1X1,
      ambientTemp: 25.0,
      ambientHumidity: 50.0
    });

    if (res.status !== 201 || !res.data.model || !res.data.model.model_version) {
      throw new Error(`Scan missing model_version audit tag: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 9: Model rollback to historical version
  await test('Rollback: POST /calibration/rollback restores previous model version without deleting history', async () => {
    const res = await makeRequest('POST', '/calibration/rollback', {
      target_version: 'CUPAN-MODEL-v3'
    });

    if (res.status !== 200 || !res.data.active_model) {
      throw new Error(`Rollback failed: ${JSON.stringify(res.data)}`);
    }
    if (res.data.active_model.model_version !== 'CUPAN-MODEL-v3') {
      throw new Error(`Active model not set to CUPAN-MODEL-v3: ${JSON.stringify(res.data)}`);
    }
  });

  // Test 10: Calibration Coverage Heatmap Matrix
  await test('Coverage Matrix: GET /calibration/coverage returns 2D density heatmap and priority', async () => {
    const res = await makeRequest('GET', '/calibration/coverage');
    if (res.status !== 200 || !res.data.matrix || !res.data.priority_recommendation) {
      throw new Error(`Coverage endpoint failed: ${JSON.stringify(res.data)}`);
    }
    if (!Array.isArray(res.data.matrix) || res.data.matrix.length < 4) {
      throw new Error(`Invalid coverage matrix bins: ${JSON.stringify(res.data.matrix)}`);
    }
  });

  // Test 11: Dataset Growth & Accuracy Progression Trends
  await test('Trends: GET /calibration/trends returns historical growth and accuracy series', async () => {
    const res = await makeRequest('GET', '/calibration/trends');
    if (res.status !== 200 || !res.data.dataset_growth || !res.data.accuracy_trend) {
      throw new Error(`Trends endpoint failed: ${JSON.stringify(res.data)}`);
    }
    if (res.data.dataset_growth.length < 4 || res.data.accuracy_trend.length < 4) {
      throw new Error(`Expected at least 4 historical snapshots in trends: ${JSON.stringify(res.data)}`);
    }
  });

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runCumulativeRetrainingTests().catch(console.error);
