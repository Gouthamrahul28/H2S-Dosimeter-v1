/**
 * backend/src/services/colorExtraction.js
 * 
 * Standardized Region of Interest extraction adapter.
 * Delegates to backend/src/services/imageProcessingPipeline.js.
 * Eliminates legacy synthetic { 120, 120, 120 } fallbacks.
 */

const { processImage, TARGET_REGIONS } = require('./imageProcessingPipeline');

const REGION_BOUNDS = TARGET_REGIONS;

/**
 * Extracts 3-patch target RGBs and evaluates quality gate.
 * 
 * @param {Buffer} imageBuffer - Raw image buffer
 * @returns {Promise<object>} Extracted color and quality gate data
 */
async function extractColorsFromImage(imageBuffer) {
  try {
    const pipelineResult = await processImage(imageBuffer);

    return {
      stripColorRGB: pipelineResult.rgb,
      referenceColorRGB: pipelineResult.referenceColor.white.rgb,
      greyColorRGB: pipelineResult.referenceColor.grey.rgb,
      expiryPatchStatus: pipelineResult.quality.passed ? 'valid' : 'unreadable',
      qualityGate: pipelineResult.quality,
      stripVariance: 0,
      opticalResult: pipelineResult
    };
  } catch (err) {
    console.error('[ColorExtraction] Extraction error:', err.message);
    return {
      stripColorRGB: { r: 0, g: 0, b: 0 },
      referenceColorRGB: { r: 0, g: 0, b: 0 },
      greyColorRGB: { r: 0, g: 0, b: 0 },
      expiryPatchStatus: 'unreadable',
      qualityGate: {
        passed: false,
        score: 0,
        saturationRatio: 0,
        underexposedRatio: 0,
        reasons: [`Optical extraction failed: ${err.message}`]
      },
      stripVariance: 0
    };
  }
}

module.exports = {
  extractColorsFromImage,
  REGION_BOUNDS
};
