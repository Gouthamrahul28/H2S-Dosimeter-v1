const fs = require('fs');
const path = require('path');
const Reading = require('../models/Reading');
const Worker = require('../models/Worker');
const { extractColorsFromImage } = require('../services/colorExtraction');
const { normalizeLighting } = require('../services/lightingCorrection');
const { calculateDose } = require('../services/doseCalculator');

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * POST /api/v1/readings
 * Submit a captured wristband photo for processing
 */
exports.createReading = async (req, res) => {
  try {
    const { workerId, shiftId, imageBase64, ambientTemp = 25.0, ambientHumidity = 50.0, capturedAt } = req.body;

    if (!workerId || !shiftId || !imageBase64) {
      return res.status(400).json({ error: 'workerId, shiftId, and imageBase64 are required fields' });
    }

    // Decode base64 image data
    let base64Data = imageBase64;
    let fileExtension = 'jpg';

    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const mime = parts[0];
      base64Data = parts[1];
      if (mime.includes('png')) fileExtension = 'png';
      else if (mime.includes('webp')) fileExtension = 'webp';
    }

    const imageBuffer = Buffer.from(base64Data, 'base64');
    const fileName = `reading-${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    // Save image to disk
    await fs.promises.writeFile(filePath, imageBuffer);
    const imageUrl = `/uploads/${fileName}`;

    // Perform color extraction on wristband zones
    const { stripColorRGB, referenceColorRGB, expiryPatchStatus } = await extractColorsFromImage(imageBuffer);

    // Normalize lighting against reference patch
    const correctedColorRGB = normalizeLighting(stripColorRGB, referenceColorRGB);

    // Calculate estimated cumulative dose
    const calibrationCurveVersion = process.env.CALIBRATION_CURVE_VERSION || 'placeholder-v1';
    const estimatedDosePpmHours = calculateDose(
      correctedColorRGB,
      ambientTemp,
      ambientHumidity,
      calibrationCurveVersion
    );

    // Create and save reading document
    const reading = new Reading({
      workerId,
      shiftId,
      imageUrl,
      stripColorRGB,
      referenceColorRGB,
      correctedColorRGB,
      expiryPatchStatus,
      ambientTemp: Number(ambientTemp) || 25.0,
      ambientHumidity: Number(ambientHumidity) || 50.0,
      estimatedDosePpmHours,
      calibrationCurveVersion,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      createdAt: new Date()
    });

    const savedReading = await reading.save();

    return res.status(201).json({
      readingId: savedReading._id.toString(),
      workerId: savedReading.workerId,
      shiftId: savedReading.shiftId,
      stripColorRGB: savedReading.stripColorRGB,
      referenceColorRGB: savedReading.referenceColorRGB,
      correctedColorRGB: savedReading.correctedColorRGB,
      expiryPatchStatus: savedReading.expiryPatchStatus,
      estimatedDosePpmHours: savedReading.estimatedDosePpmHours,
      calibrationCurveVersion: savedReading.calibrationCurveVersion,
      createdAt: savedReading.createdAt.toISOString()
    });
  } catch (error) {
    console.error('[ReadingController] Error processing reading:', error);
    return res.status(500).json({ error: error.message || 'Failed to process wristband reading' });
  }
};

/**
 * GET /api/v1/workers/:workerId/readings
 * Get all readings for one worker, most recent first
 */
exports.getReadingsByWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    const readings = await Reading.find({ workerId }).sort({ capturedAt: -1, createdAt: -1 });

    const formatted = readings.map((r) => ({
      readingId: r._id.toString(),
      workerId: r.workerId,
      shiftId: r.shiftId,
      stripColorRGB: r.stripColorRGB,
      referenceColorRGB: r.referenceColorRGB,
      correctedColorRGB: r.correctedColorRGB,
      expiryPatchStatus: r.expiryPatchStatus,
      estimatedDosePpmHours: r.estimatedDosePpmHours,
      calibrationCurveVersion: r.calibrationCurveVersion,
      createdAt: r.createdAt.toISOString()
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[ReadingController] Error fetching worker readings:', error);
    return res.status(500).json({ error: 'Failed to retrieve worker exposure readings' });
  }
};
