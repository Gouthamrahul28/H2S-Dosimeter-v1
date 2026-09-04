/**
 * backend/tests/test_phase6_phase7_node.js
 *
 * Phase 6 & Phase 7 Verification Suite for Node.js Backend:
 * - Phase 6: Zero ppm investigation, virgin baseline verification (0.0 vs null),
 *   graceful alert level handling for uncalibrated / error readings.
 * - Phase 7: Real Lead Acetate experimental dataset loading, model fitting,
 *   monotonic darkening verification, and prediction accuracy.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const {
  estimateDoseFromDeltaE,
  ppmToAlertLevel,
  calculateDeltaE00,
  VIRGIN_BASELINE_LAB
} = require('../../shared/colorimetricStandards');

const {
  CHEMISTRY_IDS,
  getChemistryConfig
} = require('../../shared/chemistryRegistry.cjs');

const Reading = require('../src/models/Reading');

const {
  LeadAcetateModelV1,
  loadExperimentalDataset,
  fitExperimentalModel
} = require('../src/services/leadAcetateCalibrationService');

let totalTests = 0;
let passedTests = 0;

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

async function main() {
  console.log('\n========================================================');
  console.log('PHASE 6 & PHASE 7 NODE.JS BACKEND VERIFICATION SUITE');
  console.log('========================================================\n');

  console.log('--- 1. Phase 6: True Virgin Baseline vs Uncalibrated Distinction ---');

  runTest('estimateDoseFromDeltaE: deltaE <= 1.0 returns verified 0.0 with isVirginBaseline: true', () => {
    const result = estimateDoseFromDeltaE(0.45);
    assert.strictEqual(result.dosePpmHours, 0.0);
    assert.strictEqual(result.isVirginBaseline, true);
    assert.strictEqual(result.status, 'VALID');
  });

  runTest('estimateDoseFromDeltaE: deltaE = 0.0 returns verified 0.0 with isVirginBaseline: true', () => {
    const result = estimateDoseFromDeltaE(0.0);
    assert.strictEqual(result.dosePpmHours, 0.0);
    assert.strictEqual(result.isVirginBaseline, true);
    assert.strictEqual(result.status, 'VALID');
  });

  runTest('estimateDoseFromDeltaE: NaN or null input returns dose null and INVALID_COLOR_DATA', () => {
    const resNaN = estimateDoseFromDeltaE(NaN);
    assert.strictEqual(resNaN.dosePpmHours, null);
    assert.strictEqual(resNaN.isVirginBaseline, false);
    assert.strictEqual(resNaN.status, 'INVALID_COLOR_DATA');

    const resNull = estimateDoseFromDeltaE(null);
    assert.strictEqual(resNull.dosePpmHours, null);
    assert.strictEqual(resNull.isVirginBaseline, false);
    assert.strictEqual(resNull.status, 'INVALID_COLOR_DATA');
  });

  runTest('ppmToAlertLevel: null or undefined dose returns PENDING_CALIBRATION with neutral color', () => {
    const alertNull = ppmToAlertLevel(null);
    assert.strictEqual(alertNull.level, 'PENDING_CALIBRATION');
    assert.strictEqual(alertNull.color, '#94a3b8');

    const alertUndef = ppmToAlertLevel(undefined);
    assert.strictEqual(alertUndef.level, 'PENDING_CALIBRATION');
    assert.strictEqual(alertUndef.color, '#94a3b8');

    const alertNaN = ppmToAlertLevel(NaN);
    assert.strictEqual(alertNaN.level, 'PENDING_CALIBRATION');
  });

  runTest('ppmToAlertLevel: verified 0.0 returns SAFE', () => {
    const alertZero = ppmToAlertLevel(0.0);
    assert.strictEqual(alertZero.level, 'SAFE');
  });

  console.log('\n--- 2. Phase 6: Reading Model Nullable Schema Verification ---');

  runTest('Reading model accepts estimatedDosePpmHours: null without validation error', () => {
    const doc = new Reading({
      readingId: 'READ-TEST-001',
      workerId: 'W001',
      shiftId: 'SHIFT-01',
      stripId: 'STRIP-LEADAC-001',
      sensorChemistry: 'LEAD_ACETATE',
      estimatedDosePpmHours: null,
      isVirginBaseline: false,
      calibrationStatus: 'CALIBRATION_UNAVAILABLE',
      stripColorRGB: { r: 235, g: 234, b: 227 },
      referenceColorRGB: { r: 245, g: 242, b: 235 },
      correctedColorRGB: { r: 235, g: 234, b: 227 },
      lab: { L: 92.6, a: -0.89, b: 3.51 },
      deltaE00: 0.0,
      imageUrl: '/test.jpg'
    });

    const valErr = doc.validateSync();
    assert.strictEqual(valErr, undefined, 'Reading validation failed on null estimatedDosePpmHours');
    assert.strictEqual(doc.estimatedDosePpmHours, null);
    assert.strictEqual(doc.isVirginBaseline, false);
    assert.strictEqual(doc.calibrationStatus, 'CALIBRATION_UNAVAILABLE');
  });

  runTest('Reading model accepts isVirginBaseline: true for verified baseline', () => {
    const doc = new Reading({
      readingId: 'READ-TEST-002',
      workerId: 'W001',
      shiftId: 'SHIFT-01',
      stripId: 'STRIP-CU-001',
      sensorChemistry: 'CU_PAN',
      estimatedDosePpmHours: 0.0,
      isVirginBaseline: true,
      calibrationStatus: 'VALID_ESTIMATE',
      stripColorRGB: { r: 245, g: 242, b: 235 },
      referenceColorRGB: { r: 245, g: 242, b: 235 },
      correctedColorRGB: { r: 245, g: 242, b: 235 },
      lab: { L: 92.0, a: 0.0, b: 0.0 },
      deltaE00: 0.2,
      imageUrl: '/test.jpg'
    });

    const valErr = doc.validateSync();
    assert.strictEqual(valErr, undefined);
    assert.strictEqual(doc.estimatedDosePpmHours, 0.0);
    assert.strictEqual(doc.isVirginBaseline, true);
  });

  console.log('\n--- 3. Phase 7: Real Lead Acetate Dataset Import & Calibration Service ---');

  runTest('loadExperimentalDataset: successfully reads all 15 real experimental records', () => {
    const dataset = loadExperimentalDataset();
    assert.strictEqual(dataset.dataset_id, 'LEAD_ACETATE_DATASET_V1');
    assert.strictEqual(dataset.data_type, 'EXPERIMENTAL');
    assert.strictEqual(dataset.samples.length, 15);

    // Verify 5 distinct dose levels
    const doses = Array.from(new Set(dataset.samples.map(r => r.reference_dose))).sort((a, b) => a - b);
    assert.deepStrictEqual(doses, [0.0, 5.6, 11.1, 16.7, 22.3]);
  });

  runTest('fitExperimentalModel: fits LeadAcetateModelV1 with R² >= 0.99', () => {
    const model = fitExperimentalModel();
    assert.strictEqual(model.isFitted, true);
    assert.strictEqual(model.chemistry, CHEMISTRY_IDS.LEAD_ACETATE);

    const meta = model.getMetadata();
    assert.strictEqual(meta.data_type, 'EXPERIMENTAL');
    assert.ok(meta.metrics.r2 >= 0.99, `Expected R² >= 0.99, got ${meta.metrics.r2}`);
    assert.ok(meta.metrics.mae < 1.0, `Expected MAE < 1.0, got ${meta.metrics.mae}`);
  });

  runTest('LeadAcetateModelV1: accurately predicts stoichiometric dose from optical color', () => {
    const model = fitExperimentalModel();

    // 1. Virgin baseline: deltaE00 = 0.0
    const predZero = model.predict({ deltaE00: 0.0, Lab: { L: 92.6, a: -0.89, b: 3.51 } });
    assert.strictEqual(predZero.status, 'VALID_ESTIMATE');
    assert.ok(Math.abs(predZero.dosePpmHours) < 1.0, `Baseline deviated: ${predZero.dosePpmHours}`);

    // 2. High exposure: deltaE00 = 66.75 (saturated PbS)
    const predHigh = model.predict({ deltaE00: 66.75, Lab: { L: 20.65, a: 2.67, b: 8.09 } });
    assert.strictEqual(predHigh.status, 'VALID_ESTIMATE');
    assert.ok(Math.abs(predHigh.dosePpmHours - 22.3) < 1.5, `High exposure deviated: ${predHigh.dosePpmHours}`);

    // 3. Out of range below
    const predBelow = model.predict({ deltaE00: -2.0 });
    assert.strictEqual(predBelow.status, 'BELOW_CALIBRATION_RANGE');
    assert.strictEqual(predBelow.isCalibratedDomain, false);

    // 4. Out of range above
    const predAbove = model.predict({ deltaE00: 80.0 });
    assert.strictEqual(predAbove.status, 'ABOVE_CALIBRATION_RANGE');
    assert.strictEqual(predAbove.isCalibratedDomain, false);
  });

  console.log('\n========================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================\n');
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
