/**
 * scratch/compute_lead_acetate_colors.js
 * Compute the color coordinates (Linear RGB, XYZ, Lab, CIEDE2000 deltaE00)
 * for the experimental Lead Acetate trials.
 */

const {
  srgbChannelToLinear,
  applyCameraCCM,
  xyzToLab,
  ciede2000,
  DEFAULT_CCM,
  D65_WHITE
} = require('../shared/colorimetryEngine.cjs');

const trials = [
  { id: 'TRIAL-01', stripId: 'STRIP-LEADAC-001', dose_mL: 0.0,  rgb: [235, 234, 227], label: 'Virgin Off-White Paper' },
  { id: 'TRIAL-02', stripId: 'STRIP-LEADAC-002', dose_mL: 5.6,  rgb: [214, 203, 178], label: 'Pale Tan / Light Fawn' },
  { id: 'TRIAL-03', stripId: 'STRIP-LEADAC-003', dose_mL: 11.1, rgb: [170, 145, 105], label: 'Golden Amber / Light Brown' },
  { id: 'TRIAL-04', stripId: 'STRIP-LEADAC-004', dose_mL: 16.7, rgb: [115, 88, 58],   label: 'Dark Chocolate Brown' },
  { id: 'TRIAL-05', stripId: 'STRIP-LEADAC-005', dose_mL: 22.3, rgb: [58, 48, 38],     label: 'Deep Brown-Black PbS' }
];

function rgbToLabCoords(rgb) {
  const rLin = srgbChannelToLinear(rgb[0]);
  const gLin = srgbChannelToLinear(rgb[1]);
  const bLin = srgbChannelToLinear(rgb[2]);
  const xyz = applyCameraCCM(rLin, gLin, bLin, DEFAULT_CCM);
  return xyzToLab(xyz.x, xyz.y, xyz.z, D65_WHITE);
}

const blankLab = rgbToLabCoords(trials[0].rgb);
console.log('Lead Acetate Blank Baseline Lab:', blankLab);

const results = trials.map(t => {
  const lab = rgbToLabCoords(t.rgb);
  const deltaE00 = ciede2000(blankLab, lab);
  return {
    trialId: t.id,
    stripId: t.stripId,
    dose_mL: t.dose_mL,
    rgb: t.rgb,
    L: Math.round(lab.L * 100) / 100,
    a: Math.round(lab.a * 100) / 100,
    b: Math.round(lab.b * 100) / 100,
    deltaE00: Math.round(deltaE00 * 100) / 100,
    label: t.label
  };
});

console.table(results);
