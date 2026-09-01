/**
 * backend/src/services/lightingCorrection.js
 * 
 * Performs ISO 17321-1 Camera Color Correction Matrix (CCM) application
 * and optional Bradford Chromatic Adaptation.
 */

const standards = require('../../../shared/colorimetricStandards.cjs');

function normalizeLighting(stripColorRGB, referenceColorRGB) {
  if (!stripColorRGB) {
    return { r: 128, g: 128, b: 128, lab: { L: 50, a: 0, b: 0 } };
  }

  const rLin = standards.srgbChannelToLinear(stripColorRGB.r);
  const gLin = standards.srgbChannelToLinear(stripColorRGB.g);
  const bLin = standards.srgbChannelToLinear(stripColorRGB.b);

  const xyz = standards.applyCameraCCM(rLin, gLin, bLin, standards.DEFAULT_CCM);

  // If reference patch was captured and differs from D65, apply Bradford CAT
  let adaptedXyz = xyz;
  if (referenceColorRGB && (referenceColorRGB.r < 240 || referenceColorRGB.b < 240)) {
    const refLinR = standards.srgbChannelToLinear(referenceColorRGB.r);
    const refLinG = standards.srgbChannelToLinear(referenceColorRGB.g);
    const refLinB = standards.srgbChannelToLinear(referenceColorRGB.b);
    const srcWhite = standards.applyCameraCCM(refLinR, refLinG, refLinB, standards.DEFAULT_CCM);
    adaptedXyz = standards.bradfordAdapt(xyz, srcWhite, standards.D65_WHITE);
  }

  const lab = standards.xyzToLab(adaptedXyz.x, adaptedXyz.y, adaptedXyz.z, standards.D65_WHITE);

  return {
    r: stripColorRGB.r,
    g: stripColorRGB.g,
    b: stripColorRGB.b,
    xyz: adaptedXyz,
    lab
  };
}

module.exports = {
  normalizeLighting
};
