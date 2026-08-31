/**
 * backend/src/services/lightingCorrection.js
 * 
 * Performs chromatic adaptation and white-point normalization on the raw strip RGB
 * against the known reference patch standard.
 * 
 * This cancels out lighting color temperature (e.g. warm sodium lamps, daylight, fluorescent)
 * and camera sensor gain differences across different smartphone models.
 */

// Standard laboratory calibration target for the printed reference patch
const STANDARD_REFERENCE_WHITE = { r: 255, g: 255, b: 255 };

/**
 * Normalizes strip color against reference patch color using Von Kries chromatic scaling.
 * 
 * @param {Object} stripColorRGB - Raw sampled RGB of the H2S strip { r, g, b }
 * @param {Object} referenceColorRGB - Raw sampled RGB of the reference patch { r, g, b }
 * @param {Object} [targetReferenceRGB] - Ideal target RGB of the reference patch (defaults to white 255,255,255)
 * @returns {Object} Corrected RGB object { r, g, b }
 */
function normalizeLighting(stripColorRGB, referenceColorRGB, targetReferenceRGB = STANDARD_REFERENCE_WHITE) {
  if (!stripColorRGB || !referenceColorRGB) {
    return { r: 128, g: 128, b: 128 };
  }

  // Prevent division by zero with a minimum floor of 1
  const refR = Math.max(1, referenceColorRGB.r);
  const refG = Math.max(1, referenceColorRGB.g);
  const refB = Math.max(1, referenceColorRGB.b);

  // Calculate per-channel normalization gain factors
  const gainR = targetReferenceRGB.r / refR;
  const gainG = targetReferenceRGB.g / refG;
  const gainB = targetReferenceRGB.b / refB;

  // Apply gains to strip color and clamp to valid 8-bit RGB range [0, 255]
  const correctedR = Math.min(255, Math.max(0, Math.round(stripColorRGB.r * gainR)));
  const correctedG = Math.min(255, Math.max(0, Math.round(stripColorRGB.g * gainG)));
  const correctedB = Math.min(255, Math.max(0, Math.round(stripColorRGB.b * gainB)));

  return {
    r: correctedR,
    g: correctedG,
    b: correctedB
  };
}

module.exports = {
  normalizeLighting,
  STANDARD_REFERENCE_WHITE
};
