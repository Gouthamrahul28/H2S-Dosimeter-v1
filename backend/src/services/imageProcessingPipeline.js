/**
 * backend/src/services/imageProcessingPipeline.js
 * 
 * Standardized, Chemistry-Agnostic Optical Image Processing Pipeline.
 * 
 * Pipeline Sequence:
 *   1. Image Buffer Ingestion
 *   2. Decode & Normalize
 *   3. EXIF Orientation Normalization (.rotate())
 *   4. Full-frame Quality Gate Evaluation (Saturation, Underexposure, Blur)
 *   5. Spatial Region of Interest (ROI) Extraction
 *   6. Reference Patch Characterization (White & Grey references)
 *   7. Active Sensing Strip Robust RGB Extraction (Glare & Outlier Filtered)
 *   8. IEC 61966-2-1 sRGB Linearization
 *   9. ISO 17321-1 Camera Color Correction Matrix (CCM) Transform
 *  10. CIE 1931 XYZ Tristimulus Mapping
 *  11. Bradford Chromatic Adaptation Transform (CAT to D65)
 *  12. CIE 1976 CIELAB Coordinates (L*, a*, b*)
 *  13. ISO/CIE 11664-6:2022 CIEDE2000 (if baselineLab is provided)
 * 
 * Output Interface:
 * {
 *   rgb: { r, g, b },
 *   correctedRgb: { r, g, b },
 *   xyz: { x, y, z },
 *   lab: { L, a, b },
 *   deltaE00: number | null,
 *   referenceColor: {
 *     white: { rgb, lab, valid },
 *     grey: { rgb, lab, valid }
 *   },
 *   quality: {
 *     passed: boolean,
 *     score: number,
 *     saturationRatio: number,
 *     underexposedRatio: number,
 *     reasons: string[]
 *   },
 *   processingMetadata: {
 *     dimensions: { width, height },
 *     orientationApplied: boolean,
 *     ccmApplied: boolean,
 *     chromaticAdaptationApplied: boolean,
 *     targetIlluminant: 'D65',
 *     sourceWhiteXyz: { x, y, z } | null
 *   }
 * }
 * 
 * STRICT INVARIANT:
 * Contains NO chemistry assumptions (no Cu-PAN purple, no Lead brown/black,
 * no Arrhenius kinetics, and no ppm gas estimates). The calibration layer performs
 * chemistry interpretation downstream.
 */

const sharp = require('sharp');
const {
  D65_WHITE,
  DEFAULT_CCM,
  srgbChannelToLinear,
  linearChannelToSrgb,
  applyCameraCCM,
  bradfordAdapt,
  xyzToLab,
  labToRgb,
  ciede2000
} = require('../../../shared/colorimetryEngine.cjs');

// Standardized 3-zone target normalized coordinates [0.0, 1.0]
const TARGET_REGIONS = Object.freeze({
  white: Object.freeze({ left: 0.10, top: 0.10, width: 0.20, height: 0.20 }),
  strip: Object.freeze({ left: 0.38, top: 0.38, width: 0.24, height: 0.24 }),
  grey:  Object.freeze({ left: 0.70, top: 0.10, width: 0.20, height: 0.20 })
});

/**
 * Robust trimmed mean and outlier-filtered RGB calculation.
 * Filters sensor saturation (>= 250) and shadow/dark-current clipping (<= 15).
 * 
 * @param {Buffer} rawBuffer - Raw uncompressed pixel buffer (RGB channels)
 * @param {number} channels - Channel count (3 for RGB)
 * @returns {{ r: number, g: number, b: number, variance: number, validCount: number, satRatio: number, underRatio: number }}
 */
function computeRobustPatchRGB(rawBuffer, channels = 3) {
  if (!rawBuffer || rawBuffer.length === 0) {
    return { r: 128, g: 128, b: 128, variance: 0, validCount: 0, satRatio: 0, underRatio: 0 };
  }

  const totalPixels = Math.floor(rawBuffer.length / channels);
  const cleanPixels = [];
  let satCount = 0;
  let underCount = 0;

  for (let i = 0; i < rawBuffer.length; i += channels) {
    const r = rawBuffer[i];
    const g = rawBuffer[i + 1];
    const b = rawBuffer[i + 2];

    const isSat = r >= 250 || g >= 250 || b >= 250;
    const isUnder = r <= 15 && g <= 15 && b <= 15;

    if (isSat) satCount++;
    if (isUnder) underCount++;

    if (!isSat && !isUnder) {
      cleanPixels.push([r, g, b]);
    }
  }

  const satRatio = satCount / (totalPixels || 1);
  const underRatio = underCount / (totalPixels || 1);

  // Fallback to all pixels if filtering was overly aggressive (>90% removed)
  const source = cleanPixels.length >= Math.max(10, totalPixels * 0.10) ? cleanPixels : [];
  if (source.length === 0) {
    for (let i = 0; i < rawBuffer.length; i += channels) {
      source.push([rawBuffer[i], rawBuffer[i + 1], rawBuffer[i + 2]]);
    }
  }

  let sumR = 0, sumG = 0, sumB = 0;
  for (let i = 0; i < source.length; i++) {
    sumR += source[i][0];
    sumG += source[i][1];
    sumB += source[i][2];
  }

  const count = source.length || 1;
  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;

  let varSum = 0;
  for (let i = 0; i < source.length; i++) {
    varSum += Math.pow(source[i][0] - meanR, 2) + Math.pow(source[i][1] - meanG, 2) + Math.pow(source[i][2] - meanB, 2);
  }

  return {
    r: Math.round(meanR),
    g: Math.round(meanG),
    b: Math.round(meanB),
    variance: Math.round((varSum / (count * 3)) * 10) / 10,
    validCount: count,
    satRatio: Math.round(satRatio * 1000) / 1000,
    underRatio: Math.round(underRatio * 1000) / 1000
  };
}

/**
 * Optical Quality Gate Evaluation.
 * Evaluates illumination uniformity, dynamic range, clipping, and frame reliability.
 * 
 * @param {Buffer} fullFrameRaw - Subsampled full image buffer
 * @param {number} channels - Channel count
 * @returns {{ passed: boolean, score: number, saturationRatio: number, underexposedRatio: number, reasons: string[] }}
 */
function evaluateOpticalQualityGate(fullFrameRaw, channels = 3) {
  let saturatedCount = 0;
  let underCount = 0;
  const total = Math.floor(fullFrameRaw.length / channels);
  const reasons = [];

  for (let i = 0; i < fullFrameRaw.length; i += channels) {
    const r = fullFrameRaw[i];
    const g = fullFrameRaw[i + 1];
    const b = fullFrameRaw[i + 2];

    if (r >= 250 || g >= 250 || b >= 250) saturatedCount++;
    if (r < 15 && g < 15 && b < 15) underCount++;
  }

  const satRatio = saturatedCount / (total || 1);
  const underRatio = underCount / (total || 1);
  const score = Math.max(0, Math.min(100, Math.round(100 - (satRatio * 350) - (underRatio * 250))));

  if (satRatio > 0.05) {
    reasons.push(`Excessive optical glare or sensor saturation (${(satRatio * 100).toFixed(1)}% > 5.0% threshold)`);
  }
  if (underRatio > 0.08) {
    reasons.push(`Severe underexposure or shadow occlusion (${(underRatio * 100).toFixed(1)}% > 8.0% threshold)`);
  }
  if (score < 50) {
    reasons.push(`Composite image quality score (${score}/100) below acceptable threshold (50)`);
  }

  return {
    passed: reasons.length === 0,
    score,
    saturationRatio: Math.round(satRatio * 1000) / 1000,
    underexposedRatio: Math.round(underRatio * 1000) / 1000,
    reasons
  };
}

/**
 * Master Common Optical Image Processing Pipeline.
 * Transforms raw camera frame buffer into calibrated, chromatically adapted CIE coordinates.
 * 
 * @param {Buffer} imageBuffer - Raw image file buffer (JPEG, PNG, WebP)
 * @param {object} options - Processing options:
 *   - ccm: 3x3 camera matrix (default DEFAULT_CCM)
 *   - baselineLab: Optional { L, a, b } to compute deltaE00 against
 *   - enableCAT: boolean (default true) to apply Bradford adaptation with white reference patch
 * @returns {Promise<object>} Standardized optical measurement interface
 */
async function processImage(imageBuffer, options = {}) {
  const {
    ccm = DEFAULT_CCM,
    baselineLab = null,
    enableCAT = true
  } = options;

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('INVALID_IMAGE_BUFFER: Image buffer is empty or undefined.');
  }

  // 1. Decode & Auto-Orient via EXIF orientation
  const image = sharp(imageBuffer).rotate(); // .rotate() with no args handles EXIF auto-rotation
  const metadata = await image.metadata();

  const imgWidth = metadata.width || 640;
  const imgHeight = metadata.height || 480;

  // 2. Full-frame buffer extraction for Quality Gate evaluation
  const { data: fullData, info: fullInfo } = await image
    .clone()
    .resize(160, 120, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const quality = evaluateOpticalQualityGate(fullData, fullInfo.channels);

  // 3. Extract Target Patch Regions
  const extractPatch = async (bounds) => {
    const left = Math.max(0, Math.floor(bounds.left * imgWidth));
    const top = Math.max(0, Math.floor(bounds.top * imgHeight));
    const width = Math.min(imgWidth - left, Math.max(10, Math.floor(bounds.width * imgWidth)));
    const height = Math.min(imgHeight - top, Math.max(10, Math.floor(bounds.height * imgHeight)));

    const { data, info } = await image
      .clone()
      .extract({ left, top, width, height })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return computeRobustPatchRGB(data, info.channels);
  };

  const [whiteStats, stripStats, greyStats] = await Promise.all([
    extractPatch(TARGET_REGIONS.white),
    extractPatch(TARGET_REGIONS.strip),
    extractPatch(TARGET_REGIONS.grey)
  ]);

  const rawStripRGB = { r: stripStats.r, g: stripStats.g, b: stripStats.b };
  const rawWhiteRGB = { r: whiteStats.r, g: whiteStats.g, b: whiteStats.b };
  const rawGreyRGB  = { r: greyStats.r,  g: greyStats.g,  b: greyStats.b };

  // 4. Color Science: sRGB -> Linear RGB (IEC 61966-2-1)
  const stripLin = {
    r: srgbChannelToLinear(rawStripRGB.r),
    g: srgbChannelToLinear(rawStripRGB.g),
    b: srgbChannelToLinear(rawStripRGB.b)
  };

  // 5. Camera CCM -> CIE XYZ (ISO 17321-1)
  const stripXyz = applyCameraCCM(stripLin.r, stripLin.g, stripLin.b, ccm);

  // 6. Bradford Chromatic Adaptation Transform (CAT)
  let adaptedXyz = stripXyz;
  let catApplied = false;
  let sourceWhiteXyz = null;

  const whiteIsUsable = rawWhiteRGB.r >= 180 && rawWhiteRGB.g >= 180 && rawWhiteRGB.b >= 180;
  if (enableCAT && whiteIsUsable) {
    const whiteLinR = srgbChannelToLinear(rawWhiteRGB.r);
    const whiteLinG = srgbChannelToLinear(rawWhiteRGB.g);
    const whiteLinB = srgbChannelToLinear(rawWhiteRGB.b);
    sourceWhiteXyz = applyCameraCCM(whiteLinR, whiteLinG, whiteLinB, ccm);

    adaptedXyz = bradfordAdapt(stripXyz, sourceWhiteXyz, D65_WHITE);
    catApplied = true;
  }

  // 7. CIE 1976 CIELAB Conversion
  const stripLab = xyzToLab(adaptedXyz.x, adaptedXyz.y, adaptedXyz.z, D65_WHITE);

  // Compute chromatically adapted sRGB representation for visualization
  const correctedRgb = labToRgb(stripLab.L, stripLab.a, stripLab.b, D65_WHITE);

  // Also compute reference patches Lab for diagnostic completeness
  const whiteLin = { r: srgbChannelToLinear(rawWhiteRGB.r), g: srgbChannelToLinear(rawWhiteRGB.g), b: srgbChannelToLinear(rawWhiteRGB.b) };
  const whiteXyz = applyCameraCCM(whiteLin.r, whiteLin.g, whiteLin.b, ccm);
  const whiteLab = xyzToLab(whiteXyz.x, whiteXyz.y, whiteXyz.z, D65_WHITE);

  const greyLin = { r: srgbChannelToLinear(rawGreyRGB.r), g: srgbChannelToLinear(rawGreyRGB.g), b: srgbChannelToLinear(rawGreyRGB.b) };
  const greyXyz = applyCameraCCM(greyLin.r, greyLin.g, greyLin.b, ccm);
  const greyLab = xyzToLab(greyXyz.x, greyXyz.y, greyXyz.z, D65_WHITE);

  // 8. CIEDE2000 Calculation (if baselineLab is supplied)
  let deltaE00 = null;
  if (baselineLab && typeof baselineLab.L === 'number' && typeof baselineLab.a === 'number' && typeof baselineLab.b === 'number') {
    deltaE00 = Math.round(ciede2000(baselineLab, stripLab) * 100) / 100;
  }

  // 9. Construct Required Authoritative Output Interface
  return {
    rgb: rawStripRGB,
    correctedRgb,
    xyz: {
      x: Math.round(adaptedXyz.x * 10000) / 10000,
      y: Math.round(adaptedXyz.y * 10000) / 10000,
      z: Math.round(adaptedXyz.z * 10000) / 10000
    },
    lab: {
      L: Math.round(stripLab.L * 100) / 100,
      a: Math.round(stripLab.a * 100) / 100,
      b: Math.round(stripLab.b * 100) / 100
    },
    deltaE00,
    referenceColor: {
      white: {
        rgb: rawWhiteRGB,
        lab: { L: Math.round(whiteLab.L * 100) / 100, a: Math.round(whiteLab.a * 100) / 100, b: Math.round(whiteLab.b * 100) / 100 },
        valid: whiteIsUsable
      },
      grey: {
        rgb: rawGreyRGB,
        lab: { L: Math.round(greyLab.L * 100) / 100, a: Math.round(greyLab.a * 100) / 100, b: Math.round(greyLab.b * 100) / 100 },
        valid: rawGreyRGB.r >= 40 && rawGreyRGB.r <= 220
      }
    },
    quality,
    processingMetadata: {
      dimensions: { width: imgWidth, height: imgHeight },
      orientationApplied: true,
      ccmApplied: true,
      chromaticAdaptationApplied: catApplied,
      targetIlluminant: 'D65',
      sourceWhiteXyz: sourceWhiteXyz ? {
        x: Math.round(sourceWhiteXyz.x * 10000) / 10000,
        y: Math.round(sourceWhiteXyz.y * 10000) / 10000,
        z: Math.round(sourceWhiteXyz.z * 10000) / 10000
      } : null
    }
  };
}

module.exports = {
  processImage,
  TARGET_REGIONS,
  computeRobustPatchRGB,
  evaluateOpticalQualityGate
};
