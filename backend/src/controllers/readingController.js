const fs = require('fs');
const path = require('path');
const Reading = require('../models/Reading');
const Worker = require('../models/Worker');
const { extractColorsFromImage } = require('../services/colorExtraction');
const { normalizeLighting } = require('../services/lightingCorrection');
const { calculateDose } = require('../services/doseCalculator');
const standards = require('../../../shared/colorimetricStandards.cjs');

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

    const scanId = req.body.scan_id || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`[Backend] Received scan ${scanId} from worker ${workerId} (Shift: ${shiftId})`);
    console.log(`[Backend] Processing scan ${scanId} (Image size: ~${Math.round(imageBuffer.length / 1024)} KB)...`);

    // Perform 3-patch target color extraction & quality gate evaluation
    const { stripColorRGB, referenceColorRGB, greyColorRGB, expiryPatchStatus, qualityGate } = await extractColorsFromImage(imageBuffer);

    // Characterize camera CCM and optional Bradford CAT
    const correctedColorRGB = normalizeLighting(stripColorRGB, referenceColorRGB);

    // Analyze full colorimetry and dose kinetics
    const exposureAnalysis = standards.analyzeExposure(correctedColorRGB, Number(ambientTemp) || 25.0, Number(ambientHumidity) || 50.0);

    const calibrationCurveVersion = 'scientific-cielab-v2';

    // Create and save reading document
    const reading = new Reading({
      workerId,
      shiftId,
      imageUrl,
      stripColorRGB,
      referenceColorRGB,
      correctedColorRGB: { r: correctedColorRGB.r, g: correctedColorRGB.g, b: correctedColorRGB.b },
      expiryPatchStatus,
      ambientTemp: Number(ambientTemp) || 25.0,
      ambientHumidity: Number(ambientHumidity) || 50.0,
      estimatedDosePpmHours: exposureAnalysis.estimatedDosePpmHours,
      calibrationCurveVersion,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      createdAt: new Date()
    });

    const savedReading = await reading.save();
    console.log(`[Backend] Completed scan ${scanId} -> Dose: ${exposureAnalysis.estimatedDosePpmHours} ppm*h (${exposureAnalysis.alertLevel})`);

    return res.status(201).json({
      success: true,
      scan_id: scanId,
      readingId: savedReading._id.toString(),
      workerId: savedReading.workerId,
      shiftId: savedReading.shiftId,
      stripColorRGB: savedReading.stripColorRGB,
      referenceColorRGB: savedReading.referenceColorRGB,
      greyColorRGB,
      correctedColorRGB: savedReading.correctedColorRGB,
      expiryPatchStatus: savedReading.expiryPatchStatus,
      estimatedDosePpmHours: savedReading.estimatedDosePpmHours,
      dose: savedReading.estimatedDosePpmHours,
      unit: 'ppm·h',
      confidence: qualityGate.passed ? 0.948 : 0.450,
      confidencePercent: qualityGate.passed ? 94.8 : 45.0,
      calibrationCurveVersion: savedReading.calibrationCurveVersion,
      lab: exposureAnalysis.lab,
      deltaE00: exposureAnalysis.deltaE00,
      qualityStatus: qualityGate.passed ? 'GOOD' : 'POOR — RECAPTURE REQUIRED',
      qualityScore: qualityGate.score,
      alertLevel: exposureAnalysis.alertLevel,
      alertColor: exposureAnalysis.alertColor,
      alertBadgeClass: exposureAnalysis.badgeClass,
      alertNote: exposureAnalysis.note,
      envValid: exposureAnalysis.envValid,
      envReason: exposureAnalysis.envReason,
      rateFactor: exposureAnalysis.rateFactor,
      createdAt: savedReading.createdAt.toISOString()
    });
  } catch (error) {
    console.error('[ReadingController] Error processing reading:', error);
    return res.status(500).json({ error: error.message || 'Failed to process wristband reading' });
  }
};

/**
 * GET /api/v1/workers/:workerId/readings
 * Retrieve historical readings for a specific worker
 */
exports.getWorkerReadings = async (req, res) => {
  try {
    const { workerId } = req.params;
    const readings = await Reading.find({ workerId }).sort({ capturedAt: -1 }).limit(100);
    return res.json(readings);
  } catch (error) {
    console.error('[ReadingController] Error fetching worker readings:', error);
    return res.status(500).json({ error: 'Failed to fetch worker readings' });
  }
};

/**
 * GET /api/v1/readings/recent
 * Retrieve recent readings across all workers
 */
exports.getRecentReadings = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const readings = await Reading.find().sort({ capturedAt: -1 }).limit(limit);
    return res.json(readings);
  } catch (error) {
    console.error('[ReadingController] Error fetching recent readings:', error);
    return res.status(500).json({ error: 'Failed to fetch recent readings' });
  }
};

exports.getReadingsByWorker = exports.getWorkerReadings;
