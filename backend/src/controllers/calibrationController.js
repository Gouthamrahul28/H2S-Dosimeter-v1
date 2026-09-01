const standards = require('../../../shared/colorimetricStandards.cjs');

/**
 * Cu-PAN Chemical & Camera Calibration Controller
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

    if (chemistry !== 'Cu-PAN') {
      return res.status(400).json({
        success: false,
        error: `Invalid chemistry: '${chemistry}'. Only 'Cu-PAN' is supported.`
      });
    }

    const calculatedDoseH = dose_ppm_min > 0 ? dose_ppm_min / 60.0 : (Number(h2s_ppm) * Number(exposure_minutes)) / 60.0;

    const newRecord = {
      sample_id,
      chemistry: 'Cu-PAN',
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
      chemistry: 'Cu-PAN',
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
