/**
 * test-strip-lifecycle.js
 * 
 * Comprehensive automated security & lifecycle test suite verifying:
 * 1. Worker registration enforcement (unregistered / inactive / blocked blocked)
 * 2. Cu-PAN strip assignment & activation
 * 3. Active wear life countdown & expiry enforcement
 * 4. Recalled batch rejection
 * 5. Strip replacement flow & historical reading isolation
 * 6. After-scan sensing capacity remaining calculation & exhaustion blocking
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

async function runSecurityAndLifecycleTests() {
  console.log('================================================================');
  console.log('🛡️  SIH26118 — WORKER REGISTRATION & Cu-PAN STRIP LIFECYCLE TESTS');
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

  // --- SECTION 1: WORKER REGISTRATION ACCESS CONTROL ---

  // Test 1: Unregistered worker rejected from scanning
  await test('Security: Unregistered worker cannot scan (POST /scan)', async () => {
    const res = await makeRequest('POST', '/scan', {
      workerId: 'UNREGISTERED_GHOST_9999',
      imageBase64: TEST_PNG_1X1
    });

    if (res.status !== 403 && res.status !== 401) {
      throw new Error(`Expected 403/401, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (res.data.error_code !== 'WORKER_NOT_REGISTERED') {
      throw new Error(`Expected error_code WORKER_NOT_REGISTERED, got ${res.data.error_code}`);
    }
  });

  // Test 2: Inactive worker blocked from scanning
  await test('Security: Inactive worker blocked from scanning (POST /scan)', async () => {
    const res = await makeRequest('POST', '/scan', {
      workerId: 'W1026', // Vikram Singh - INACTIVE
      imageBase64: TEST_PNG_1X1
    });

    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (res.data.error_code !== 'WORKER_BLOCKED') {
      throw new Error(`Expected error_code WORKER_BLOCKED, got ${res.data.error_code}`);
    }
  });

  // Test 3: Blocked worker blocked from scanning
  await test('Security: Blocked worker blocked from scanning (POST /scan)', async () => {
    const res = await makeRequest('POST', '/scan', {
      workerId: 'W1027', // Suresh Raina - BLOCKED
      imageBase64: TEST_PNG_1X1
    });

    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (res.data.error_code !== 'WORKER_BLOCKED') {
      throw new Error(`Expected error_code WORKER_BLOCKED, got ${res.data.error_code}`);
    }
  });

  // --- SECTION 2: STRIP ASSIGNMENT & LIFECYCLE COUNTDOWN ---

  // Test 4: Active strip retrieval & countdown for registered worker W1023
  await test('Strip Lifecycle: GET /workers/W1023/active-strip returns live countdown & sensing capacity', async () => {
    const res = await makeRequest('GET', '/workers/W1023/active-strip');
    if (res.status !== 200 || !res.data.hasActiveStrip) {
      throw new Error(`Expected active strip for W1023, got ${JSON.stringify(res.data)}`);
    }
    const strip = res.data.strip;
    if (strip.stripId !== 'CUPAN-2026-000123') {
      throw new Error(`Invalid strip payload: ${JSON.stringify(strip)}`);
    }
    if (typeof strip.remainingSeconds !== 'number' || strip.remainingSeconds <= 0) {
      throw new Error(`Expected positive remainingSeconds, got ${strip.remainingSeconds}`);
    }
    if (typeof strip.lifeRemainingPercent !== 'number') {
      throw new Error(`Expected lifeRemainingPercent, got ${strip.lifeRemainingPercent}`);
    }
  });

  // Test 5: Expiring-soon strip detection for W1025
  await test('Strip Lifecycle: W1025 strip returns EXPIRING_SOON warning state', async () => {
    const res = await makeRequest('GET', '/workers/W1025/active-strip');
    if (res.status !== 200 || !res.data.hasActiveStrip) {
      throw new Error(`Expected active strip for W1025, got ${JSON.stringify(res.data)}`);
    }
    const strip = res.data.strip;
    if (!strip.isExpiringSoon && strip.status !== 'EXPIRING_SOON') {
      throw new Error(`Expected EXPIRING_SOON state, got ${JSON.stringify(strip)}`);
    }
  });

  // --- SECTION 3: SCAN AUTHORIZATION & AFTER-SCAN STRIP LIFE ACCOUNTING ---

  // Test 6: Valid registered active worker successfully scans and returns strip_life
  await test('Scan Pipeline: Scan returns measurement + strip_life capacity metrics', async () => {
    const testWorkerId = `W_SCAN_${Date.now().toString().slice(-4)}`;
    const testStripId = `CUPAN-STRIP-SCAN-${Date.now().toString().slice(-4)}`;

    await makeRequest('POST', '/workers', {
      workerId: testWorkerId,
      name: 'Scan Lifecycle Worker',
      department: 'Pipeline Testing'
    });

    await makeRequest('POST', '/strip/activate', {
      workerId: testWorkerId,
      stripId: testStripId,
      batchId: 'CUPAN-BATCH-001'
    });

    const res = await makeRequest('POST', '/scan', {
      workerId: testWorkerId,
      shiftId: '2026-09-01-SHIFT-TEST',
      imageBase64: TEST_PNG_1X1,
      ambientTemp: 26.0,
      ambientHumidity: 50.0
    });

    if (res.status !== 201 || !res.data.success) {
      throw new Error(`Expected 201 Created, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    const data = res.data;
    if (!data.worker || data.worker.id !== testWorkerId) {
      throw new Error(`Missing worker identity in response: ${JSON.stringify(data.worker)}`);
    }
    if (!data.strip_life || typeof data.strip_life.remaining_percent !== 'number') {
      throw new Error(`Missing strip_life.remaining_percent: ${JSON.stringify(data.strip_life)}`);
    }
    if (typeof data.strip_life.used_percent !== 'number' || !data.strip_life.status) {
      throw new Error(`Invalid strip_life object: ${JSON.stringify(data.strip_life)}`);
    }
  });

  // --- SECTION 4: STRIP REPLACEMENT & HISTORICAL ISOLATION ---

  // Test 7: Replace strip for W1024 with new serial CUPAN-2026-000999
  await test('Replacement: POST /strip/replace assigns new strip & resets active wear life', async () => {
    const res = await makeRequest('POST', '/strip/replace', {
      workerId: 'W1024',
      stripId: 'CUPAN-2026-000999',
      batchId: 'CUPAN-BATCH-001',
      qrCodePayload: 'CUPAN-B001-000999'
    });

    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Expected 200 replacement success, got ${res.status}: ${JSON.stringify(res.data)}`);
    }
    if (res.data.strip.stripId !== 'CUPAN-2026-000999' || res.data.strip.status !== 'ACTIVE') {
      throw new Error(`Invalid replacement strip state: ${JSON.stringify(res.data.strip)}`);
    }
    if (res.data.strip.lifeRemainingPercent !== 100 || res.data.strip.cumulativeDosePpmH !== 0) {
      throw new Error(`Expected fresh 100% capacity on new strip: ${JSON.stringify(res.data.strip)}`);
    }

    // Verify active strip endpoint returns the new strip
    const checkRes = await makeRequest('GET', '/workers/W1024/active-strip');
    if (checkRes.data.strip.stripId !== 'CUPAN-2026-000999') {
      throw new Error(`Active strip not updated to new ID: ${JSON.stringify(checkRes.data)}`);
    }
  });

  // Test 8: Historical readings for previous strip remain intact
  await test('History: Past readings for previous strip remain preserved', async () => {
    const res = await makeRequest('GET', '/workers/W1024/readings');
    if (res.status !== 200 || !Array.isArray(res.data) || res.data.length < 2) {
      throw new Error(`Expected historical readings array, got ${JSON.stringify(res.data)}`);
    }
  });

  // --- SECTION 5: ADMIN BATCH MANAGEMENT & RECALL ---

  // Test 9: Admin batch recall blocks scanning for strips in that batch
  await test('Admin Recall: POST /admin/batches/:id/recall rejects subsequent scans', async () => {
    const testBatchId = `CUPAN-BATCH-RECALL-${Date.now()}`;
    const testWorkerId = `W_REC_${Date.now().toString().slice(-4)}`;
    const testStripId = `CUPAN-STRIP-REC-${Date.now().toString().slice(-4)}`;

    // 1. Create a fresh batch
    const batchRes = await makeRequest('POST', '/admin/batches', {
      batchId: testBatchId,
      chemistry: 'Cu-PAN',
      validatedActiveLifeHours: 100
    });
    if (batchRes.status !== 201) throw new Error(`Failed to create test batch: ${JSON.stringify(batchRes.data)}`);

    // 2. Create worker and activate strip
    await makeRequest('POST', '/workers', {
      workerId: testWorkerId,
      name: 'Test Recalled Worker',
      department: 'Testing'
    });

    const actRes = await makeRequest('POST', '/strip/activate', {
      workerId: testWorkerId,
      stripId: testStripId,
      batchId: testBatchId
    });
    if (actRes.status !== 200) throw new Error(`Failed to activate strip: ${JSON.stringify(actRes.data)}`);

    // 3. Recall the batch
    const recallRes = await makeRequest('POST', `/admin/batches/${testBatchId}/recall`);
    if (recallRes.status !== 200) throw new Error(`Recall failed: ${JSON.stringify(recallRes.data)}`);

    // 4. Try scanning with the recalled strip
    const scanRes = await makeRequest('POST', '/scan', {
      workerId: testWorkerId,
      imageBase64: TEST_PNG_1X1
    });

    if (scanRes.status !== 400 || scanRes.data.error_code !== 'STRIP_RECALLED') {
      throw new Error(`Expected 400 STRIP_RECALLED, got ${scanRes.status}: ${JSON.stringify(scanRes.data)}`);
    }
  });

  // --- SECTION 6: SENSING CAPACITY EXHAUSTION BLOCKING ---

  // Test 10: Exhausted capacity strip is blocked from subsequent scanning
  await test('Exhaustion: Exhausted capacity strip is rejected with STRIP_EXHAUSTED', async () => {
    const testBatchId = `CUPAN-BATCH-CAP-${Date.now()}`;
    const testWorkerId = `W_CAP_${Date.now().toString().slice(-4)}`;
    const testStripId = `CUPAN-STRIP-CAP-${Date.now().toString().slice(-4)}`;

    // 1. Create batch with low max capacity (e.g. 5.0 ppm·h)
    await makeRequest('POST', '/admin/batches', {
      batchId: testBatchId,
      chemistry: 'Cu-PAN',
      maxValidatedDosePpmH: 5.0
    });

    await makeRequest('POST', '/workers', {
      workerId: testWorkerId,
      name: 'Test Capacity Worker',
      department: 'Testing'
    });

    await makeRequest('POST', '/strip/activate', {
      workerId: testWorkerId,
      stripId: testStripId,
      batchId: testBatchId
    });

    // 2. Perform large scan that saturates the 5.0 ppm·h capacity
    const scan1 = await makeRequest('POST', '/scan', {
      workerId: testWorkerId,
      imageBase64: TEST_PNG_1X1
    });
    if (scan1.status !== 201) throw new Error(`Scan 1 failed: ${JSON.stringify(scan1.data)}`);

    // 3. Attempt second scan on the exhausted strip -> Must be rejected with STRIP_EXHAUSTED
    const scan2 = await makeRequest('POST', '/scan', {
      workerId: testWorkerId,
      imageBase64: TEST_PNG_1X1
    });

    if (scan2.status !== 400 || (scan2.data.error_code !== 'STRIP_EXHAUSTED' && scan2.data.error_code !== 'STRIP_EXPIRED')) {
      throw new Error(`Expected 400 STRIP_EXHAUSTED, got ${scan2.status}: ${JSON.stringify(scan2.data)}`);
    }
  });

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runSecurityAndLifecycleTests().catch(console.error);
