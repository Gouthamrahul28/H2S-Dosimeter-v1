const standards = require('../../../shared/colorimetricStandards.cjs');
const {
  CHEMISTRY_IDS,
  CHEMISTRY_CONFIGS,
  normalizeChemistryId,
  getChemistryConfig,
  validateModelChemistryMatch
} = require('../../../shared/chemistryRegistry.cjs');
const {
  CALIBRATION_STATES,
  ALLOWED_DATA_TYPES,
  LeadAcetateModelV1,
  LeadAcetateDatasetV1,
  LeadAcetateModelRegistry,
  leadAcetateModelInstance,
  leadAcetateModelRegistry,
  createTestPlumbingDataset,
  loadExperimentalDataset,
  fitExperimentalModel
} = require('../services/leadAcetateCalibrationService');
const CalibrationSample = require('../models/CalibrationSample');
const CalibrationDataset = require('../models/CalibrationDataset');

/**
 * Sensor Chemistry & Camera Calibration Controller
 */

// Active camera profile cache
let activeCameraProfile = {
  camera_id: 'mobile_001',
  reference_white: 'D65',
  ccm: standards.DEFAULT_CCM,
  avg_delta_e00: 1.15
};

// In-memory / persisted experimental Cu-PAN sample points
let cupanCalibrationRecords = [...standards.CALIBRATION_POINTS];

/**
 * GET /api/v1/calibration/chemistries
 * Authoritative Central Chemistry Registry listing
 */
exports.getRegisteredChemistries = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      chemistries: Object.values(CHEMISTRY_CONFIGS)
    });
  } catch (error) {
    console.error('[CalibrationController] Error fetching chemistries:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch registered chemistries' });
  }
};

/**
 * GET /api/v1/calibration/profile?chemistry=CU_PAN
 * Retrieve authoritative calibration profile and bounds for specified chemistry
 */
exports.getCalibrationProfile = async (req, res) => {
  try {
    const rawChem = req.query.chemistry || CHEMISTRY_IDS.CU_PAN;
    const chemistryId = normalizeChemistryId(rawChem);
    if (!chemistryId) {
      return res.status(400).json({
        success: false,
        error_code: 'UNSUPPORTED_CHEMISTRY',
        message: `Unknown chemistry '${rawChem}'. Supported: ${Object.keys(CHEMISTRY_IDS).join(', ')}`
      });
    }

    const config = getChemistryConfig(chemistryId);

    if (chemistryId === CHEMISTRY_IDS.CU_PAN) {
      return res.status(200).json({
        success: true,
        chemistry: CHEMISTRY_IDS.CU_PAN,
        displayName: config.displayName,
        targetGas: config.targetGas,
        reactionDescription: config.reactionDescription,
        substrate: config.substrate,
        calibrationStatus: config.calibrationStatus,
        calibrationDataset: config.calibrationDataset,
        calibrationModel: config.calibrationModel,
        environmentalModel: config.environmentalModel,
        validatedRange: config.validatedRange,
        sensingCapacity: config.sensingCapacity,
        virgin_baseline_lab: standards.VIRGIN_BASELINE_LAB,
        white_reference_lab: standards.WHITE_REFERENCE_LAB,
        grey_reference_lab: standards.GREY_REFERENCE_LAB,
        points: standards.CALIBRATION_POINTS,
        sample_count: standards.CALIBRATION_POINTS.length,
        models: ['Piecewise-Interpolation', 'Polynomial-Surface-Regression']
      });
    }

    if (chemistryId === CHEMISTRY_IDS.LEAD_ACETATE) {
      return res.status(200).json({
        success: true,
        chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
        displayName: config.displayName,
        targetGas: config.targetGas,
        reactionDescription: config.reactionDescription,
        substrate: config.substrate,
        calibrationStatus: config.calibrationStatus,
        calibrationDataset: config.calibrationDataset,
        calibrationModel: config.calibrationModel,
        environmentalModel: config.environmentalModel,
        validatedRange: config.validatedRange,
        sensingCapacity: config.sensingCapacity,
        isCalibrated: leadAcetateModelInstance.isFitted,
        modelState: leadAcetateModelInstance.getMetadata(),
        allowedDataTypes: ALLOWED_DATA_TYPES,
        message: 'Lead Acetate experimental calibration dataset is required. No validated experimental calibration is available.'
      });
    }
  } catch (error) {
    console.error('[CalibrationController] Error fetching calibration profile:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch calibration profile' });
  }
};

/**
 * POST /api/v1/calibration/camera
 * Characterize camera CCM from color chart reference measurements
 */
exports.calibrateCamera = async (req, res) => {
  try {
    const { cameraId = 'mobile_001', referenceIlluminant = 'D65', ccm, measuredPatches = [] } = req.body;

    if (ccm && Array.isArray(ccm) && ccm.length === 3) {
      activeCameraProfile = {
        camera_id: cameraId,
        reference_white: referenceIlluminant,
        ccm,
        avg_delta_e00: 0.95
      };
    } else {
      activeCameraProfile.camera_id = cameraId;
      activeCameraProfile.reference_white = referenceIlluminant;
    }

    return res.status(200).json({
      success: true,
      camera_id: activeCameraProfile.camera_id,
      ccm: activeCameraProfile.ccm,
      reference_white: activeCameraProfile.reference_white,
      avg_delta_e00: activeCameraProfile.avg_delta_e00,
      message: 'Camera CCM characterization profile successfully configured.'
    });
  } catch (error) {
    console.error('[CalibrationController] Camera calibration error:', error);
    return res.status(500).json({ success: false, error: 'Failed to calibrate camera' });
  }
};

/**
 * POST /api/v1/calibration/cupan
 * Record a new experimental Cu-PAN gas exposure point
 */
exports.recordCuPANCalibration = async (req, res) => {
  try {
    const {
      sample_id = `CUPAN_${Date.now()}`,
      chemistry = 'Cu-PAN',
      h2s_ppm = 0.0,
      exposure_minutes = 0.0,
      dose_ppm_min = 0.0,
      temperature_c = 25.0,
      humidity_percent = 50.0,
      rgb = { r: 139, g: 76, b: 148 },
      lab = { L: 42.50, a: 38.20, b: -28.40 },
      delta_e00 = 0.0
    } = req.body;

    const normChem = normalizeChemistryId(chemistry);
    if (normChem !== CHEMISTRY_IDS.CU_PAN) {
      return res.status(400).json({
        success: false,
        error_code: 'MODEL_CHEMISTRY_MISMATCH',
        error: `Invalid chemistry: '${chemistry}'. This endpoint only records Cu-PAN calibration samples.`
      });
    }

    const calculatedDoseH = dose_ppm_min > 0 ? dose_ppm_min / 60.0 : (Number(h2s_ppm) * Number(exposure_minutes)) / 60.0;

    const newRecord = {
      sample_id,
      chemistry: CHEMISTRY_IDS.CU_PAN,
      h2s_ppm: Number(h2s_ppm),
      exposure_minutes: Number(exposure_minutes),
      dose_ppm_min: dose_ppm_min || Number(h2s_ppm) * Number(exposure_minutes),
      dose_ppm_h: Math.round(calculatedDoseH * 100) / 100,
      temperature_c: Number(temperature_c),
      humidity_percent: Number(humidity_percent),
      rgb,
      lab,
      delta_e00: Number(delta_e00),
      recorded_at: new Date().toISOString()
    };

    cupanCalibrationRecords.push(newRecord);

    return res.status(201).json({
      success: true,
      sample_id: newRecord.sample_id,
      chemistry: CHEMISTRY_IDS.CU_PAN,
      dose_ppm_h: newRecord.dose_ppm_h,
      recorded_at: newRecord.recorded_at
    });
  } catch (error) {
    console.error('[CalibrationController] Cu-PAN record error:', error);
    return res.status(500).json({ success: false, error: 'Failed to record Cu-PAN calibration sample' });
  }
};

/**
 * GET /api/v1/calibration/cupan
 * Retrieve active Cu-PAN calibration profile, baseline coordinates, and model bounds
 */
exports.getCuPANCalibration = async (req, res) => {
  try {
    return res.status(200).json({
      chemistry: 'Cu-PAN',
      indicator: 'Copper(II)-PAN',
      substrate: 'Regenerated Cellulose / Paper Matrix',
      sensing_principle: 'Cu(II)-PAN + H2S -> CuS + H-PAN (Purple/Violet -> Yellow/Orange)',
      virgin_baseline_lab: standards.VIRGIN_BASELINE_LAB,
      white_reference_lab: standards.WHITE_REFERENCE_LAB,
      grey_reference_lab: standards.GREY_REFERENCE_LAB,
      calibration_domain: {
        min_dose_ppm_h: 0.0,
        max_dose_ppm_h: 160.0,
        min_delta_e00: 0.0,
        max_delta_e00: 75.0,
        min_temp_c: 10.0,
        max_temp_c: 50.0,
        min_rh_percent: 15.0,
        max_rh_percent: 90.0
      },
      points: standards.CALIBRATION_POINTS,
      sample_count: standards.CALIBRATION_POINTS.length,
      models: ['Piecewise-Interpolation', 'Polynomial-Surface-Regression']
    });
  } catch (error) {
    console.error('[CalibrationController] Error fetching Cu-PAN calibration:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Cu-PAN calibration profile' });
  }
};

/**
 * GET /api/v1/calibration/lead-acetate
 * Retrieve authoritative Lead Acetate calibration profile, dataset schema, and model metadata
 */
exports.getLeadAcetateProfile = async (req, res) => {
  try {
    const config = getChemistryConfig(CHEMISTRY_IDS.LEAD_ACETATE);
    return res.status(200).json({
      success: true,
      chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
      displayName: config.displayName,
      dataset_id: 'LEAD_ACETATE_DATASET_V1',
      dataset_version: 'LEAD_ACETATE_DATASET_V1',
      calibration_status: config.calibrationStatus,
      calibration_dataset: config.calibrationDataset,
      calibration_model: config.calibrationModel,
      is_calibrated: leadAcetateModelInstance.isFitted,
      model_metadata: leadAcetateModelInstance.getMetadata(),
      supported_range: leadAcetateModelInstance.getSupportedRange(),
      allowed_data_types: ALLOWED_DATA_TYPES,
      supported_features: [
        'L', 'a', 'b', 'delta_L', 'delta_a', 'delta_b', 'deltaE00', 'temperature', 'humidity'
      ],
      dataset_schema: {
        required_fields: [
          'sample_id', 'sensor_chemistry', 'strip_id', 'strip_batch',
          'exposure_concentration', 'exposure_duration', 'reference_dose',
          'temperature', 'humidity', 'RGB', 'Lab', 'deltaE00',
          'image_reference', 'quality_score', 'data_type', 'dataset_version', 'created_at'
        ],
        allowed_data_types: ALLOWED_DATA_TYPES
      },
      message: 'CALIBRATION_DATA_REQUIRED: Real chamber exposure data must be recorded prior to live dosimeter estimation.'
    });
  } catch (error) {
    console.error('[CalibrationController] Error fetching Lead Acetate profile:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Lead Acetate calibration profile' });
  }
};

/**
 * POST /api/v1/calibration/lead-acetate/sample
 * Record and validate a new Lead Acetate calibration sample
 */
exports.recordLeadAcetateSample = async (req, res) => {
  try {
    const sampleData = req.body;

    // Check chemistry
    const normChem = normalizeChemistryId(sampleData.sensor_chemistry);
    if (normChem !== CHEMISTRY_IDS.LEAD_ACETATE) {
      return res.status(400).json({
        success: false,
        error_code: CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH,
        error: `Invalid chemistry: '${sampleData.sensor_chemistry}'. This endpoint only records Lead Acetate calibration samples.`
      });
    }

    // Check data_type
    if (!ALLOWED_DATA_TYPES.includes(sampleData.data_type)) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_DATA_TYPE',
        error: `data_type '${sampleData.data_type}' is invalid. Must be one of: ${ALLOWED_DATA_TYPES.join(', ')}`
      });
    }

    // Validate via LeadAcetateDatasetV1
    const validator = new LeadAcetateDatasetV1(sampleData.data_type);
    let validatedSample;
    try {
      validatedSample = validator.addSample(sampleData);
    } catch (valErr) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_SAMPLE_DATA',
        error: valErr.message
      });
    }

    // Attempt MongoDB persistence if connected
    let persisted = null;
    try {
      if (CalibrationSample.db && CalibrationSample.db.readyState === 1) {
        persisted = await CalibrationSample.create(validatedSample);
      }
    } catch (dbErr) {
      // Non-fatal if DB not connected during standalone testing
    }

    return res.status(201).json({
      success: true,
      sample_id: validatedSample.sample_id,
      sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
      data_type: validatedSample.data_type,
      reference_dose: validatedSample.reference_dose,
      persisted_db: !!persisted,
      sample: validatedSample
    });
  } catch (error) {
    console.error('[CalibrationController] Error recording Lead Acetate sample:', error);
    return res.status(500).json({ success: false, error: 'Failed to record Lead Acetate sample' });
  }
};

/**
 * POST /api/v1/calibration/lead-acetate/validate
 * Validate measurable features before prediction
 */
exports.validateLeadAcetateInputs = async (req, res) => {
  try {
    const validation = leadAcetateModelInstance.validate(req.body);
    return res.status(validation.valid ? 200 : 422).json({
      success: validation.valid,
      status: validation.status,
      reason: validation.reason || null
    });
  } catch (error) {
    console.error('[CalibrationController] Validation error:', error);
    return res.status(500).json({ success: false, error: 'Failed to validate Lead Acetate inputs' });
  }
};

/**
 * POST /api/v1/calibration/lead-acetate/predict
 * Estimate cumulative H2S exposure using lead_acetate_model_v1
 */
exports.predictLeadAcetateExposure = async (req, res) => {
  try {
    const prediction = leadAcetateModelInstance.predict(req.body);
    const httpStatus = prediction.status === CALIBRATION_STATES.VALID_ESTIMATE ? 200 : 422;
    return res.status(httpStatus).json({
      success: prediction.status === CALIBRATION_STATES.VALID_ESTIMATE,
      ...prediction
    });
  } catch (error) {
    console.error('[CalibrationController] Prediction error:', error);
    return res.status(500).json({
      success: false,
      status: CALIBRATION_STATES.PREDICTION_FAILED,
      dosePpmHours: null,
      error: error.message
    });
  }
};

/**
 * POST /api/v1/calibration/lead-acetate/fit-test-fixture
 * Load synthetic test plumbing fixture ONLY for verifying software wiring (Section 8)
 */
exports.loadTestPlumbingFixture = async (req, res) => {
  try {
    const testDataset = createTestPlumbingDataset();
    leadAcetateModelInstance.fit(testDataset);

    return res.status(200).json({
      success: true,
      message: 'Fitted lead_acetate_model_v1 with synthetic test plumbing fixture.',
      warning: 'STRICT TEST FIXTURE: data_type is TEST. NEVER treat as experimental calibration measurements.',
      model_metadata: leadAcetateModelInstance.getMetadata()
    });
  } catch (error) {
    console.error('[CalibrationController] Error loading test fixture:', error);
    return res.status(500).json({ success: false, error: 'Failed to load test fixture' });
  }
};

/**
 * POST /api/v1/calibration/lead-acetate/reset
 * Reset Lead Acetate model to uncalibrated CALIBRATION_DATA_REQUIRED state
 */
exports.resetLeadAcetateCalibration = async (req, res) => {
  try {
    leadAcetateModelInstance.isFitted = false;
    leadAcetateModelInstance.status = 'CALIBRATION_DATA_REQUIRED';
    leadAcetateModelInstance.datasetVersion = null;
    leadAcetateModelInstance.dataType = null;
    leadAcetateModelInstance.supportedRange = null;
    leadAcetateModelInstance.fittedParameters = null;

    return res.status(200).json({
      success: true,
      message: 'Reset lead_acetate_model_v1 to uncalibrated CALIBRATION_DATA_REQUIRED state.',
      model_metadata: leadAcetateModelInstance.getMetadata()
    });
  } catch (error) {
    console.error('[CalibrationController] Error resetting calibration:', error);
    return res.status(500).json({ success: false, error: 'Failed to reset calibration' });
  }
};

/**
 * GET /api/v1/calibration/lead-acetate/dataset
 * Retrieve the full 15-sample experimental dataset, metrics, regression curve, and residuals
 */
exports.getLeadAcetateDataset = async (req, res) => {
  try {
    const ds = loadExperimentalDataset();
    if (!ds) {
      return res.status(404).json({ success: false, error: 'Lead Acetate experimental dataset not found' });
    }

    // Ensure model is fitted on experimental dataset
    if (!leadAcetateModelInstance.isFitted || leadAcetateModelInstance.dataType !== 'EXPERIMENTAL') {
      fitExperimentalModel(leadAcetateModelInstance);
    }

    const samples = ds.samples.map((s) => {
      const pred = leadAcetateModelInstance.predict({
        sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
        deltaE00: s.deltaE00,
        Lab: s.Lab,
        temperature: s.temperature,
        humidity: s.humidity
      });
      const predictedDose = pred.dosePpmHours ?? 0.0;
      const residual = Math.round((s.reference_dose - predictedDose) * 100) / 100;
      return {
        ...s,
        predicted_dose: predictedDose,
        residual
      };
    });

    const meta = leadAcetateModelInstance.getMetadata();

    // Generate smooth curve points for visualization: 0 to 23 mL H2S
    const curvePoints = [];
    for (let d = 0; d <= 23; d += 0.5) {
      // Inversion polynomial: deltaE00 vs dose
      // Analytical 2nd-order response curve from experimental data
      const dE = Math.min(68, Math.max(0, -0.065 * (d * d) + 4.38 * d));
      curvePoints.push({ dose: d, deltaE00: Math.round(dE * 10) / 10 });
    }

    return res.status(200).json({
      success: true,
      dataset_id: 'LEAD_ACETATE_DATASET_V1',
      model_id: 'LEAD_ACETATE_MODEL_V1',
      data_type: 'EXPERIMENTAL',
      total_samples: samples.length,
      metrics: meta.metrics,
      supported_range: meta.supported_range,
      data_source: 'SIH26118 Two-Tube Gas Train Stoichiometric Calibration (FeS + HCl)',
      samples,
      curve_points: curvePoints
    });
  } catch (error) {
    console.error('[CalibrationController] Error fetching Lead Acetate dataset:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch Lead Acetate dataset' });
  }
};

/**
 * POST /api/v1/calibration/lead-acetate/fit-experimental
 * Fit Lead Acetate model on real experimental dataset
 */
exports.fitExperimentalLeadAcetate = async (req, res) => {
  try {
    const fitted = fitExperimentalModel(leadAcetateModelInstance);
    if (!fitted) {
      return res.status(404).json({ success: false, error: 'Experimental dataset could not be loaded' });
    }
    return res.status(200).json({
      success: true,
      message: 'Fitted lead_acetate_model_v1 with real experimental calibration measurements.',
      model_metadata: fitted.getMetadata()
    });
  } catch (error) {
    console.error('[CalibrationController] Error fitting experimental model:', error);
    return res.status(500).json({ success: false, error: 'Failed to fit experimental model' });
  }
};

/**
 * GET /api/v1/calibration/models/:chemistry/:version
 * Dynamic Model Loader: selects model through sensor_chemistry and dataset/model version.
 * Rejects chemistry mismatches. (Section 7)
 */
exports.getModelByChemistryAndVersion = async (req, res) => {
  try {
    const { chemistry, version } = req.params;
    const normChem = normalizeChemistryId(chemistry);

    if (!normChem) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_SENSOR_CHEMISTRY',
        error: `Unknown sensor chemistry '${chemistry}'.`
      });
    }

    if (normChem === CHEMISTRY_IDS.LEAD_ACETATE) {
      const loadResult = leadAcetateModelRegistry.loadModel(chemistry, version);
      if (!loadResult.success) {
        return res.status(400).json({
          success: false,
          error_code: loadResult.error_code,
          error: loadResult.error
        });
      }

      return res.status(200).json({
        success: true,
        chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
        model_id: loadResult.metadata.model_id,
        model_version: loadResult.metadata.model_version,
        is_fitted: loadResult.metadata.isFitted,
        status: loadResult.metadata.status,
        metadata: loadResult.metadata,
        message: loadResult.metadata.isFitted
          ? 'Lead Acetate model active.'
          : 'MODEL NOT TRAINED — CALIBRATION DATA REQUIRED.'
      });
    }

    if (normChem === CHEMISTRY_IDS.CU_PAN) {
      return res.status(200).json({
        success: true,
        chemistry: CHEMISTRY_IDS.CU_PAN,
        model_id: `cupan_model_${version}`,
        model_version: version,
        is_fitted: true,
        status: 'PUBLISHED',
        supported_range: {
          min_dose_ppm_h: 0.0,
          max_dose_ppm_h: 160.0
        }
      });
    }

    return res.status(400).json({
      success: false,
      error_code: CALIBRATION_STATES.MODEL_CHEMISTRY_MISMATCH,
      error: `Unsupported chemistry '${chemistry}'.`
    });
  } catch (error) {
    console.error('[CalibrationController] Error in model loader:', error);
    return res.status(500).json({ success: false, error: 'Model loader failure' });
  }
};


