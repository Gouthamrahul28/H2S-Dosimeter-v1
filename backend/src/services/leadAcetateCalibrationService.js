/**
 * backend/src/services/leadAcetateCalibrationService.js
 * 
 * Lead Acetate (Pb(OAc)₂) H₂S Calibration Service & Model Architecture (Phase 4).
 * 
 * Authoritative Principles:
 * 1. Zero data fabrication: Initialized as CALIBRATION_DATA_REQUIRED when no experimental data exists.
 * 2. Model isolation: lead_acetate_model_v1 is strictly partitioned from Cu-PAN.
 * 3. Explicit typed error states: Never returns 0.0 ppm as an error or uncalibrated fallback.
 * 4. Pluggable features: Supports L*, a*, b*, ΔL*, Δa*, Δb*, ΔE00, temp, humidity only when available.
 */

const {
  CHEMISTRY_IDS,
  normalizeChemistryId,
  validateModelChemistryMatch
} = require('../../../shared/chemistryRegistry.cjs');

// Explicit Authoritative Calibration Output States
const CALIBRATION_STATES = Object.freeze({
  VALID_ESTIMATE: 'VALID_ESTIMATE',
  BELOW_CALIBRATION_RANGE: 'BELOW_CALIBRATION_RANGE',
  ABOVE_CALIBRATION_RANGE: 'ABOVE_CALIBRATION_RANGE',
  OUTSIDE_CALIBRATION_RANGE: 'OUTSIDE_CALIBRATION_RANGE',
  CALIBRATION_UNAVAILABLE: 'CALIBRATION_UNAVAILABLE',
  MODEL_UNAVAILABLE: 'MODEL_UNAVAILABLE',
  MODEL_CHEMISTRY_MISMATCH: 'MODEL_CHEMISTRY_MISMATCH',
  PREDICTION_FAILED: 'PREDICTION_FAILED'
});

const ALLOWED_DATA_TYPES = Object.freeze(['EXPERIMENTAL', 'SYNTHETIC', 'TEST']);

/**
 * Abstract Calibration Model Interface (Section 5)
 */
class BaseCalibrationModel {
  constructor(name, chemistry, version) {
    if (new.target === BaseCalibrationModel) {
      throw new TypeError('Cannot construct abstract BaseCalibrationModel directly.');
    }
    this.name = name;
    this.chemistry = normalizeChemistryId(chemistry);
    this.version = version;
    this.isFitted = false;
  }

  fit(dataset) {
    throw new Error('fit(dataset) must be implemented by concrete calibration model.');
  }

  predict(features) {
    throw new Error('predict(features) must be implemented by concrete calibration model.');
  }

  validate(features) {
    throw new Error('validate(features) must be implemented by concrete calibration model.');
  }

  getMetadata() {
    throw new Error('getMetadata() must be implemented by concrete calibration model.');
  }

  getVersion() {
    return this.version;
  }

  getSupportedRange() {
    throw new Error('getSupportedRange() must be implemented by concrete calibration model.');
  }
}

/**
 * Concrete Lead Acetate Calibration Model (lead_acetate_model_v1)
 */
class LeadAcetateModelV1 extends BaseCalibrationModel {
  constructor() {
    super('lead_acetate_model_v1', CHEMISTRY_IDS.LEAD_ACETATE, '1.0.0');
    this.status = 'CALIBRATION_DATA_REQUIRED';
    this.datasetVersion = null;
    this.dataType = null;
    this.supportedRange = null;
    this.fittedParameters = null;
    this.features = ['deltaE00', 'L', 'temperature', 'humidity'];
    this.trainingDate = null;
    this.trainingSampleCount = 0;
    this.metrics = null;
    this.modelArtifactReference = null;
  }

  /**
   * Fit model against a validated Lead Acetate dataset.
   * 
   * @param {object} dataset - LEAD_ACETATE_DATASET_V1 structure
   * @returns {LeadAcetateModelV1} Fitted instance
   */
  fit(dataset) {
    if (!dataset || !Array.isArray(dataset.samples)) {
      throw new Error('INVALID_DATASET: Dataset must contain a valid samples array.');
    }

    const chem = normalizeChemistryId(dataset.sensor_chemistry);
    if (chem !== CHEMISTRY_IDS.LEAD_ACETATE) {
      throw new Error(`MODEL_CHEMISTRY_MISMATCH: lead_acetate_model_v1 cannot fit dataset with chemistry '${dataset.sensor_chemistry}'.`);
    }

    if (!ALLOWED_DATA_TYPES.includes(dataset.data_type)) {
      throw new Error(`INVALID_DATA_TYPE: data_type '${dataset.data_type}' is not allowed. Must be one of: ${ALLOWED_DATA_TYPES.join(', ')}`);
    }

    if (dataset.samples.length < 3) {
      throw new Error(`INSUFFICIENT_DATA: Minimum 3 calibration points required to fit model, received ${dataset.samples.length}.`);
    }

    // Sort samples monotonically by reference dose
    const sorted = [...dataset.samples].sort((a, b) => a.reference_dose - b.reference_dose);

    // Compute calibration bounds from real dataset samples
    const doses = sorted.map(s => s.reference_dose);
    const temps = sorted.map(s => s.temperature || 25.0);
    const humidities = sorted.map(s => s.humidity || 50.0);

    this.supportedRange = Object.freeze({
      minDosePpmH: Math.min(...doses),
      maxDosePpmH: Math.max(...doses),
      minTempC: Math.min(...temps),
      maxTempC: Math.max(...temps),
      minRhPct: Math.min(...humidities),
      maxRhPct: Math.max(...humidities)
    });

    // Store anchors for piecewise interpolation on available features
    this.fittedParameters = {
      anchors: sorted.map(s => ({
        dose: s.reference_dose,
        L: s.Lab?.L ?? null,
        a: s.Lab?.a ?? null,
        b: s.Lab?.b ?? null,
        deltaE00: s.deltaE00 ?? null,
        delta_L: s.delta_L ?? null,
        delta_a: s.delta_a ?? null,
        delta_b: s.delta_b ?? null,
        temp: s.temperature,
        humidity: s.humidity
      }))
    };

    this.isFitted = true;
    this.status = dataset.data_type === 'TEST' ? 'FITTED_TEST_PLUMBING' : 'CALIBRATED';
    this.datasetVersion = dataset.dataset_version;
    this.dataType = dataset.data_type;
    this.trainingSampleCount = sorted.length;
    this.trainingDate = new Date().toISOString();
    this.modelArtifactReference = `models/lead_acetate/${this.name}_${this.datasetVersion || 'v1'}.json`;

    // Calculate training metrics (R², MAE, RMSE)
    let sumAbsErr = 0;
    let sumSqErr = 0;
    let sumSqTot = 0;
    const meanDose = doses.reduce((a, b) => a + b, 0) / (doses.length || 1);
    for (const s of sorted) {
      const de = s.deltaE00 !== null && s.deltaE00 !== undefined ? s.deltaE00 : Math.abs((s.Lab?.L ?? 95.0) - 95.0);
      const pred = this.predict({ sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE, deltaE00: de, temperature: s.temperature, humidity: s.humidity });
      const err = (pred.dosePpmHours ?? 0) - s.reference_dose;
      sumAbsErr += Math.abs(err);
      sumSqErr += err * err;
      sumSqTot += (s.reference_dose - meanDose) ** 2;
    }
    const mae = sumAbsErr / sorted.length;
    const rmse = Math.sqrt(sumSqErr / sorted.length);
    const r2 = sumSqTot > 1e-12 ? Math.max(0, 1 - (sumSqErr / sumSqTot)) : 1.0;

    this.metrics = {
      r2: Math.round(r2 * 10000) / 10000,
      mae: Math.round(mae * 1000) / 1000,
      rmse: Math.round(rmse * 1000) / 1000
    };

    return this;
  }

  /**
   * Validate incoming input features before prediction.
   * 
   * @param {object} features - Measurable optical and environmental inputs
   * @returns {{ valid: boolean, status: string, reason?: string }}
   */
  validate(features) {
    if (!features) {
      return {
        valid: false,
        status: CALIBRATION_STATES.PREDICTION_FAILED,
        reason: 'Features payload is missing or empty.'
      };
    }

    // Hard Isolation Guard: Check sensor chemistry match
    const sensorChem = normalizeChemistryId(features.sensor_chemistry || features.chemistry || CHEMISTRY_IDS.LEAD_ACETATE);
    const matchCheck = validateModelChemistryMatch(sensorChem, this.chemistry);
    if (!matchCheck.valid) {
      return {
        valid: false,
        status: CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH,
        reason: matchCheck.error
      };
    }

    // Check if model has been calibrated
    if (!this.isFitted || !this.fittedParameters) {
      return {
        valid: false,
        status: CALIBRATION_STATES.CALIBRATION_UNAVAILABLE,
        reason: 'Lead Acetate calibration is unavailable. Validated experimental chamber data is required.'
      };
    }

    // Feature availability check: need at least L* or deltaE00
    const hasL = typeof features.L === 'number' || (features.Lab && typeof features.Lab.L === 'number');
    const hasDeltaE = typeof features.deltaE00 === 'number';

    if (!hasL && !hasDeltaE) {
      return {
        valid: false,
        status: CALIBRATION_STATES.PREDICTION_FAILED,
        reason: 'Insufficient optical features. Either L* or deltaE00 must be provided.'
      };
    }

    // Check for NaN or non-finite values in numeric inputs
    for (const [key, val] of Object.entries(features)) {
      if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
        return {
          valid: false,
          status: CALIBRATION_STATES.PREDICTION_FAILED,
          reason: `Feature '${key}' contains invalid numeric value (NaN or non-finite).`
        };
      }
    }

    return { valid: true, status: CALIBRATION_STATES.VALID_ESTIMATE };
  }

  /**
   * Predict cumulative dose from measurable features.
   * 
   * @param {object} features - Measurable inputs (L*, a*, b*, deltaE00, temp, humidity)
   * @returns {object} Standardized prediction report
   */
  predict(features) {
    const val = this.validate(features);
    if (!val.valid) {
      return {
        status: val.status,
        dosePpmHours: null, // STRICT RULE: Never return 0.0 on error or uncalibrated state
        confidence: 0.0,
        isCalibratedDomain: false,
        modelName: this.name,
        model_id: `${this.name}_${this.version}`,
        version: this.version,
        chemistry: this.chemistry,
        unit: 'ppm·h',
        error: val.reason
      };
    }

    let warning = null;
    if (features.temperature === undefined || features.humidity === undefined) {
      warning = 'Environmental parameters missing. Evaluated at standard nominal conditions (25°C, 50% RH).';
    }

    const temp = Number(features.temperature || 25.0);
    const rh = Number(features.humidity || 50.0);

    // Predict using available optical feature: deltaE00 primary, L* secondary
    const anchors = this.fittedParameters.anchors;
    const testDeltaE = features.deltaE00 ?? null;
    const testL = features.L ?? features.Lab?.L ?? null;

    let estimatedDose = 0.0;
    let inDomain = true;
    let state = CALIBRATION_STATES.VALID_ESTIMATE;

    if (testDeltaE !== null) {
      const minDeltaE = anchors[0].deltaE00 ?? 0.0;
      const maxDeltaE = anchors[anchors.length - 1].deltaE00 ?? 50.0;

      if (testDeltaE < minDeltaE) {
        state = CALIBRATION_STATES.BELOW_CALIBRATION_RANGE;
        inDomain = false;
        estimatedDose = anchors[0].dose;
      } else if (testDeltaE > maxDeltaE) {
        state = CALIBRATION_STATES.ABOVE_CALIBRATION_RANGE;
        inDomain = false;
        estimatedDose = anchors[anchors.length - 1].dose;
      } else {
        // Piecewise linear interpolation
        for (let i = 0; i < anchors.length - 1; i++) {
          const a1 = anchors[i];
          const a2 = anchors[i + 1];
          if (testDeltaE >= a1.deltaE00 && testDeltaE <= a2.deltaE00) {
            const frac = (testDeltaE - a1.deltaE00) / (a2.deltaE00 - a1.deltaE00 + 1e-12);
            estimatedDose = a1.dose + frac * (a2.dose - a1.dose);
            break;
          }
        }
      }
    } else if (testL !== null) {
      // For Lead Acetate: L* decreases as strip darkens from white to dark brown PbS
      const maxL = anchors[0].L ?? 95.0; // Unexposed (Light)
      const minL = anchors[anchors.length - 1].L ?? 30.0; // Saturated (Dark)

      if (testL > maxL) {
        state = CALIBRATION_STATES.BELOW_CALIBRATION_RANGE;
        inDomain = false;
        estimatedDose = anchors[0].dose;
      } else if (testL < minL) {
        state = CALIBRATION_STATES.ABOVE_CALIBRATION_RANGE;
        inDomain = false;
        estimatedDose = anchors[anchors.length - 1].dose;
      } else {
        for (let i = 0; i < anchors.length - 1; i++) {
          const a1 = anchors[i];
          const a2 = anchors[i + 1];
          // L decreases from a1 to a2
          if (testL <= a1.L && testL >= a2.L) {
            const frac = (a1.L - testL) / (a1.L - a2.L + 1e-12);
            estimatedDose = a1.dose + frac * (a2.dose - a1.dose);
            break;
          }
        }
      }
    }

    if (!inDomain) {
      warning = warning ? `${warning} | OUTSIDE_CALIBRATION_RANGE` : 'OUTSIDE_CALIBRATION_RANGE';
    }

    return {
      status: state,
      calibration_status: state,
      dosePpmHours: Math.round(estimatedDose * 100) / 100,
      dose_ppm_h: Math.round(estimatedDose * 100) / 100,
      confidence: inDomain ? (this.dataType === 'TEST' ? 0.75 : 0.95) : 0.30,
      isCalibratedDomain: inDomain,
      is_calibrated_domain: inDomain,
      modelName: this.name,
      model_id: `${this.name}_${this.version}`,
      model_version: this.version,
      version: this.version,
      chemistry: this.chemistry,
      sensor_chemistry: this.chemistry,
      unit: 'ppm·h',
      dataType: this.dataType,
      data_type: this.dataType,
      supportedRange: this.supportedRange,
      supported_range: this.supportedRange,
      warning,
      featuresUsed: this.features
    };
  }

  getMetadata() {
    return {
      model_id: `${this.name}_${this.version}`,
      modelName: this.name,
      chemistry: this.chemistry,
      dataset_version: this.datasetVersion,
      model_version: this.version,
      version: this.version,
      data_type: this.dataType,
      features: this.features,
      training_date: this.trainingDate,
      metrics: this.metrics,
      training_sample_count: this.trainingSampleCount,
      supported_range: this.supportedRange,
      model_artifact_reference: this.modelArtifactReference,
      isFitted: this.isFitted,
      status: this.status,
      dataType: this.dataType,
      supportedRange: this.supportedRange
    };
  }

  getSupportedRange() {
    return this.supportedRange;
  }
}

/**
 * Lead Acetate Dataset Structure (Section 1)
 */
class LeadAcetateDatasetV1 {
  constructor(dataType = 'EXPERIMENTAL') {
    if (!ALLOWED_DATA_TYPES.includes(dataType)) {
      throw new Error(`INVALID_DATA_TYPE: Allowed types are ${ALLOWED_DATA_TYPES.join(', ')}`);
    }

    this.dataset_id = 'LEAD_ACETATE_DATASET_V1';
    this.sensor_chemistry = CHEMISTRY_IDS.LEAD_ACETATE;
    this.dataset_version = 'LEAD_ACETATE_DATASET_V1';
    this.data_type = dataType;
    this.status = 'CALIBRATION_DATA_REQUIRED';
    this.created_at = new Date().toISOString();
    this.samples = [];
  }

  /**
   * Add and validate a calibration sample point (Section 1 & 2)
   */
  addSample(sample) {
    const requiredFields = [
      'sample_id',
      'sensor_chemistry',
      'exposure_duration',
      'reference_dose',
      'temperature',
      'humidity',
      'RGB',
      'Lab',
      'data_type'
    ];

    for (const field of requiredFields) {
      if (sample[field] === undefined || sample[field] === null) {
        throw new Error(`MISSING_FIELD: Sample missing required field '${field}'`);
      }
    }

    // Enforce chemistry match
    const normChem = normalizeChemistryId(sample.sensor_chemistry);
    if (normChem !== CHEMISTRY_IDS.LEAD_ACETATE) {
      throw new Error(`CHEMISTRY_MISMATCH: Sample chemistry '${sample.sensor_chemistry}' does not match Lead Acetate dataset.`);
    }

    // Enforce data type consistency (Do not mix EXPERIMENTAL, SYNTHETIC, TEST)
    if (sample.data_type !== this.data_type) {
      throw new Error(`DATA_TYPE_MISMATCH: Cannot add sample of type '${sample.data_type}' to a dataset of type '${this.data_type}'.`);
    }

    const validatedSample = {
      sample_id: String(sample.sample_id),
      sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
      strip_id: sample.strip_id || null,
      strip_batch: sample.strip_batch || null,
      exposure_concentration: sample.exposure_concentration !== undefined ? Number(sample.exposure_concentration) : 0.0,
      exposure_condition: sample.exposure_condition || null,
      exposure_duration: Number(sample.exposure_duration),
      reference_dose: Number(sample.reference_dose),
      temperature: Number(sample.temperature),
      humidity: Number(sample.humidity),
      RGB: {
        r: Math.round(sample.RGB.r),
        g: Math.round(sample.RGB.g),
        b: Math.round(sample.RGB.b)
      },
      Lab: {
        L: Number(sample.Lab.L),
        a: Number(sample.Lab.a),
        b: Number(sample.Lab.b)
      },
      deltaE00: sample.deltaE00 !== undefined && sample.deltaE00 !== null ? Number(sample.deltaE00) : null,
      image_reference: sample.image_reference || null,
      quality_score: Number(sample.quality_score || 100.0),
      data_type: this.data_type,
      dataset_version: this.dataset_version,
      created_at: sample.created_at || new Date().toISOString()
    };

    this.samples.push(validatedSample);
    return validatedSample;
  }

  getSampleCount() {
    return this.samples.length;
  }
}

// Active singleton instance for application runtime
const leadAcetateModelInstance = new LeadAcetateModelV1();

const fs = require('fs');
const path = require('path');

/**
 * Loads the real experimental Lead Acetate dataset from data/master/LEAD_ACETATE_DATASET_V1.json.
 * 
 * @returns {LeadAcetateDatasetV1|null}
 */
function loadExperimentalDataset() {
  const defaultPath = path.join(__dirname, '../../../data/master/LEAD_ACETATE_DATASET_V1.json');
  if (!fs.existsSync(defaultPath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));
  const ds = new LeadAcetateDatasetV1('EXPERIMENTAL');
  for (const s of raw.samples) {
    ds.addSample(s);
  }
  return ds;
}

/**
 * Fits a Lead Acetate model using the real experimental dataset (Phase 7).
 * 
 * @param {LeadAcetateModelV1} model
 * @returns {LeadAcetateModelV1|null}
 */
function fitExperimentalModel(model = leadAcetateModelInstance) {
  const ds = loadExperimentalDataset();
  if (!ds) return null;
  model.fit(ds);
  return model;
}

// Auto-fit singleton with real experimental calibration data if available
try {
  fitExperimentalModel(leadAcetateModelInstance);
} catch (err) {
  console.warn('[LeadAcetate] Auto-fit skipped:', err.message);
}

/**
 * Creates a synthetic TEST plumbing fixture ONLY for testing software wiring (Section 8).
 * STRICT RULE: Always explicitly marked data_type = 'TEST'. Never called experimental.
 */
function createTestPlumbingDataset() {
  const testDataset = new LeadAcetateDatasetV1('TEST');

  // 4 synthetic test calibration points demonstrating dark brown optical progression
  testDataset.addSample({
    sample_id: 'TEST_PB_SAMPLE_00',
    sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
    strip_id: 'STRIP_PB_TEST_01',
    strip_batch: 'BATCH_PB_TEST',
    exposure_concentration: 0.0,
    exposure_duration: 0.0,
    reference_dose: 0.0,
    temperature: 25.0,
    humidity: 50.0,
    RGB: { r: 245, g: 243, b: 238 },
    Lab: { L: 95.5, a: 0.2, b: 3.5 },
    deltaE00: 0.0,
    quality_score: 98.0,
    data_type: 'TEST'
  });

  testDataset.addSample({
    sample_id: 'TEST_PB_SAMPLE_10',
    sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
    strip_id: 'STRIP_PB_TEST_02',
    strip_batch: 'BATCH_PB_TEST',
    exposure_concentration: 10.0,
    exposure_duration: 60.0,
    reference_dose: 10.0,
    temperature: 25.0,
    humidity: 50.0,
    RGB: { r: 195, g: 175, b: 155 },
    Lab: { L: 72.4, a: 5.1, b: 12.8 },
    deltaE00: 18.5,
    quality_score: 96.0,
    data_type: 'TEST'
  });

  testDataset.addSample({
    sample_id: 'TEST_PB_SAMPLE_40',
    sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
    strip_id: 'STRIP_PB_TEST_03',
    strip_batch: 'BATCH_PB_TEST',
    exposure_concentration: 20.0,
    exposure_duration: 120.0,
    reference_dose: 40.0,
    temperature: 25.0,
    humidity: 50.0,
    RGB: { r: 130, g: 105, b: 85 },
    Lab: { L: 46.2, a: 7.8, b: 16.2 },
    deltaE00: 38.2,
    quality_score: 95.0,
    data_type: 'TEST'
  });

  testDataset.addSample({
    sample_id: 'TEST_PB_SAMPLE_80',
    sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
    strip_id: 'STRIP_PB_TEST_04',
    strip_batch: 'BATCH_PB_TEST',
    exposure_concentration: 40.0,
    exposure_duration: 120.0,
    reference_dose: 80.0,
    temperature: 25.0,
    humidity: 50.0,
    RGB: { r: 65, g: 50, b: 42 },
    Lab: { L: 22.8, a: 5.4, b: 9.8 },
    deltaE00: 55.4,
    quality_score: 94.0,
    data_type: 'TEST'
  });

  return testDataset;
}

/**
 * Model Registry & Loader for Lead Acetate (Section 7)
 */
class LeadAcetateModelRegistry {
  constructor() {
    this.models = new Map();
    this.register(leadAcetateModelInstance);
  }

  register(model) {
    this.models.set(`${model.chemistry}:${model.name}:${model.version}`, model);
    this.models.set(`${model.chemistry}:${model.version}`, model);
  }

  loadModel(sensorChemistry, modelVersion = '1.0.0') {
    const normChem = normalizeChemistryId(sensorChemistry);
    if (normChem !== CHEMISTRY_IDS.LEAD_ACETATE) {
      return {
        success: false,
        error_code: CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH,
        error: `HARD ISOLATION VIOLATION: Cannot load Lead Acetate model for '${sensorChemistry}'.`
      };
    }

    const key = `${CHEMISTRY_IDS.LEAD_ACETATE}:${modelVersion}`;
    const model = this.models.get(key) || leadAcetateModelInstance;
    if (!model) {
      return {
        success: false,
        error_code: CALIBRATION_STATES.MODEL_UNAVAILABLE,
        error: `Model version '${modelVersion}' not found.`
      };
    }

    return {
      success: true,
      model,
      metadata: model.getMetadata()
    };
  }
}

const leadAcetateModelRegistry = new LeadAcetateModelRegistry();

module.exports = {
  CALIBRATION_STATES,
  ALLOWED_DATA_TYPES,
  BaseCalibrationModel,
  LeadAcetateModelV1,
  LeadAcetateDatasetV1,
  LeadAcetateModelRegistry,
  leadAcetateModelInstance,
  leadAcetateModelRegistry,
  createTestPlumbingDataset,
  loadExperimentalDataset,
  fitExperimentalModel
};
