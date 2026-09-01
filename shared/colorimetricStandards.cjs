/**
 * shared/colorimetricStandards.cjs
 * CommonJS export mirror for Node.js backend.
 */

const standards = require('./colorimetricStandards.js');

module.exports = {
  RISK_ZONES: standards.RISK_ZONES,
  ALERT_LEVELS: standards.ALERT_LEVELS,
  COLOR_REFERENCE: standards.COLOR_REFERENCE,
  VALID_TEMP_RANGE_C: standards.VALID_TEMP_RANGE_C,
  VALID_RH_RANGE_PCT: standards.VALID_RH_RANGE_PCT,
  D65_WHITE: standards.D65_WHITE,
  DEFAULT_CCM: standards.DEFAULT_CCM,
  CALIBRATION_POINTS: standards.CALIBRATION_POINTS,
  VIRGIN_BASELINE_LAB: standards.VIRGIN_BASELINE_LAB,
  GREY_REFERENCE_LAB: standards.GREY_REFERENCE_LAB,
  srgbChannelToLinear: standards.srgbChannelToLinear,
  linearChannelToSrgb: standards.linearChannelToSrgb,
  applyCameraCCM: standards.applyCameraCCM,
  bradfordAdapt: standards.bradfordAdapt,
  xyzToLab: standards.xyzToLab,
  ciede2000: standards.ciede2000,
  computeArrheniusRateFactor: standards.computeArrheniusRateFactor,
  estimateDoseFromDeltaE: standards.estimateDoseFromDeltaE,
  analyzeExposure: standards.analyzeExposure,
  ppmToAlertLevel: standards.ppmToAlertLevel,
  hexToRgb: standards.hexToRgb,
  rgbToHex: standards.rgbToHex,
  computeShiftTWA: standards.computeShiftTWA,
  analyzeShift: standards.analyzeShift,
  colorToPPM: standards.colorToPPM
};
