/**
 * backend/src/services/colorExtraction.js
 * 
 * Extracts RGB values from distinct spatial zones on the H2S dosimeter wristband:
 * 1. Reference Patch (Top-Left): Known printed color/white reference standard
 * 2. Active H2S Strip (Center): Chemical strip that darkens with cumulative exposure
 * 3. Expiry / Shelf-Life Patch (Top-Right): Chemical indicator for patch shelf validity
 * 
 * NOTE: The exact physical patch coordinates on the production wristband may be adjusted.
 * We sample from configurable normalized percentage bounding boxes:
 * - Reference Patch: Top-Left (x: 10%-30%, y: 10%-30%)
 * - Active Strip: Center (x: 38%-62%, y: 38%-62%)
 * - Expiry Patch: Top-Right (x: 70%-90%, y: 10%-30%)
 */

const sharp = require('sharp');

// Configurable region definitions (relative coordinates 0.0 to 1.0)
const REGION_BOUNDS = {
  reference: { left: 0.10, top: 0.10, width: 0.20, height: 0.20 },
  strip:     { left: 0.38, top: 0.38, width: 0.24, height: 0.24 },
  expiry:    { left: 0.70, top: 0.10, width: 0.20, height: 0.20 }
};

/**
 * Calculates the average RGB values across a raw pixel buffer (RGB channels)
 */
function computeAverageRGB(rawBuffer, channels = 3) {
  if (!rawBuffer || rawBuffer.length === 0) {
    return { r: 128, g: 128, b: 128 };
  }
  let sumR = 0, sumG = 0, sumB = 0;
  const totalPixels = Math.floor(rawBuffer.length / channels);

  for (let i = 0; i < rawBuffer.length; i += channels) {
    sumR += rawBuffer[i];
    sumG += rawBuffer[i + 1];
    sumB += rawBuffer[i + 2];
  }

  return {
    r: Math.round(sumR / totalPixels),
    g: Math.round(sumG / totalPixels),
    b: Math.round(sumB / totalPixels)
  };
}

/**
 * Evaluates the status of the expiry patch based on color analysis and image quality.
 * Returns: "valid" | "expired" | "unreadable"
 */
function evaluateExpiryPatch(expiryRGB, referenceRGB, imageMeanLuminance) {
  // Check if image is too dark or degraded for confident reading
  if (imageMeanLuminance < 25 || !expiryRGB || !referenceRGB) {
    return 'unreadable';
  }

  // Calculate relative luminance / darkness of expiry patch compared to reference
  // In our physical spec, an unexpired patch is bright/light (high RGB),
  // while an expired patch darkens below the threshold.
  const expiryLuminance = (0.299 * expiryRGB.r + 0.587 * expiryRGB.g + 0.114 * expiryRGB.b);
  const refLuminance = (0.299 * referenceRGB.r + 0.587 * referenceRGB.g + 0.114 * referenceRGB.b);

  // If contrast between reference and expiry patch indicates over-aging/chemical breakdown
  if (expiryLuminance < 60 || (refLuminance > 150 && (expiryLuminance / refLuminance) < 0.35)) {
    return 'expired';
  }

  return 'valid';
}

/**
 * Extracts sampled RGB colors from an image buffer
 * @param {Buffer} imageBuffer - Raw image buffer (JPEG/PNG)
 * @returns {Promise<Object>} Extracted RGB values and expiry patch status
 */
async function extractColorsFromImage(imageBuffer) {
  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    const imgWidth = metadata.width || 640;
    const imgHeight = metadata.height || 480;

    // Helper to extract a crop region and calculate mean RGB
    const extractRegionRGB = async (bounds) => {
      const left = Math.max(0, Math.floor(bounds.left * imgWidth));
      const top = Math.max(0, Math.floor(bounds.top * imgHeight));
      const width = Math.min(imgWidth - left, Math.max(10, Math.floor(bounds.width * imgWidth)));
      const height = Math.min(imgHeight - top, Math.max(10, Math.floor(bounds.height * imgHeight)));

      const { data, info } = await sharp(imageBuffer)
        .extract({ left, top, width, height })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      return computeAverageRGB(data, info.channels);
    };

    // Extract average RGB for all 3 regions concurrently
    const [referenceColorRGB, stripColorRGB, expiryColorRGB] = await Promise.all([
      extractRegionRGB(REGION_BOUNDS.reference),
      extractRegionRGB(REGION_BOUNDS.strip),
      extractRegionRGB(REGION_BOUNDS.expiry)
    ]);

    // Compute overall image brightness for quality assessment
    const stats = await image.stats();
    const meanLuminance = stats.channels
      ? (stats.channels[0].mean * 0.299 + stats.channels[1].mean * 0.587 + stats.channels[2].mean * 0.114)
      : 128;

    const expiryPatchStatus = evaluateExpiryPatch(expiryColorRGB, referenceColorRGB, meanLuminance);

    return {
      referenceColorRGB,
      stripColorRGB,
      expiryColorRGB,
      expiryPatchStatus
    };
  } catch (error) {
    console.error('[ColorExtraction] Error processing image:', error.message);
    // Fallback gracefully in case of unexpected image encoding
    return {
      referenceColorRGB: { r: 245, g: 245, b: 245 },
      stripColorRGB: { r: 160, g: 120, b: 190 },
      expiryColorRGB: { r: 230, g: 230, b: 230 },
      expiryPatchStatus: 'unreadable'
    };
  }
}

module.exports = {
  extractColorsFromImage,
  REGION_BOUNDS,
  evaluateExpiryPatch
};
