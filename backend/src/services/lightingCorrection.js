/**
 * backend/src/services/lightingCorrection.js
 * 
 * Performs ISO 17321-1 Camera Color Correction Matrix (CCM) application
 * and Bradford Chromatic Adaptation Transform (CAT) to CIE Standard Illuminant D65.
 */

const {
  D65_WHITE,
  DEFAULT_CCM,
  srgbChannelToLinear,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  labToRgb
} = require('../../../shared/colorimetryEngine.cjs');

/**
 * Normalizes strip color lighting against captured reference white patch.
 * 
 * @param {{ r: number, g: number, b: number }} stripColorRGB - Raw uncorrected strip RGB
 * @param {{ r: number, g: number, b: number }} referenceColorRGB - Measured reference white patch RGB
 * @param {number[][]} ccm - Optional Camera Color Correction Matrix
 * @returns {{ r: number, g: number, b: number, rawRGB: object, xyz: object, lab: object }}
 */
function normalizeLighting(stripColorRGB, referenceColorRGB, ccm = DEFAULT_CCM) {
  if (!stripColorRGB) {
    return { r: 128, g: 128, b: 128, rawRGB: { r: 128, g: 128, b: 128 }, lab: { L: 50, a: 0, b: 0 } };
  }

  const rLin = srgbChannelToLinear(stripColorRGB.r);
  const gLin = srgbChannelToLinear(stripColorRGB.g);
  const bLin = srgbChannelToLinear(stripColorRGB.b);

  const xyz = applyCameraCCM(rLin, gLin, bLin, ccm);

  // If reference patch was captured and differs from D65, apply Bradford CAT
  let adaptedXyz = xyz;
  if (referenceColorRGB && (referenceColorRGB.r < 240 || referenceColorRGB.b < 240)) {
    const refLinR = srgbChannelToLinear(referenceColorRGB.r);
    const refLinG = srgbChannelToLinear(referenceColorRGB.g);
    const refLinB = srgbChannelToLinear(referenceColorRGB.b);
    const srcWhite = applyCameraCCM(refLinR, refLinG, refLinB, ccm);
    adaptedXyz = bradfordAdapt(xyz, srcWhite, D65_WHITE);
  }

  const lab = xyzToLab(adaptedXyz.x, adaptedXyz.y, adaptedXyz.z, D65_WHITE);
  const correctedRGB = labToRgb(lab.L, lab.a, lab.b, D65_WHITE);

  return {
    r: correctedRGB.r,
    g: correctedRGB.g,
    b: correctedRGB.b,
    rawRGB: { r: stripColorRGB.r, g: stripColorRGB.g, b: stripColorRGB.b },
    xyz: adaptedXyz,
    lab
  };
}

module.exports = {
  normalizeLighting
};
