/**
 * backend/src/services/doseCalculator.js
 * 
 * Dose Calculation Engine for H2S Chemical Dosimeter (SIH26118).
 * 
 * Implements a swappable, versioned calibration curve registry (`CALIBRATION_CURVES`)
 * supporting both linear models and non-linear Beer-Lambert optical density kinetics.
 */

// Unexposed chemical indicator strip baseline color (clean, unreacted matrix)
const UNEXPOSED_BASELINE_RGB = { r: 245, g: 245, b: 245 };

/**
 * Registry of versioned calibration curves
 */
const CALIBRATION_CURVES = {
  /**
   * Version: "placeholder-v1"
   * Description: Linear color Euclidean distance mapping with ambient temperature/humidity compensation.
   * Target exposure range: 0.0 - 250.0 ppm·hours.
   */
  'placeholder-v1': {
    name: 'Placeholder Linear Baseline',
    description: 'Initial linear Euclidean color-space darkening model with ambient compensation.',
    targetRange: '0.0 - 250.0 ppm·hours',
    calculate: (correctedRGB, ambientTemp = 25.0, ambientHumidity = 50.0) => {
      const dr = UNEXPOSED_BASELINE_RGB.r - (correctedRGB.r || 0);
      const dg = UNEXPOSED_BASELINE_RGB.g - (correctedRGB.g || 0);
      const db = UNEXPOSED_BASELINE_RGB.b - (correctedRGB.b || 0);

      const distance = Math.sqrt(Math.max(0, dr * dr + dg * dg + db * db));
      const SLOPE_CONSTANT = 0.38;
      let dose = distance * SLOPE_CONSTANT;

      const tempDelta = (Number(ambientTemp) || 25.0) - 25.0;
      const humidityDelta = (Number(ambientHumidity) || 50.0) - 50.0;
      const envFactor = 1.0 + (tempDelta * 0.004) + (humidityDelta * 0.002);

      dose = Math.max(0, dose * envFactor);
      return Math.round(dose * 10) / 10;
    }
  },

  /**
   * Version: "empirical-lab-v2"
   * Description: Non-linear Beer-Lambert Optical Density (ΔOD) curve calibrated for surface saturation.
   * Target exposure range: 0.5 - 200.0 ppm·hours.
   */
  'empirical-lab-v2': {
    name: 'Empirical Laboratory Beer-Lambert Model v2',
    description: 'Non-linear polynomial optical density kinetics reflecting reagent consumption on porous substrate.',
    targetRange: '0.5 - 200.0 ppm·hours',
    calculate: (correctedRGB, ambientTemp = 25.0, ambientHumidity = 50.0) => {
      const baseSum = UNEXPOSED_BASELINE_RGB.r + UNEXPOSED_BASELINE_RGB.g + UNEXPOSED_BASELINE_RGB.b;
      const corrSum = (correctedRGB.r || 0) + (correctedRGB.g || 0) + (correctedRGB.b || 0);

      // Relative optical reflectance ratio
      const reflectanceRatio = Math.max(0.01, Math.min(1.0, corrSum / baseSum));

      // Optical Density: ΔOD = -log10(Reflectance)
      const deltaOD = -Math.log10(reflectanceRatio);

      // Empirical 2nd-order polynomial fit: Dose = a*OD + b*OD^2
      const a = 88.5;
      const b = 45.2;
      let dose = (a * deltaOD) + (b * deltaOD * deltaOD);

      // Environmental temperature & humidity Arrhenius rate scaling
      const tempDelta = (Number(ambientTemp) || 25.0) - 25.0;
      const humidityDelta = (Number(ambientHumidity) || 50.0) - 50.0;
      const envFactor = 1.0 + (tempDelta * 0.0055) + (humidityDelta * 0.0025);

      dose = Math.max(0, dose * envFactor);
      return Math.round(dose * 10) / 10;
    }
  },

  /**
   * Version: "silver-acetate-v1"
   * Description: High-sensitivity silver-salt matrix model optimized for low-level chronic exposures (0-50 ppm·h).
   */
  'silver-acetate-v1': {
    name: 'Silver Salt High-Sensitivity Matrix v1',
    description: 'High-affinity metallic sulfide formation model designed for refinery boundary monitoring.',
    targetRange: '0.1 - 100.0 ppm·hours',
    calculate: (correctedRGB, ambientTemp = 25.0, ambientHumidity = 50.0) => {
      // Blue channel absorbance is most pronounced during Ag2S darkening
      const blueLoss = Math.max(0, UNEXPOSED_BASELINE_RGB.b - (correctedRGB.b || 0));
      const blueFraction = blueLoss / 245.0;

      let dose = 110.0 * Math.pow(blueFraction, 1.25);

      const tempDelta = (Number(ambientTemp) || 25.0) - 25.0;
      const envFactor = 1.0 + (tempDelta * 0.003);

      dose = Math.max(0, dose * envFactor);
      return Math.round(dose * 10) / 10;
    }
  }
};

/**
 * Calculate estimated cumulative H2S exposure dose in ppm·hours
 */
function calculateDose(correctedRGB, ambientTemp = 25.0, ambientHumidity = 50.0, version = 'placeholder-v1') {
  const curveConfig = CALIBRATION_CURVES[version] || CALIBRATION_CURVES['placeholder-v1'];
  return curveConfig.calculate(correctedRGB, ambientTemp, ambientHumidity);
}

/**
 * List metadata for all registered calibration curve versions
 */
function getAvailableCalibrationCurves() {
  return Object.keys(CALIBRATION_CURVES).map((key) => ({
    versionId: key,
    name: CALIBRATION_CURVES[key].name,
    description: CALIBRATION_CURVES[key].description,
    targetRange: CALIBRATION_CURVES[key].targetRange
  }));
}

module.exports = {
  calculateDose,
  getAvailableCalibrationCurves,
  CALIBRATION_CURVES,
  UNEXPOSED_BASELINE_RGB
};
