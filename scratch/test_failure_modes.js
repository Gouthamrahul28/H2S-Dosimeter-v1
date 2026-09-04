/**
 * scratch/test_failure_modes.js
 * Test how the pipeline behaves on corrupted, black, white, and uncalibrated images.
 */

const sharp = require('../backend/node_modules/sharp');
const { processImage } = require('../backend/src/services/imageProcessingPipeline');
const standards = require('../shared/colorimetricStandards.cjs');

async function testCases() {
  console.log('--- Testing Quality Gate Failure Modes ---');

  // Case 1: Pure black image (100% underexposed)
  const blackBuffer = await sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 0, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  const blackRes = await processImage(blackBuffer, { baselineLab: standards.VIRGIN_BASELINE_LAB });
  console.log('Black image:');
  console.log('  quality:', blackRes.quality);
  console.log('  strip rgb:', blackRes.rgb);
  console.log('  lab:', blackRes.lab);
  console.log('  deltaE00:', blackRes.deltaE00);
  const doseBlack = standards.estimateDoseFromDeltaE(blackRes.deltaE00);
  console.log('  dose:', doseBlack);

  // Case 2: Pure white image (100% saturated/glare)
  const whiteBuffer = await sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 255, g: 255, b: 255 } }
  }).jpeg().toBuffer();

  const whiteRes = await processImage(whiteBuffer, { baselineLab: standards.VIRGIN_BASELINE_LAB });
  console.log('\nWhite image:');
  console.log('  quality:', whiteRes.quality);
  console.log('  strip rgb:', whiteRes.rgb);
  console.log('  lab:', whiteRes.lab);
  console.log('  deltaE00:', whiteRes.deltaE00);
  const doseWhite = standards.estimateDoseFromDeltaE(whiteRes.deltaE00);
  console.log('  dose:', doseWhite);
}

testCases().catch(console.error);
