/**
 * backend/tests/test_lead_acetate_calibration.js
 * 
 * Comprehensive Unit & Integration Test Suite for Phase 4:
 * Lead Acetate (Pb(OAc)₂) H₂S Calibration System & Model Framework.
 * 
 * Strict Scientific & Architectural Rules:
 * 1. Zero data fabrication: Initialized as CALIBRATION_DATA_REQUIRED when no experimental data exists.
 * 2. Dataset schema supports all 17 required fields.
 * 3. Data type strict isolation (EXPERIMENTAL, SYNTHETIC, TEST - never mixed).
 * 4. Abstract calibration model interface compliance (fit, predict, validate, getMetadata, getVersion, getSupportedRange).
 * 5. Model separation: lead_acetate_model_v1 isolated; Cu-PAN untouched.
 * 6. Hard isolation: Cross-chemistry mismatch detection.
 * 7. Explicit typed states: VALID_ESTIMATE, BELOW_CALIBRATION_RANGE, ABOVE_CALIBRATION_RANGE,
 *    CALIBRATION_UNAVAILABLE, MODEL_UNAVAILABLE, MODEL_CHEMISTRY_MISMATCH, PREDICTION_FAILED.
 *    STRICT: Never return 0.0 ppm as an error state.
 * 8. Test fixtures marked strictly data_type = 'TEST'.
 */

const assert = require('assert');
const {
  CHEMISTRY_IDS,
  normalizeChemistryId,
  getChemistryConfig,
  validateModelChemistryMatch
} = require('../../shared/chemistryRegistry.cjs');

const {
  CALIBRATION_STATES,
  ALLOWED_DATA_TYPES,
  BaseCalibrationModel,
  LeadAcetateModelV1,
  LeadAcetateDatasetV1,
  LeadAcetateModelRegistry,
  leadAcetateModelRegistry,
  createTestPlumbingDataset
} = require('../src/services/leadAcetateCalibrationService');

const calibrationController = require('../src/controllers/calibrationController');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function runAllTests() {

console.log('================================================================');
console.log('PHASE 4: LEAD ACETATE CALIBRATION SYSTEM TEST SUITE');
console.log('================================================================\n');

// -------------------------------------------------------------
// SECTION 1: DATASET SCHEMA & 17 REQUIRED FIELDS
// -------------------------------------------------------------
console.log('--- 1. Lead Acetate Dataset Schema & Field Completeness ---');

runTest('Dataset instantiates with LEAD_ACETATE_DATASET_V1 identifier and CALIBRATION_DATA_REQUIRED status', () => {
  const ds = new LeadAcetateDatasetV1('EXPERIMENTAL');
  assert.strictEqual(ds.dataset_id, 'LEAD_ACETATE_DATASET_V1');
  assert.strictEqual(ds.dataset_version, 'LEAD_ACETATE_DATASET_V1');
  assert.strictEqual(ds.sensor_chemistry, 'LEAD_ACETATE');
  assert.strictEqual(ds.data_type, 'EXPERIMENTAL');
  assert.strictEqual(ds.status, 'CALIBRATION_DATA_REQUIRED');
  assert.strictEqual(ds.getSampleCount(), 0);
});

runTest('Sample accepts and verifies all 17 required/supported fields', () => {
  const ds = new LeadAcetateDatasetV1('TEST');
  const sampleInput = {
    sample_id: 'SAMPLE_TEST_001',
    sensor_chemistry: 'LEAD_ACETATE',
    strip_id: 'STRIP_PB_001',
    strip_batch: 'BATCH_PB_01',
    exposure_concentration: 25.0,
    exposure_duration: 60.0,
    reference_dose: 25.0,
    temperature: 24.5,
    humidity: 52.0,
    RGB: { r: 180, g: 155, b: 130 },
    Lab: { L: 65.2, a: 4.8, b: 14.1 },
    deltaE00: 22.4,
    image_reference: 's3://calibration/samples/pb_001.png',
    quality_score: 97.5,
    data_type: 'TEST',
    dataset_version: 'LEAD_ACETATE_DATASET_V1',
    created_at: '2026-09-04T12:00:00Z'
  };

  const added = ds.addSample(sampleInput);

  assert.strictEqual(added.sample_id, 'SAMPLE_TEST_001');
  assert.strictEqual(added.sensor_chemistry, 'LEAD_ACETATE');
  assert.strictEqual(added.strip_id, 'STRIP_PB_001');
  assert.strictEqual(added.strip_batch, 'BATCH_PB_01');
  assert.strictEqual(added.exposure_concentration, 25.0);
  assert.strictEqual(added.exposure_duration, 60.0);
  assert.strictEqual(added.reference_dose, 25.0);
  assert.strictEqual(added.temperature, 24.5);
  assert.strictEqual(added.humidity, 52.0);
  assert.deepStrictEqual(added.RGB, { r: 180, g: 155, b: 130 });
  assert.deepStrictEqual(added.Lab, { L: 65.2, a: 4.8, b: 14.1 });
  assert.strictEqual(added.deltaE00, 22.4);
  assert.strictEqual(added.image_reference, 's3://calibration/samples/pb_001.png');
  assert.strictEqual(added.quality_score, 97.5);
  assert.strictEqual(added.data_type, 'TEST');
  assert.strictEqual(added.dataset_version, 'LEAD_ACETATE_DATASET_V1');
  assert.strictEqual(added.created_at, '2026-09-04T12:00:00Z');
  assert.strictEqual(ds.getSampleCount(), 1);
});

runTest('Rejects sample missing required fields', () => {
  const ds = new LeadAcetateDatasetV1('EXPERIMENTAL');
  assert.throws(() => {
    ds.addSample({
      sample_id: 'INCOMPLETE_SAMPLE',
      sensor_chemistry: 'LEAD_ACETATE'
      // missing exposure, dose, rgb, lab, etc.
    });
  }, /MISSING_FIELD/);
});

// -------------------------------------------------------------
// SECTION 2: DATA TYPE STRICT ISOLATION (EXPERIMENTAL, SYNTHETIC, TEST)
// -------------------------------------------------------------
console.log('\n--- 2. Data Type Strict Isolation ---');

runTest('Enforces allowed data types: EXPERIMENTAL, SYNTHETIC, TEST', () => {
  assert.doesNotThrow(() => new LeadAcetateDatasetV1('EXPERIMENTAL'));
  assert.doesNotThrow(() => new LeadAcetateDatasetV1('SYNTHETIC'));
  assert.doesNotThrow(() => new LeadAcetateDatasetV1('TEST'));

  assert.throws(() => {
    new LeadAcetateDatasetV1('FABRICATED_DATA');
  }, /INVALID_DATA_TYPE/);
});

runTest('Strictly prohibits mixing data types within a dataset', () => {
  const expDataset = new LeadAcetateDatasetV1('EXPERIMENTAL');
  
  const testSample = {
    sample_id: 'SAMPLE_TEST_MIX',
    sensor_chemistry: 'LEAD_ACETATE',
    exposure_concentration: 10.0,
    exposure_duration: 30.0,
    reference_dose: 5.0,
    temperature: 25.0,
    humidity: 50.0,
    RGB: { r: 200, g: 190, b: 180 },
    Lab: { L: 80.0, a: 1.0, b: 5.0 },
    data_type: 'TEST' // Intentionally mismatching EXPERIMENTAL dataset
  };

  assert.throws(() => {
    expDataset.addSample(testSample);
  }, /DATA_TYPE_MISMATCH/);
});

// -------------------------------------------------------------
// SECTION 3: EXPERIMENTAL DATA INTEGRITY (ZERO FABRICATION)
// -------------------------------------------------------------
console.log('\n--- 3. Experimental Data Integrity (Zero Fabrication) ---');

runTest('Initial Lead Acetate model reports CALIBRATION_DATA_REQUIRED', () => {
  const model = new LeadAcetateModelV1();
  assert.strictEqual(model.isFitted, false);
  assert.strictEqual(model.status, 'CALIBRATION_DATA_REQUIRED');
  assert.strictEqual(model.supportedRange, null);
  assert.strictEqual(model.fittedParameters, null);
});

runTest('Uncalibrated model prediction returns CALIBRATION_UNAVAILABLE and null dose (NEVER 0.0 ppm)', () => {
  const uncalibratedModel = new LeadAcetateModelV1();
  const prediction = uncalibratedModel.predict({
    sensor_chemistry: 'LEAD_ACETATE',
    L: 82.5,
    deltaE00: 12.4,
    temperature: 25.0,
    humidity: 50.0
  });

  assert.strictEqual(prediction.status, CALIBRATION_STATES.CALIBRATION_UNAVAILABLE);
  assert.strictEqual(prediction.dosePpmHours, null); // CRITICAL NON-NEGOTIABLE RULE
  assert.notStrictEqual(prediction.dosePpmHours, 0.0); // Never return 0.0 ppm as uncalibrated state
  assert.strictEqual(prediction.isCalibratedDomain, false);
  assert.strictEqual(prediction.confidence, 0.0);
  assert.ok(prediction.error.includes('Lead Acetate calibration is unavailable'));
});

// -------------------------------------------------------------
// SECTION 4: MODEL INPUT FLEXIBILITY (MEASURABLE FEATURES)
// -------------------------------------------------------------
console.log('\n--- 4. Measurable Features Support ---');

runTest('Supports prediction with only deltaE00 when fitted', () => {
  const model = new LeadAcetateModelV1();
  const testFixture = createTestPlumbingDataset();
  model.fit(testFixture);

  // Predict with only deltaE00 (no L, a, b specified)
  const pred = model.predict({
    sensor_chemistry: 'LEAD_ACETATE',
    deltaE00: 25.0,
    temperature: 25.0,
    humidity: 50.0
  });

  assert.strictEqual(pred.status, CALIBRATION_STATES.VALID_ESTIMATE);
  assert.ok(pred.dosePpmHours > 10.0 && pred.dosePpmHours < 40.0);
  assert.strictEqual(pred.isCalibratedDomain, true);
  assert.strictEqual(pred.dataType, 'TEST');
});

runTest('Supports prediction with only L* coordinate when fitted', () => {
  const model = new LeadAcetateModelV1();
  const testFixture = createTestPlumbingDataset();
  model.fit(testFixture);

  // For Lead Acetate: L* decreases as darkening occurs (L=60 is between anchor 10ppm*h [L=72.4] and 40ppm*h [L=46.2])
  const pred = model.predict({
    sensor_chemistry: 'LEAD_ACETATE',
    L: 60.0
  });

  assert.strictEqual(pred.status, CALIBRATION_STATES.VALID_ESTIMATE);
  assert.ok(pred.dosePpmHours > 10.0 && pred.dosePpmHours < 40.0);
  assert.strictEqual(pred.isCalibratedDomain, true);
});

runTest('Rejects input missing all optical features', () => {
  const model = new LeadAcetateModelV1();
  const testFixture = createTestPlumbingDataset();
  model.fit(testFixture);

  const pred = model.predict({
    sensor_chemistry: 'LEAD_ACETATE',
    temperature: 25.0,
    humidity: 50.0
    // Missing both deltaE00 and L*
  });

  assert.strictEqual(pred.status, CALIBRATION_STATES.PREDICTION_FAILED);
  assert.strictEqual(pred.dosePpmHours, null);
});

// -------------------------------------------------------------
// SECTION 5: ABSTRACT CALIBRATION MODEL INTERFACE COMPLIANCE
// -------------------------------------------------------------
console.log('\n--- 5. Abstract Model Interface Compliance ---');

runTest('Abstract BaseCalibrationModel cannot be instantiated directly', () => {
  assert.throws(() => {
    new BaseCalibrationModel('test', 'LEAD_ACETATE', '1.0.0');
  }, /Cannot construct abstract BaseCalibrationModel directly/);
});

runTest('LeadAcetateModelV1 implements all required interface methods', () => {
  const model = new LeadAcetateModelV1();
  assert.strictEqual(typeof model.fit, 'function');
  assert.strictEqual(typeof model.predict, 'function');
  assert.strictEqual(typeof model.validate, 'function');
  assert.strictEqual(typeof model.getMetadata, 'function');
  assert.strictEqual(typeof model.getVersion, 'function');
  assert.strictEqual(typeof model.getSupportedRange, 'function');

  assert.strictEqual(model.getVersion(), '1.0.0');
  assert.strictEqual(model.name, 'lead_acetate_model_v1');
});

// -------------------------------------------------------------
// SECTION 6: MODEL SEPARATION & HARD ISOLATION
// -------------------------------------------------------------
console.log('\n--- 6. Model Separation & Chemistry Isolation ---');

runTest('Lead Acetate model explicitly rejects CU_PAN input (MODEL_CHEMISTRY_MISMATCH)', () => {
  const model = new LeadAcetateModelV1();
  const testFixture = createTestPlumbingDataset();
  model.fit(testFixture);

  const pred = model.predict({
    sensor_chemistry: 'CU_PAN', // Cross-chemistry injection attempt
    deltaE00: 20.0
  });

  assert.strictEqual(pred.status, CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH);
  assert.strictEqual(pred.dosePpmHours, null);
  assert.ok(pred.error.includes('Cannot execute LEAD_ACETATE calibration model on a CU_PAN sensor strip'));
});

runTest('Cannot fit Lead Acetate model with Cu-PAN dataset', () => {
  const model = new LeadAcetateModelV1();
  assert.throws(() => {
    model.fit({
      sensor_chemistry: 'CU_PAN',
      data_type: 'TEST',
      samples: [
        { reference_dose: 0, deltaE00: 0 },
        { reference_dose: 50, deltaE00: 25 },
        { reference_dose: 100, deltaE00: 50 }
      ]
    });
  }, /MODEL_CHEMISTRY_MISMATCH/);
});

// -------------------------------------------------------------
// SECTION 7: EXPLICIT TYPED CALIBRATION STATES & OUT-OF-BOUNDS HANDLING
// -------------------------------------------------------------
console.log('\n--- 7. Explicit Output States & Out-of-Bounds Behavior ---');

runTest('Predicts BELOW_CALIBRATION_RANGE when deltaE00 is below minimum anchor', () => {
  const model = new LeadAcetateModelV1();
  model.fit(createTestPlumbingDataset());

  const pred = model.predict({
    sensor_chemistry: 'LEAD_ACETATE',
    deltaE00: -2.0 // Below lowest anchor (0.0)
  });

  assert.strictEqual(pred.status, CALIBRATION_STATES.BELOW_CALIBRATION_RANGE);
  assert.strictEqual(pred.isCalibratedDomain, false);
});

runTest('Predicts ABOVE_CALIBRATION_RANGE when deltaE00 exceeds maximum anchor', () => {
  const model = new LeadAcetateModelV1();
  model.fit(createTestPlumbingDataset());

  const pred = model.predict({
    sensor_chemistry: 'LEAD_ACETATE',
    deltaE00: 95.0 // Above highest anchor (55.4)
  });

  assert.strictEqual(pred.status, CALIBRATION_STATES.ABOVE_CALIBRATION_RANGE);
  assert.strictEqual(pred.isCalibratedDomain, false);
});

// -------------------------------------------------------------
// SECTION 8: TEST MODEL PLUMBING WIRING
// -------------------------------------------------------------
console.log('\n--- 8. Test Model Plumbing Wiring Verification ---');

runTest('createTestPlumbingDataset creates valid fixtures strictly marked data_type = TEST', () => {
  const fixture = createTestPlumbingDataset();
  assert.strictEqual(fixture.data_type, 'TEST');
  assert.strictEqual(fixture.getSampleCount(), 4);

  for (const sample of fixture.samples) {
    assert.strictEqual(sample.data_type, 'TEST');
    assert.strictEqual(sample.sensor_chemistry, 'LEAD_ACETATE');
  }
});

runTest('Model fitted with test plumbing demonstrates physical darkening (L decreases as dose increases)', () => {
  const fixture = createTestPlumbingDataset();
  const sorted = [...fixture.samples].sort((a, b) => a.reference_dose - b.reference_dose);

  for (let i = 0; i < sorted.length - 1; i++) {
    const s1 = sorted[i];
    const s2 = sorted[i + 1];
    assert.ok(s2.reference_dose > s1.reference_dose, 'Dose must strictly increase');
    assert.ok(s2.Lab.L < s1.Lab.L, `L* must monotonically decrease (darkening) for Lead Acetate (dose ${s1.reference_dose}->${s2.reference_dose}, L ${s1.Lab.L}->${s2.Lab.L})`);
    assert.ok(s2.deltaE00 > s1.deltaE00, 'deltaE00 must monotonically increase');
  }
});

// -------------------------------------------------------------
// SECTION 9: API CONTROLLER INTEGRATION
// -------------------------------------------------------------
  console.log('\n--- 9. Calibration API Controller Integration ---');

  await runAsyncTest('GET /api/v1/calibration/profile for Lead Acetate reports CALIBRATION_DATA_REQUIRED', async () => {
    const req = { query: { chemistry: 'LEAD_ACETATE' } };
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await calibrationController.getCalibrationProfile(req, res);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.chemistry, 'LEAD_ACETATE');
    assert.strictEqual(responseData.calibrationStatus, 'CALIBRATION_DATA_REQUIRED');
    assert.strictEqual(responseData.calibrationDataset, 'LEAD_ACETATE_DATASET_V1');
    assert.strictEqual(responseData.calibrationModel, 'lead_acetate_model_v1');
  });

  await runAsyncTest('POST /api/v1/calibration/lead-acetate/sample validates and accepts valid sample', async () => {
    const samplePayload = {
      sample_id: 'SAMPLE_API_TEST_01',
      sensor_chemistry: 'LEAD_ACETATE',
      exposure_concentration: 15.0,
      exposure_duration: 60.0,
      reference_dose: 15.0,
      temperature: 25.0,
      humidity: 50.0,
      RGB: { r: 170, g: 145, b: 120 },
      Lab: { L: 60.5, a: 5.2, b: 13.7 },
      deltaE00: 25.0,
      data_type: 'TEST'
    };

    const req = { body: samplePayload };
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await calibrationController.recordLeadAcetateSample(req, res);

    assert.strictEqual(statusCode, 201);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.sample_id, 'SAMPLE_API_TEST_01');
    assert.strictEqual(responseData.data_type, 'TEST');
  });

  await runAsyncTest('POST /api/v1/calibration/lead-acetate/sample rejects chemistry mismatch', async () => {
    const req = {
      body: {
        sample_id: 'SAMPLE_MISMATCH',
        sensor_chemistry: 'CU_PAN', // Invalid for Lead Acetate endpoint
        data_type: 'TEST'
      }
    };
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await calibrationController.recordLeadAcetateSample(req, res);

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.success, false);
    assert.strictEqual(responseData.error_code, CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH);
  });

  await runAsyncTest('POST /api/v1/calibration/lead-acetate/predict returns 422 CALIBRATION_UNAVAILABLE when uncalibrated', async () => {
    const req = {
      body: {
        sensor_chemistry: 'LEAD_ACETATE',
        deltaE00: 20.0
      }
    };
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await calibrationController.predictLeadAcetateExposure(req, res);

    assert.strictEqual(statusCode, 422);
    assert.strictEqual(responseData.success, false);
    assert.strictEqual(responseData.status, CALIBRATION_STATES.CALIBRATION_UNAVAILABLE);
    assert.strictEqual(responseData.dosePpmHours, null); // CRITICAL: Not 0.0 ppm
  });

  await runAsyncTest('POST /api/v1/calibration/lead-acetate/fit-test-fixture wires test model and predicts VALID_ESTIMATE', async () => {
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    // 1. Fit test fixture
    await calibrationController.loadTestPlumbingFixture({}, res);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.model_metadata.dataType, 'TEST');

    // 2. Predict with test model
    const predictReq = {
      body: {
        sensor_chemistry: 'LEAD_ACETATE',
        deltaE00: 25.0
      }
    };
    await calibrationController.predictLeadAcetateExposure(predictReq, res);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.status, CALIBRATION_STATES.VALID_ESTIMATE);
    assert.ok(responseData.dosePpmHours > 10 && responseData.dosePpmHours < 40);
    assert.strictEqual(responseData.dataType, 'TEST');

    // 3. Reset back to uncalibrated
    await calibrationController.resetLeadAcetateCalibration({}, res);
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.model_metadata.status, 'CALIBRATION_DATA_REQUIRED');
  });

  // -------------------------------------------------------------
  // SECTION 10: PHASE 5 MODEL REGRESSION TEST SUITE
  // -------------------------------------------------------------
  console.log('\n--- 10. Phase 5 Model Regression Suite ---');

  runTest('Model validate() rejects NaN inputs (PREDICTION_FAILED, null dose)', () => {
    const model = new LeadAcetateModelV1();
    model.fit(createTestPlumbingDataset());

    const pred = model.predict({
      sensor_chemistry: 'LEAD_ACETATE',
      deltaE00: NaN,
      temperature: 25.0,
      humidity: 50.0
    });

    assert.strictEqual(pred.status, CALIBRATION_STATES.PREDICTION_FAILED);
    assert.strictEqual(pred.dosePpmHours, null);
    assert.ok(pred.error.includes('NaN or non-finite'));
  });

  runTest('Model validate() rejects non-finite Inf inputs (PREDICTION_FAILED, null dose)', () => {
    const model = new LeadAcetateModelV1();
    model.fit(createTestPlumbingDataset());

    const pred = model.predict({
      sensor_chemistry: 'LEAD_ACETATE',
      deltaE00: 25.0,
      temperature: Infinity
    });

    assert.strictEqual(pred.status, CALIBRATION_STATES.PREDICTION_FAILED);
    assert.strictEqual(pred.dosePpmHours, null);
  });

  runTest('Missing environmental feature operates with nominal fallback and warning', () => {
    const model = new LeadAcetateModelV1();
    model.fit(createTestPlumbingDataset());

    const pred = model.predict({
      sensor_chemistry: 'LEAD_ACETATE',
      deltaE00: 20.0
      // temperature and humidity missing
    });

    assert.strictEqual(pred.status, CALIBRATION_STATES.VALID_ESTIMATE);
    assert.ok(pred.dosePpmHours > 0);
    assert.ok(pred.warning.includes('Environmental parameters missing'));
  });

  runTest('Out of range input returns OUTSIDE_CALIBRATION_RANGE warning and isCalibratedDomain false', () => {
    const model = new LeadAcetateModelV1();
    model.fit(createTestPlumbingDataset());

    const pred = model.predict({
      sensor_chemistry: 'LEAD_ACETATE',
      deltaE00: 95.0 // Above max anchor (55.4)
    });

    assert.strictEqual(pred.status, CALIBRATION_STATES.ABOVE_CALIBRATION_RANGE);
    assert.strictEqual(pred.isCalibratedDomain, false);
    assert.ok(pred.warning.includes('OUTSIDE_CALIBRATION_RANGE'));
  });

  runTest('Model metadata schema stores all 10 Phase 5 versioning fields', () => {
    const model = new LeadAcetateModelV1();
    model.fit(createTestPlumbingDataset());

    const meta = model.getMetadata();
    const requiredFields = [
      'model_id', 'chemistry', 'dataset_version', 'model_version',
      'features', 'training_date', 'metrics', 'training_sample_count',
      'supported_range', 'model_artifact_reference'
    ];

    for (const field of requiredFields) {
      assert.ok(meta[field] !== undefined, `Missing versioning field '${field}'`);
    }

    assert.strictEqual(meta.chemistry, 'LEAD_ACETATE');
    assert.strictEqual(typeof meta.metrics.r2, 'number');
    assert.strictEqual(typeof meta.metrics.mae, 'number');
    assert.strictEqual(typeof meta.metrics.rmse, 'number');
  });

  runTest('LeadAcetateModelRegistry enforces chemistry matching and loads version', () => {
    const registry = new LeadAcetateModelRegistry();

    // 1. Valid load
    const loadSuccess = registry.loadModel('LEAD_ACETATE', '1.0.0');
    assert.strictEqual(loadSuccess.success, true);
    assert.strictEqual(loadSuccess.metadata.chemistry, 'LEAD_ACETATE');

    // 2. Chemistry mismatch rejection
    const loadMismatch = registry.loadModel('CU_PAN', '1.0.0');
    assert.strictEqual(loadMismatch.success, false);
    assert.strictEqual(loadMismatch.error_code, CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH);

    // 3. Unknown chemistry
    const loadUnknown = registry.loadModel('UNKNOWN_CHEM', '1.0.0');
    assert.strictEqual(loadUnknown.success, false);
    assert.strictEqual(loadUnknown.error_code, CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH);
  });

  await runAsyncTest('GET /api/v1/calibration/models/:chemistry/:version endpoint routes dynamically', async () => {
    const req = {
      params: {
        chemistry: 'LEAD_ACETATE',
        version: '1.0.0'
      }
    };
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await calibrationController.getModelByChemistryAndVersion(req, res);

    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.success, true);
    assert.strictEqual(responseData.chemistry, 'LEAD_ACETATE');
    assert.strictEqual(responseData.status, 'CALIBRATION_DATA_REQUIRED');
  });

  await runAsyncTest('GET /api/v1/calibration/models/:chemistry/:version rejects wrong chemistry', async () => {
    const req = {
      params: {
        chemistry: 'MOCK_CHEM',
        version: '1.0.0'
      }
    };
    let statusCode = null;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { responseData = data; }
        };
      }
    };

    await calibrationController.getModelByChemistryAndVersion(req, res);

    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.success, false);
    assert.strictEqual(responseData.error_code, 'INVALID_SENSOR_CHEMISTRY');
  });

  console.log('\n================================================================');
  console.log(`PHASE 4 TEST SUMMARY: ${passedTests}/${totalTests} tests passed`);
  console.log('================================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled error during test run:', err);
  process.exit(1);
});
