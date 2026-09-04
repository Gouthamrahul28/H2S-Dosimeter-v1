/**
 * scratch/trace_fixture.js
 * Trace the real production pipeline for both exposed and unexposed fixtures.
 */

const {
  D65_WHITE,
  DEFAULT_CCM,
  srgbChannelToLinear,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  ciede2000
} = require('../shared/colorimetryEngine.cjs');

const standards = require('../shared/colorimetricStandards.cjs');

console.log('===============================================================');
console.log('PHASE 6 STEP 1: TRACE KNOWN FIXTURE THROUGH PRODUCTION PIPELINE');
console.log('===============================================================\n');

function traceFixture(name, stripRgb, whiteRgb, tempC, rhPct) {
  console.log(`>>> TRACING FIXTURE: ${name}`);
  console.log(`1. Raw Inputs:`);
  console.log(`   Strip RGB: [${stripRgb.r}, ${stripRgb.g}, ${stripRgb.b}]`);
  console.log(`   White RGB: [${whiteRgb.r}, ${whiteRgb.g}, ${whiteRgb.b}]`);
  console.log(`   Temp: ${tempC}°C, RH: ${rhPct}%`);

  // 2. Linear RGB (IEC 61966-2-1)
  const stripLin = {
    r: srgbChannelToLinear(stripRgb.r),
    g: srgbChannelToLinear(stripRgb.g),
    b: srgbChannelToLinear(stripRgb.b)
  };
  const whiteLin = {
    r: srgbChannelToLinear(whiteRgb.r),
    g: srgbChannelToLinear(whiteRgb.g),
    b: srgbChannelToLinear(whiteRgb.b)
  };
  console.log(`2. Linear RGB:`);
  console.log(`   Strip Linear: [${stripLin.r.toFixed(5)}, ${stripLin.g.toFixed(5)}, ${stripLin.b.toFixed(5)}]`);
  console.log(`   White Linear: [${whiteLin.r.toFixed(5)}, ${whiteLin.g.toFixed(5)}, ${whiteLin.b.toFixed(5)}]`);

  // 3. CCM -> XYZ (ISO 17321-1)
  const stripXyz = applyCameraCCM(stripLin.r, stripLin.g, stripLin.b, DEFAULT_CCM);
  const whiteXyz = applyCameraCCM(whiteLin.r, whiteLin.g, whiteLin.b, DEFAULT_CCM);
  console.log(`3. Camera CCM -> XYZ:`);
  console.log(`   Strip XYZ: [X=${stripXyz.x.toFixed(4)}, Y=${stripXyz.y.toFixed(4)}, Z=${stripXyz.z.toFixed(4)}]`);
  console.log(`   White XYZ: [X=${whiteXyz.x.toFixed(4)}, Y=${whiteXyz.y.toFixed(4)}, Z=${whiteXyz.z.toFixed(4)}]`);

  // 4. Bradford Chromatic Adaptation to D65
  const adaptedXyz = bradfordAdapt(stripXyz, whiteXyz, D65_WHITE);
  console.log(`4. Bradford CAT to D65:`);
  console.log(`   Adapted XYZ: [X=${adaptedXyz.x.toFixed(4)}, Y=${adaptedXyz.y.toFixed(4)}, Z=${adaptedXyz.z.toFixed(4)}]`);

  // 5. CIE 1976 CIELAB
  const lab = xyzToLab(adaptedXyz.x, adaptedXyz.y, adaptedXyz.z, D65_WHITE);
  console.log(`5. CIELAB:`);
  console.log(`   L*=${lab.L.toFixed(2)}, a*=${lab.a.toFixed(2)}, b*=${lab.b.toFixed(2)}`);

  // 6. ΔE00 against Virgin Baseline
  const deltaE00 = ciede2000(standards.VIRGIN_BASELINE_LAB, lab);
  console.log(`6. CIEDE2000 ΔE00 against Baseline Lab (${JSON.stringify(standards.VIRGIN_BASELINE_LAB)}):`);
  console.log(`   ΔE00 = ${deltaE00.toFixed(3)}`);

  // 7. Arrhenius Environment Processing
  const env = standards.computeArrheniusRateFactor(tempC, rhPct);
  console.log(`7. Environmental Correction:`);
  console.log(`   Rate Factor k = ${env.rateFactor.toFixed(4)}, Valid: ${env.envValid} (${env.envReason})`);

  // 8. Calibration & Dose Estimation
  const doseEst = standards.estimateDoseFromDeltaE(deltaE00, tempC, rhPct);
  console.log(`8. Calibration / Prediction:`);
  console.log(`   Normalized ΔE00 = ${(deltaE00 / env.rateFactor).toFixed(3)}`);
  console.log(`   Dose = ${doseEst.dosePpmHours} ppm·h, inRange = ${doseEst.inRange}, status = ${doseEst.status}`);

  // 9. Alert Level Mapping
  const risk = standards.ppmToAlertLevel(doseEst.dosePpmHours);
  console.log(`9. Risk Mapping:`);
  console.log(`   Level = ${risk.level}, Color = ${risk.color}, Note = ${risk.note}`);
  console.log('---------------------------------------------------------------\n');
}

// Case A: Partially reacted Cu-PAN (from test_dosimetry_pipeline.py)
traceFixture(
  'Partially Reacted Cu-PAN (Amber/Orange)',
  { r: 200, g: 140, b: 75 },
  { r: 245, g: 242, b: 235 },
  30.0,
  60.0
);

// Case B: Unexposed Virgin Cu-PAN Baseline (from test_dosimetry_pipeline.py)
traceFixture(
  'Unexposed Virgin Cu-PAN (Purple/Violet Baseline)',
  { r: 139, g: 76, b: 148 },
  { r: 250, g: 250, b: 250 },
  25.0,
  50.0
);
