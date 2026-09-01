/**
 * backend/src/services/doseCalculator.js
 * 
 * Dose Calculation Engine for Cu-PAN H2S Chemical Dosimeter (SIH26118).
 * Grounded in experimental calibration chamber dataset and Arrhenius kinetics.
 */

const standards = require('../../../shared/colorimetricStandards.cjs');

// Unexposed virgin Cu-PAN strip RGB baseline (Purple/Violet)
const UNEXPOSED_BASELINE_RGB = { r: 139, g: 76, b: 148 };

function calculateDose(correctedRGB, ambientTemp = 25.0, ambientHumidity = 50.0, curveVersion = 'cupan-cielab-v1') {
  const analysis = standards.analyzeExposure(correctedRGB, ambientTemp, ambientHumidity);
  return analysis.estimatedDosePpmHours;
}

function getAvailableCalibrationCurves() {
  return [
    {
      id: 'cupan-cielab-v1',
      name: 'Cu-PAN CIEDE2000 Spline Interpolation (Standard)',
      chemistry: 'Cu-PAN',
      description: 'Piecewise monotonic CIEDE2000 interpolation on empirical Cu-PAN chamber data.',
      targetRange: '0.0 - 160.0 ppm·h',
      unit: 'ppm·h',
      isDefault: true
    },
    {
      id: 'cupan-poly-surface-v1',
      name: 'Cu-PAN 2nd-Order Polynomial Surface Regression',
      chemistry: 'Cu-PAN',
      description: 'Multi-variable regularized polynomial surface fitting with Arrhenius compensation.',
      targetRange: '0.0 - 160.0 ppm·h',
      unit: 'ppm·h',
      isDefault: false
    }
  ];
}

module.exports = {
  calculateDose,
  UNEXPOSED_BASELINE_RGB,
  getAvailableCalibrationCurves
};
