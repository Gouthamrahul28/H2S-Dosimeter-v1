/**
 * backend/tests/test_chemistry_abstraction.js
 * 
 * Comprehensive Unit and Integration Test Suite for Phase 2: Chemistry Abstraction.
 * Validates:
 * 1. Sensor chemistry identifiers (CU_PAN, LEAD_ACETATE) and normalization.
 * 2. Centralized chemistry configuration and null states for uncalibrated Lead Acetate.
 * 3. Database models (StripBatch, Strip, Reading) chemistry field support and setters.
 * 4. Hard Isolation Rule: CU_PAN -> CU_PAN calibration allowed.
 * 5. Hard Isolation Rule: LEAD_ACETATE -> LEAD_ACETATE configuration allowed.
 * 6. Hard Isolation Rule: CU_PAN -> Lead model rejected (MODEL_CHEMISTRY_MISMATCH).
 * 7. Hard Isolation Rule: Lead -> Cu-PAN model rejected (MODEL_CHEMISTRY_MISMATCH).
 * 8. Missing Lead calibration returns explicit unavailable state (CALIBRATION_UNAVAILABLE / CALIBRATION_DATA_REQUIRED), NOT 0.0 ppm.
 * 9. Cu-PAN regression verification.
 */

const assert = require('assert');
const path = require('path');
const {
  CHEMISTRY_IDS,
  CHEMISTRY_CONFIGS,
  normalizeChemistryId,
  getChemistryConfig,
  validateModelChemistryMatch
} = require('../../shared/chemistryRegistry.cjs');

const standards = require('../../shared/colorimetricStandards.cjs');
const Strip = require('../src/models/Strip');
const StripBatch = require('../src/models/StripBatch');
const Reading = require('../src/models/Reading');
const calibrationController = require('../src/controllers/calibrationController');
const readingController = require('../src/controllers/readingController');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

// Mock Express req/res
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function main() {
  console.log('\n========================================================');
  console.log('PHASE 2 CHEMISTRY ABSTRACTION & ISOLATION TEST SUITE');
  console.log('========================================================\n');

  // -----------------------------------------------------------
  // 1. SENSOR CHEMISTRY IDENTIFIER & NORMALIZATION
  // -----------------------------------------------------------
  console.log('--- 1. Sensor Chemistry Identifiers & Normalization ---');
  
  runTest('Canonical chemistry IDs exist and match expected constants', () => {
    assert.strictEqual(CHEMISTRY_IDS.CU_PAN, 'CU_PAN');
    assert.strictEqual(CHEMISTRY_IDS.LEAD_ACETATE, 'LEAD_ACETATE');
  });

  runTest('normalizeChemistryId properly normalizes Cu-PAN variants', () => {
    assert.strictEqual(normalizeChemistryId('CU_PAN'), 'CU_PAN');
    assert.strictEqual(normalizeChemistryId('Cu-PAN'), 'CU_PAN');
    assert.strictEqual(normalizeChemistryId('cu-pan'), 'CU_PAN');
    assert.strictEqual(normalizeChemistryId('CUPAN'), 'CU_PAN');
    assert.strictEqual(normalizeChemistryId('copper_pan'), 'CU_PAN');
  });

  runTest('normalizeChemistryId properly normalizes Lead Acetate variants', () => {
    assert.strictEqual(normalizeChemistryId('LEAD_ACETATE'), 'LEAD_ACETATE');
    assert.strictEqual(normalizeChemistryId('Lead-Acetate'), 'LEAD_ACETATE');
    assert.strictEqual(normalizeChemistryId('lead_acetate'), 'LEAD_ACETATE');
    assert.strictEqual(normalizeChemistryId('LEADACETATE'), 'LEAD_ACETATE');
    assert.strictEqual(normalizeChemistryId('lead'), 'LEAD_ACETATE');
    assert.strictEqual(normalizeChemistryId('PbS'), 'LEAD_ACETATE');
  });

  runTest('normalizeChemistryId rejects unknown chemistries', () => {
    assert.strictEqual(normalizeChemistryId('unknown_chem'), null);
    assert.strictEqual(normalizeChemistryId(null), null);
    assert.strictEqual(normalizeChemistryId(undefined), null);
  });

  // -----------------------------------------------------------
  // 2. CENTRALIZED CHEMISTRY CONFIGURATION REGISTRY
  // -----------------------------------------------------------
  console.log('\n--- 2. Centralized Chemistry Configuration ---');

  runTest('CU_PAN configuration has all required metadata and validated values', () => {
    const config = getChemistryConfig('CU_PAN');
    assert.strictEqual(config.id, 'CU_PAN');
    assert.strictEqual(config.targetGas, 'H2S');
    assert.strictEqual(config.calibrationStatus, 'EXPERIMENTAL_VALIDATED');
    assert.strictEqual(config.calibrationDataset, 'CUPAN-DATA-v4');
    assert.strictEqual(config.calibrationModel, 'cupan-cielab-v1');
    assert.strictEqual(config.sensingCapacity.maxValidatedCumulativeDosePpmH, 160.0);
    assert.strictEqual(config.validatedRange.maxDosePpmH, 160.0);
    assert(config.reactionDescription.includes('Cu(II)-PAN'));
  });

  runTest('LEAD_ACETATE configuration uses explicit null/unavailable states for uncalibrated values', () => {
    const config = getChemistryConfig('LEAD_ACETATE');
    assert.strictEqual(config.id, 'LEAD_ACETATE');
    assert.strictEqual(config.targetGas, 'H2S');
    assert.strictEqual(config.calibrationStatus, 'CALIBRATION_DATA_REQUIRED');
    // Phase 4: Assigned dataset and model schemas, while preserving CALIBRATION_DATA_REQUIRED
    assert.strictEqual(config.calibrationDataset, 'LEAD_ACETATE_DATASET_V1');
    assert.strictEqual(config.calibrationModel, 'lead_acetate_model_v1');
    assert.strictEqual(config.environmentalModel, null);
    assert.strictEqual(config.validatedRange, null);
    assert.strictEqual(config.sensingCapacity, null);
    assert(config.reactionDescription.includes('Pb(CH3COO)2'));
  });

  runTest('getChemistryConfig throws on unknown chemistry', () => {
    assert.throws(() => {
      getChemistryConfig('MOCK_CHEMISTRY');
    }, /UNSUPPORTED_CHEMISTRY/);
  });

  // -----------------------------------------------------------
  // 3. DATABASE MODELS CHEMISTRY FIELD SUPPORT
  // -----------------------------------------------------------
  console.log('\n--- 3. Database Entity Chemistry Identification ---');

  runTest('StripBatch model normalizes and stores chemistry', () => {
    const batchCu = new StripBatch({ batchId: 'BATCH-CU-01', chemistry: 'Cu-PAN' });
    assert.strictEqual(batchCu.chemistry, 'CU_PAN');

    const batchLead = new StripBatch({ batchId: 'BATCH-PB-01', chemistry: 'Lead-Acetate' });
    assert.strictEqual(batchLead.chemistry, 'LEAD_ACETATE');
  });

  runTest('Strip model identifies chemistry and handles capacity cleanly', () => {
    const stripCu = new Strip({
      stripId: 'STRIP-CU-01',
      batchId: 'BATCH-CU-01',
      chemistry: 'Cu-PAN',
      maxValidatedDosePpmH: 160.0
    });
    assert.strictEqual(stripCu.chemistry, 'CU_PAN');
    const lifecycleCu = stripCu.getLifecycleStatus();
    assert.strictEqual(lifecycleCu.chemistry, 'CU_PAN');
    assert.strictEqual(lifecycleCu.maxValidatedDosePpmH, 160.0);

    const stripLead = new Strip({
      stripId: 'STRIP-PB-01',
      batchId: 'BATCH-PB-01',
      chemistry: 'Lead-Acetate',
      maxValidatedDosePpmH: null
    });
    assert.strictEqual(stripLead.chemistry, 'LEAD_ACETATE');
    const lifecycleLead = stripLead.getLifecycleStatus();
    assert.strictEqual(lifecycleLead.chemistry, 'LEAD_ACETATE');
    assert.strictEqual(lifecycleLead.maxValidatedDosePpmH, null);
    assert.strictEqual(lifecycleLead.lifeUsedPercent, null);
    assert.strictEqual(lifecycleLead.lifeRemainingPercent, null);
  });

  runTest('Reading model normalizes and stores chemistry', () => {
    const readingCu = new Reading({
      workerId: 'W001',
      shiftId: 'SHIFT_01',
      imageUrl: '/uploads/test.jpg',
      chemistry: 'Cu-PAN',
      stripColorRGB: { r: 100, g: 100, b: 100 },
      referenceColorRGB: { r: 240, g: 240, b: 240 },
      correctedColorRGB: { r: 100, g: 100, b: 100 },
      estimatedDosePpmHours: 5.0
    });
    assert.strictEqual(readingCu.chemistry, 'CU_PAN');

    const readingLead = new Reading({
      workerId: 'W001',
      shiftId: 'SHIFT_01',
      imageUrl: '/uploads/test.jpg',
      chemistry: 'Lead-Acetate',
      stripColorRGB: { r: 100, g: 100, b: 100 },
      referenceColorRGB: { r: 240, g: 240, b: 240 },
      correctedColorRGB: { r: 100, g: 100, b: 100 },
      estimatedDosePpmHours: 0.0
    });
    assert.strictEqual(readingLead.chemistry, 'LEAD_ACETATE');
  });

  // -----------------------------------------------------------
  // 4. HARD ISOLATION RULES
  // -----------------------------------------------------------
  console.log('\n--- 4. Hard Isolation Rules & Cross-Chemistry Validation ---');

  runTest('CU_PAN -> CU_PAN model pairing passes validation', () => {
    const res = validateModelChemistryMatch('CU_PAN', 'CU_PAN');
    assert.strictEqual(res.valid, true);
  });

  runTest('LEAD_ACETATE -> LEAD_ACETATE model pairing passes validation', () => {
    const res = validateModelChemistryMatch('LEAD_ACETATE', 'LEAD_ACETATE');
    assert.strictEqual(res.valid, true);
  });

  runTest('CU_PAN sensor -> LEAD_ACETATE model is strictly REJECTED', () => {
    const res = validateModelChemistryMatch('CU_PAN', 'LEAD_ACETATE');
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'MODEL_CHEMISTRY_MISMATCH');
    assert(res.error.includes('HARD ISOLATION VIOLATION'));
  });

  runTest('LEAD_ACETATE sensor -> CU_PAN model is strictly REJECTED', () => {
    const res = validateModelChemistryMatch('LEAD_ACETATE', 'CU_PAN');
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.errorCode, 'MODEL_CHEMISTRY_MISMATCH');
    assert(res.error.includes('HARD ISOLATION VIOLATION'));
  });

  // -----------------------------------------------------------
  // 5. CALIBRATION CONTROLLER API TESTS
  // -----------------------------------------------------------
  console.log('\n--- 5. Calibration Controller Endpoints ---');

  await runAsyncTest('GET /api/v1/calibration/chemistries lists all authoritative chemistries', async () => {
    const req = {};
    const res = createMockRes();
    await calibrationController.getRegisteredChemistries(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    assert(Array.isArray(res.body.chemistries));
    const ids = res.body.chemistries.map(c => c.id);
    assert(ids.includes('CU_PAN'));
    assert(ids.includes('LEAD_ACETATE'));
  });

  await runAsyncTest('GET /api/v1/calibration/profile?chemistry=CU_PAN returns calibrated Cu-PAN profile', async () => {
    const req = { query: { chemistry: 'CU_PAN' } };
    const res = createMockRes();
    await calibrationController.getCalibrationProfile(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.chemistry, 'CU_PAN');
    assert.strictEqual(res.body.calibrationStatus, 'EXPERIMENTAL_VALIDATED');
    assert.strictEqual(res.body.calibrationModel, 'cupan-cielab-v1');
    assert(Array.isArray(res.body.points));
    assert(res.body.points.length > 0);
  });

  await runAsyncTest('GET /api/v1/calibration/profile?chemistry=LEAD_ACETATE returns uncalibrated status', async () => {
    const req = { query: { chemistry: 'LEAD_ACETATE' } };
    const res = createMockRes();
    await calibrationController.getCalibrationProfile(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.chemistry, 'LEAD_ACETATE');
    assert.strictEqual(res.body.calibrationStatus, 'CALIBRATION_DATA_REQUIRED');
    assert.strictEqual(res.body.calibrationDataset, 'LEAD_ACETATE_DATASET_V1');
    assert.strictEqual(res.body.calibrationModel, 'lead_acetate_model_v1');
    assert.strictEqual(res.body.isCalibrated, false);
  });

  await runAsyncTest('POST /api/v1/calibration/cupan rejects Lead-Acetate sample points', async () => {
    const req = {
      body: {
        chemistry: 'Lead-Acetate',
        sample_id: 'TEST_PB_01',
        dose_ppm_min: 10.0
      }
    };
    const res = createMockRes();
    await calibrationController.recordCuPANCalibration(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error_code, 'MODEL_CHEMISTRY_MISMATCH');
  });

  // -----------------------------------------------------------
  // 6. READING CONTROLLER ISOLATION & UNCALIBRATED STATE
  // -----------------------------------------------------------
  console.log('\n--- 6. Reading Pipeline Chemistry Routing & Isolation ---');

  await runAsyncTest('Lead Acetate scan returns HTTP 422 CALIBRATION_UNAVAILABLE, NOT 0.0 ppm', async () => {
    // Mock Worker & Strip where assigned strip has chemistry LEAD_ACETATE
    const mockWorker = { workerId: 'W001', name: 'Test Worker', status: 'ACTIVE' };
    const mockStrip = new Strip({
      stripId: 'STRIP-PB-001',
      batchId: 'BATCH-PB-001',
      chemistry: 'LEAD_ACETATE',
      workerId: 'W001',
      status: 'ACTIVE',
      stripStatus: 'GOOD',
      cumulativeDosePpmH: 0.0,
      maxValidatedDosePpmH: null,
      save: async function() {}
    });

    // Mock Worker, Strip and StripBatch findOne
    const Worker = require('../src/models/Worker');
    const origWorkerFindOne = Worker.findOne;
    const origStripFindOne = Strip.findOne;
    const origBatchFindOne = StripBatch.findOne;

    Worker.findOne = async () => mockWorker;
    Strip.findOne = async () => mockStrip;
    StripBatch.findOne = async () => ({ batchId: 'BATCH-PB-001', chemistry: 'LEAD_ACETATE', status: 'RELEASED' });

    try {
      const req = {
        params: {},
        body: {
          workerId: 'W001',
          shiftId: 'SHIFT_01',
          imageBase64: 'data:image/jpeg;base64,dGVzdA=='
        }
      };
      const res = createMockRes();
      await readingController.createReading(req, res);

      assert.strictEqual(res.statusCode, 422);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error_code, 'CALIBRATION_UNAVAILABLE');
      assert.strictEqual(res.body.calibration_status, 'CALIBRATION_DATA_REQUIRED');
      assert.strictEqual(res.body.chemistry, 'LEAD_ACETATE');
      // Crucial verification: NO 0.0 ppm dose is fabricated
      assert.strictEqual(res.body.dose, undefined);
    } finally {
      Worker.findOne = origWorkerFindOne;
      Strip.findOne = origStripFindOne;
      StripBatch.findOne = origBatchFindOne;
    }
  });

  await runAsyncTest('Cu-PAN strip requesting LEAD_ACETATE model returns HTTP 400 MODEL_CHEMISTRY_MISMATCH', async () => {
    const mockWorker = { workerId: 'W002', name: 'Test Worker 2', status: 'ACTIVE' };
    const mockStrip = new Strip({
      stripId: 'STRIP-CU-002',
      batchId: 'BATCH-CU-001',
      chemistry: 'CU_PAN',
      workerId: 'W002',
      status: 'ACTIVE',
      stripStatus: 'GOOD',
      cumulativeDosePpmH: 0.0,
      maxValidatedDosePpmH: 160.0,
      save: async function() {}
    });

    const Worker = require('../src/models/Worker');
    const origWorkerFindOne = Worker.findOne;
    const origStripFindOne = Strip.findOne;
    const origBatchFindOne = StripBatch.findOne;

    Worker.findOne = async () => mockWorker;
    Strip.findOne = async () => mockStrip;
    StripBatch.findOne = async () => ({ batchId: 'BATCH-CU-001', chemistry: 'CU_PAN', status: 'RELEASED' });

    try {
      const req = {
        params: {},
        body: {
          workerId: 'W002',
          shiftId: 'SHIFT_01',
          model_chemistry: 'LEAD_ACETATE',
          imageBase64: 'data:image/jpeg;base64,dGVzdA=='
        }
      };
      const res = createMockRes();
      await readingController.createReading(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error_code, 'MODEL_CHEMISTRY_MISMATCH');
      assert.strictEqual(res.body.calibration_status, 'MODEL_CHEMISTRY_MISMATCH');
    } finally {
      Worker.findOne = origWorkerFindOne;
      Strip.findOne = origStripFindOne;
      StripBatch.findOne = origBatchFindOne;
    }
  });

  await runAsyncTest('Lead-Acetate strip requesting CU_PAN model returns HTTP 400 MODEL_CHEMISTRY_MISMATCH', async () => {
    const mockWorker = { workerId: 'W003', name: 'Test Worker 3', status: 'ACTIVE' };
    const mockStrip = new Strip({
      stripId: 'STRIP-PB-003',
      batchId: 'BATCH-PB-001',
      chemistry: 'LEAD_ACETATE',
      workerId: 'W003',
      status: 'ACTIVE',
      stripStatus: 'GOOD',
      cumulativeDosePpmH: 0.0,
      maxValidatedDosePpmH: null,
      save: async function() {}
    });

    const Worker = require('../src/models/Worker');
    const origWorkerFindOne = Worker.findOne;
    const origStripFindOne = Strip.findOne;
    const origBatchFindOne = StripBatch.findOne;

    Worker.findOne = async () => mockWorker;
    Strip.findOne = async () => mockStrip;
    StripBatch.findOne = async () => ({ batchId: 'BATCH-PB-001', chemistry: 'LEAD_ACETATE', status: 'RELEASED' });

    try {
      const req = {
        params: {},
        body: {
          workerId: 'W003',
          shiftId: 'SHIFT_01',
          model_chemistry: 'CU_PAN',
          imageBase64: 'data:image/jpeg;base64,dGVzdA=='
        }
      };
      const res = createMockRes();
      await readingController.createReading(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.success, false);
      assert.strictEqual(res.body.error_code, 'MODEL_CHEMISTRY_MISMATCH');
      assert.strictEqual(res.body.calibration_status, 'MODEL_CHEMISTRY_MISMATCH');
    } finally {
      Worker.findOne = origWorkerFindOne;
      Strip.findOne = origStripFindOne;
      StripBatch.findOne = origBatchFindOne;
    }
  });

  // -----------------------------------------------------------
  // 7. CU-PAN REGRESSION VERIFICATION
  // -----------------------------------------------------------
  console.log('\n--- 7. Cu-PAN Regression Tests ---');

  runTest('Cu-PAN virgin baseline coordinates are unchanged', () => {
    assert.strictEqual(standards.VIRGIN_BASELINE_LAB.L, 42.50);
    assert.strictEqual(standards.VIRGIN_BASELINE_LAB.a, 38.20);
    assert.strictEqual(standards.VIRGIN_BASELINE_LAB.b, -28.40);
  });

  runTest('Cu-PAN virgin RGB yields 0.0 ppm·h with SAFE alert level', () => {
    // Virgin RGB (139, 76, 148)
    const analysis = standards.analyzeExposure({ r: 139, g: 76, b: 148 }, 25.0, 50.0);
    assert.strictEqual(analysis.estimatedDosePpmHours, 0.0);
    assert.strictEqual(analysis.alertLevel, 'SAFE');
    assert.strictEqual(analysis.inRange, true);
  });

  runTest('Cu-PAN exposed RGB yields expected progressive dose', () => {
    // Highly exposed (Yellow-Orange)
    const analysis = standards.analyzeExposure({ r: 215, g: 175, b: 40 }, 25.0, 50.0);
    assert(analysis.estimatedDosePpmHours > 10.0, `Expected dose > 10, got ${analysis.estimatedDosePpmHours}`);
    assert(analysis.deltaE00 > 20.0, `Expected deltaE00 > 20, got ${analysis.deltaE00}`);
  });

  console.log('\n========================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('\nTest Suite execution failed:', err);
  process.exit(1);
});
