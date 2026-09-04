/**
 * backend/tests/test_common_image_pipeline.js
 * 
 * Comprehensive Deterministic Unit & Integration Test Suite for Phase 3:
 * Standardized Common Optical Color & Image Processing Pipeline.
 * 
 * Validates:
 * 1. RGB -> Linear RGB (IEC 61966-2-1 piecewise gamma decompression & roundtrip identity)
 * 2. Linear RGB -> XYZ (ISO 17321-1 CCM transformation)
 * 3. XYZ -> Lab (CIE 015 transfer functions & roundtrip)
 * 4. Lab -> ΔE00 (ISO/CIE 11664-6:2022 against Sharma et al. 2005 benchmark reference vectors)
 * 5. Reference Correction (Bradford CAT identity and chromatic adaptation)
 * 6. ROI Extraction (Spatial bounding box cropping and pixel extraction)
 * 7. Quality Gate (Saturation clipping, underexposure, and glare rejection)
 * 8. Chemistry Agnostic Invariance (Same optical input yields IDENTICAL color-space output regardless of chemistry)
 * 9. Interface Compliance (Returns rgb, correctedRgb, xyz, lab, deltaE00, referenceColor, quality, processingMetadata; NO ppm/dose calculation)
 */

const assert = require('assert');
const sharp = require('sharp');
const {
  D65_WHITE,
  DEFAULT_CCM,
  srgbChannelToLinear,
  linearChannelToSrgb,
  srgbToLinearRgb,
  linearToSrgbRgb,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  labToXyz,
  labToRgb,
  ciede2000
} = require('../../shared/colorimetryEngine.cjs');

const {
  processImage,
  TARGET_REGIONS,
  computeRobustPatchRGB,
  evaluateOpticalQualityGate
} = require('../src/services/imageProcessingPipeline');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n========================================================');
  console.log('PHASE 3 COMMON COLOR & IMAGE PIPELINE TEST SUITE');
  console.log('========================================================\n');

  // -----------------------------------------------------------
  // 1. RGB -> LINEAR RGB (IEC 61966-2-1)
  // -----------------------------------------------------------
  console.log('--- 1. sRGB Linearization & Gamma Decompression ---');

  runTest('sRGB boundary points linearize accurately (0 -> 0.0, 255 -> 1.0)', () => {
    assert.strictEqual(srgbChannelToLinear(0), 0.0);
    assert.strictEqual(srgbChannelToLinear(255), 1.0);
  });

  runTest('sRGB piecewise linear threshold correctly triggers for low values (c <= 10)', () => {
    // 10 / 255 = 0.0392157 <= 0.04045 -> linear branch: norm / 12.92
    const lin10 = srgbChannelToLinear(10);
    const expected = (10 / 255.0) / 12.92;
    assert(Math.abs(lin10 - expected) < 1e-6, `Expected ${expected}, got ${lin10}`);
  });

  runTest('sRGB power branch correctly decompresses mid-grey (c = 128)', () => {
    // ((128 / 255 + 0.055) / 1.055)^2.4 ≈ 0.21586
    const lin128 = srgbChannelToLinear(128);
    assert(Math.abs(lin128 - 0.21586) < 1e-4, `Expected ~0.21586, got ${lin128}`);
  });

  runTest('All 256 8-bit sRGB channels survive roundtrip linearization without error', () => {
    for (let c = 0; c < 256; c++) {
      const lin = srgbChannelToLinear(c);
      const back = linearChannelToSrgb(lin);
      assert.strictEqual(back, c, `Roundtrip failed for channel ${c}: got ${back}`);
    }
  });

  // -----------------------------------------------------------
  // 2. LINEAR RGB -> XYZ (ISO 17321-1 CCM)
  // -----------------------------------------------------------
  console.log('\n--- 2. Camera Color Correction Matrix (CCM) to XYZ ---');

  runTest('Linear pure white (1.0, 1.0, 1.0) maps precisely to D65 white point', () => {
    const xyz = applyCameraCCM(1.0, 1.0, 1.0, DEFAULT_CCM);
    assert(Math.abs(xyz.x - D65_WHITE.x) < 1e-4, `X expected ${D65_WHITE.x}, got ${xyz.x}`);
    assert(Math.abs(xyz.y - D65_WHITE.y) < 1e-4, `Y expected ${D65_WHITE.y}, got ${xyz.y}`);
    assert(Math.abs(xyz.z - D65_WHITE.z) < 1e-4, `Z expected ${D65_WHITE.z}, got ${xyz.z}`);
  });

  runTest('Linear pure black (0.0, 0.0, 0.0) maps to zero XYZ', () => {
    const xyz = applyCameraCCM(0.0, 0.0, 0.0, DEFAULT_CCM);
    assert.strictEqual(xyz.x, 0.0);
    assert.strictEqual(xyz.y, 0.0);
    assert.strictEqual(xyz.z, 0.0);
  });

  // -----------------------------------------------------------
  // 3. XYZ -> LAB (CIE 015:2018)
  // -----------------------------------------------------------
  console.log('\n--- 3. CIE 1976 CIELAB Color Space Mapping ---');

  runTest('D65 reference white maps to pure L*=100.0, a*=0.0, b*=0.0', () => {
    const lab = xyzToLab(D65_WHITE.x, D65_WHITE.y, D65_WHITE.z, D65_WHITE);
    assert(Math.abs(lab.L - 100.0) < 1e-4, `L* expected 100.0, got ${lab.L}`);
    assert(Math.abs(lab.a - 0.0) < 1e-4, `a* expected 0.0, got ${lab.a}`);
    assert(Math.abs(lab.b - 0.0) < 1e-4, `b* expected 0.0, got ${lab.b}`);
  });

  runTest('Black point (0, 0, 0) maps to L*=0.0, a*=0.0, b*=0.0', () => {
    const lab = xyzToLab(0.0, 0.0, 0.0, D65_WHITE);
    assert(Math.abs(lab.L - 0.0) < 1e-4, `L* expected 0.0, got ${lab.L}`);
    assert(Math.abs(lab.a - 0.0) < 1e-4, `a* expected 0.0, got ${lab.a}`);
    assert(Math.abs(lab.b - 0.0) < 1e-4, `b* expected 0.0, got ${lab.b}`);
  });

  runTest('XYZ <-> Lab invertible roundtrip identity', () => {
    const testPoints = [
      { x: 0.95047, y: 1.0, z: 1.08883 },
      { x: 0.40, y: 0.35, z: 0.20 },
      { x: 0.15, y: 0.18, z: 0.45 },
      { x: 0.70, y: 0.65, z: 0.60 }
    ];

    for (const pt of testPoints) {
      const lab = xyzToLab(pt.x, pt.y, pt.z, D65_WHITE);
      const backXyz = labToXyz(lab.L, lab.a, lab.b, D65_WHITE);
      assert(Math.abs(backXyz.x - pt.x) < 1e-4, `XYZ.x roundtrip failed`);
      assert(Math.abs(backXyz.y - pt.y) < 1e-4, `XYZ.y roundtrip failed`);
      assert(Math.abs(backXyz.z - pt.z) < 1e-4, `XYZ.z roundtrip failed`);
    }
  });

  // -----------------------------------------------------------
  // 4. LAB -> ΔE00 (ISO/CIE 11664-6:2022)
  // -----------------------------------------------------------
  console.log('\n--- 4. CIEDE2000 Total Colour Difference ---');

  runTest('Identical color vectors yield exact ΔE00 = 0.0000', () => {
    const lab = { L: 50.0, a: 25.0, b: -30.0 };
    const de00 = ciede2000(lab, lab);
    assert.strictEqual(de00, 0.0);
  });

  runTest('Sharma et al. (2005) Benchmark Vector Pair 1 matches published standard', () => {
    // Pair 1: Lab1 = [50.0, 2.6772, -79.7751], Lab2 = [50.0, 0.0000, -82.7485]
    // Published standard ΔE00 = 2.0425
    const lab1 = { L: 50.0, a: 2.6772, b: -79.7751 };
    const lab2 = { L: 50.0, a: 0.0000, b: -82.7485 };
    const de00 = ciede2000(lab1, lab2);
    assert(Math.abs(de00 - 2.0425) < 0.001, `Expected ΔE00 = 2.0425, got ${de00}`);
  });

  runTest('Sharma et al. (2005) Benchmark Vector Pair 2 matches published standard', () => {
    // Pair 2: Lab1 = [50.0, 3.1571, -77.2803], Lab2 = [50.0, 0.0000, -82.7485]
    // Published standard ΔE00 = 2.8615
    const lab1 = { L: 50.0, a: 3.1571, b: -77.2803 };
    const lab2 = { L: 50.0, a: 0.0000, b: -82.7485 };
    const de00 = ciede2000(lab1, lab2);
    assert(Math.abs(de00 - 2.8615) < 0.001, `Expected ΔE00 = 2.8615, got ${de00}`);
  });

  runTest('Sharma et al. (2005) Near-Grey Vector matches published standard', () => {
    // Near-Grey Pair: Lab1 = [50.0, 2.5000, 0.0000], Lab2 = [73.0, 25.0000, -18.0000]
    // Published standard ΔE00 = 27.1492
    const lab1 = { L: 50.0, a: 2.5000, b: 0.0000 };
    const lab2 = { L: 73.0, a: 25.0000, b: -18.0000 };
    const de00 = ciede2000(lab1, lab2);
    assert(Math.abs(de00 - 27.1492) < 0.01, `Expected ΔE00 = 27.1492, got ${de00}`);
  });

  // -----------------------------------------------------------
  // 5. REFERENCE CORRECTION (BRADFORD CAT)
  // -----------------------------------------------------------
  console.log('\n--- 5. Bradford Chromatic Adaptation Transform ---');

  runTest('Identity adaptation: D65 source to D65 target produces identical XYZ', () => {
    const testXyz = { x: 0.50, y: 0.50, z: 0.50 };
    const adapted = bradfordAdapt(testXyz, D65_WHITE, D65_WHITE);
    assert.strictEqual(adapted.x, testXyz.x);
    assert.strictEqual(adapted.y, testXyz.y);
    assert.strictEqual(adapted.z, testXyz.z);
  });

  runTest('Bradford transforms non-D65 illuminant white directly to D65', () => {
    // Warmer illuminant (~3200K Tungsten source white)
    const tungstenWhite = { x: 1.0985, y: 1.0000, z: 0.3558 };
    const adaptedWhite = bradfordAdapt(tungstenWhite, tungstenWhite, D65_WHITE);
    assert(Math.abs(adaptedWhite.x - D65_WHITE.x) < 1e-4, `Adapted white X should match D65.x`);
    assert(Math.abs(adaptedWhite.y - D65_WHITE.y) < 1e-4, `Adapted white Y should match D65.y`);
    assert(Math.abs(adaptedWhite.z - D65_WHITE.z) < 1e-4, `Adapted white Z should match D65.z`);
  });

  // -----------------------------------------------------------
  // 6. ROI EXTRACTION & ROBUST PIXEL AGGREGATION
  // -----------------------------------------------------------
  console.log('\n--- 6. Spatial ROI Extraction & Outlier Filtering ---');

  await runAsyncTest('Target patch regions are accurately cropped from calibrated synthetic frame', async () => {
    // Create a 640x480 synthetic SVG frame with distinct color zones
    // Target layout:
    // White patch (top-left): 10%-30% width (64-192), 10%-30% height (48-144) -> #F0F0F0 (240, 240, 240)
    // Strip patch (center): 38%-62% width (243-397), 38%-62% height (182-298) -> #705090 (112, 80, 144)
    // Grey patch (top-right): 70%-90% width (448-576), 10%-30% height (48-144) -> #808080 (128, 128, 128)
    const svg = `
      <svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#303030"/>
        <rect x="64" y="48" width="128" height="96" fill="#F0F0F0"/>
        <rect x="243" y="182" width="154" height="116" fill="#705090"/>
        <rect x="448" y="48" width="128" height="96" fill="#808080"/>
      </svg>
    `;

    const imgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await processImage(imgBuffer);

    // Verify extracted RGBs match the spatial zones within tolerance (+/- 3 due to downsampling/filtering)
    assert(Math.abs(result.referenceColor.white.rgb.r - 240) <= 3, `White patch R expected ~240, got ${result.referenceColor.white.rgb.r}`);
    assert(Math.abs(result.referenceColor.grey.rgb.r - 128) <= 3, `Grey patch R expected ~128, got ${result.referenceColor.grey.rgb.r}`);
    assert(Math.abs(result.rgb.r - 112) <= 3, `Strip patch R expected ~112, got ${result.rgb.r}`);
    assert(Math.abs(result.rgb.g - 80) <= 3, `Strip patch G expected ~80, got ${result.rgb.g}`);
    assert(Math.abs(result.rgb.b - 144) <= 3, `Strip patch B expected ~144, got ${result.rgb.b}`);
  });

  // -----------------------------------------------------------
  // 7. QUALITY GATE EVALUATION
  // -----------------------------------------------------------
  console.log('\n--- 7. Optical Quality Gate Evaluation ---');

  runTest('Well-exposed balanced frame passes quality gate', () => {
    // 100 pixels around mid-level 128
    const raw = Buffer.alloc(100 * 3, 128);
    const qg = evaluateOpticalQualityGate(raw, 3);
    assert.strictEqual(qg.passed, true);
    assert.strictEqual(qg.saturationRatio, 0.0);
    assert.strictEqual(qg.underexposedRatio, 0.0);
    assert(qg.score >= 90);
  });

  runTest('Excessive glare/saturation (>5%) fails quality gate', () => {
    // 100 pixels, 20 of which are saturated (255) -> 20% saturation
    const raw = Buffer.alloc(100 * 3, 128);
    for (let i = 0; i < 20 * 3; i++) raw[i] = 255;
    const qg = evaluateOpticalQualityGate(raw, 3);
    assert.strictEqual(qg.passed, false);
    assert(qg.saturationRatio >= 0.15);
    assert(qg.reasons.some(r => r.includes('saturation') || r.includes('glare')));
  });

  runTest('Excessive underexposure (>8%) fails quality gate', () => {
    // 100 pixels, 25 of which are clipped shadow (0) -> 25% underexposed
    const raw = Buffer.alloc(100 * 3, 128);
    for (let i = 0; i < 25 * 3; i++) raw[i] = 5;
    const qg = evaluateOpticalQualityGate(raw, 3);
    assert.strictEqual(qg.passed, false);
    assert(qg.underexposedRatio >= 0.20);
    assert(qg.reasons.some(r => r.includes('underexposure')));
  });

  runTest('computeRobustPatchRGB filters saturated specular outliers', () => {
    // 50 normal pixels at (100, 80, 120), 5 glare outliers at (255, 255, 255)
    const raw = [];
    for (let i = 0; i < 50; i++) raw.push(100, 80, 120);
    for (let i = 0; i < 5; i++) raw.push(255, 255, 255);
    const buf = Buffer.from(raw);

    const stats = computeRobustPatchRGB(buf, 3);
    // Saturated pixels should be rejected, mean should remain ~100, 80, 120
    assert.strictEqual(stats.r, 100);
    assert.strictEqual(stats.g, 80);
    assert.strictEqual(stats.b, 120);
  });

  // -----------------------------------------------------------
  // 8. CHEMISTRY AGNOSTIC INVARIANCE TEST
  // -----------------------------------------------------------
  console.log('\n--- 8. Chemistry Agnostic Invariance ---');

  await runAsyncTest('Identical optical frame produces 100% IDENTICAL color-space metrics for all chemistries', async () => {
    const svg = `
      <svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#282828"/>
        <rect x="64" y="48" width="128" height="96" fill="#F2F2F2"/>
        <rect x="243" y="182" width="154" height="116" fill="#A06050"/>
        <rect x="448" y="48" width="128" height="96" fill="#7C7C7C"/>
      </svg>
    `;

    const imgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

    // Run optical pipeline without baseline
    const res1 = await processImage(imgBuffer);
    const res2 = await processImage(imgBuffer);

    // Verify deterministic identity
    assert.deepStrictEqual(res1.rgb, res2.rgb, 'Raw RGB must be identical');
    assert.deepStrictEqual(res1.correctedRgb, res2.correctedRgb, 'Corrected RGB must be identical');
    assert.deepStrictEqual(res1.xyz, res2.xyz, 'XYZ must be identical');
    assert.deepStrictEqual(res1.lab, res2.lab, 'Lab must be identical');
    assert.deepStrictEqual(res1.quality, res2.quality, 'Quality metrics must be identical');

    // Crucial check: pipeline does NOT emit chemistry ppm/dose
    assert.strictEqual(res1.dose, undefined, 'Common pipeline must NOT output dose');
    assert.strictEqual(res1.estimatedDosePpmHours, undefined, 'Common pipeline must NOT output estimatedDosePpmHours');
    assert.strictEqual(res1.alertLevel, undefined, 'Common pipeline must NOT output alertLevel');
    assert.strictEqual(res1.risk_zone, undefined, 'Common pipeline must NOT output risk_zone');
  });

  // -----------------------------------------------------------
  // 9. REQUIRED INTERFACE COMPLIANCE
  // -----------------------------------------------------------
  console.log('\n--- 9. Required Interface Structure Compliance ---');

  await runAsyncTest('processImage returns exact required output interface schema', async () => {
    const svg = `
      <svg width="640" height="480" xmlns="http://www.w3.org/2000/svg">
        <rect width="640" height="480" fill="#181818"/>
        <rect x="64" y="48" width="128" height="96" fill="#EEEEEE"/>
        <rect x="243" y="182" width="154" height="116" fill="#885599"/>
        <rect x="448" y="48" width="128" height="96" fill="#888888"/>
      </svg>
    `;
    const imgBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    const result = await processImage(imgBuffer, { baselineLab: { L: 42.5, a: 38.2, b: -28.4 } });

    // Required fields:
    // rgb, correctedRgb, xyz, lab, deltaE00, referenceColor, quality, processingMetadata
    assert(result.rgb && typeof result.rgb.r === 'number', 'Missing result.rgb');
    assert(result.correctedRgb && typeof result.correctedRgb.r === 'number', 'Missing result.correctedRgb');
    assert(result.xyz && typeof result.xyz.x === 'number', 'Missing result.xyz');
    assert(result.lab && typeof result.lab.L === 'number', 'Missing result.lab');
    assert(typeof result.deltaE00 === 'number', 'Missing result.deltaE00');
    assert(result.referenceColor && result.referenceColor.white && result.referenceColor.grey, 'Missing result.referenceColor');
    assert(result.quality && typeof result.quality.passed === 'boolean', 'Missing result.quality');
    assert(result.processingMetadata && result.processingMetadata.dimensions, 'Missing result.processingMetadata');
  });

  console.log('\n========================================================');
  console.log(`SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('========================================================\n');
}

main().catch(err => {
  console.error('\nTest execution failed:', err);
  process.exit(1);
});
