/**
 * backend/src/services/doseCalculator.js
 * 
 * Dose Calculation Engine for H2S Chemical Dosimeter (SIH26118).
 * Grounded in experimental calibration chamber dataset and Arrhenius kinetics.
 */

const standards = require('../../../shared/colorimetricStandards.cjs');

function calculateDose(correctedRGB, ambientTemp = 25.0, ambientHumidity = 50.0, curveVersion = 'scientific-cielab-v2') {
  const analysis = standards.analyzeExposure(correctedRGB, ambientTemp, ambientHumidity);
  return analysis.estimatedDosePpmHours;
}

module.exports = {
  calculateDose
};
