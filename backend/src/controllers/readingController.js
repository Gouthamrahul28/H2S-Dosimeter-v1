const fs = require('fs');
const path = require('path');
const Reading = require('../models/Reading');
const Worker = require('../models/Worker');
const Strip = require('../models/Strip');
const StripBatch = require('../models/StripBatch');
const { extractColorsFromImage } = require('../services/colorExtraction');
const { normalizeLighting } = require('../services/lightingCorrection');
const standards = require('../../../shared/colorimetricStandards.cjs');

// Ensure uploads folder exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper to format remaining duration nicely
function formatRemaining(seconds) {
  if (seconds === null || seconds === undefined) return 'LIFETIME NOT YET VALIDATED';
  if (seconds <= 0) return 'EXPIRED';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * POST /api/v1/scan and POST /api/v1/readings
 * Strict access-controlled Cu-PAN optical scan and exposure estimation with real-time strip life accounting
 */
exports.createReading = async (req, res) => {
  try {
    const {
      workerId,
      shiftId = 'DEFAULT_SHIFT',
      imageBase64,
      ambientTemp = 25.0,
      ambientHumidity = 50.0,
      capturedAt
    } = req.body;

    // --- STEP 1: AUTHENTICATION & WORKER REGISTRATION CHECK ---
    if (!workerId) {
      return res.status(401).json({
        success: false,
        error_code: 'WORKER_NOT_REGISTERED',
        message: 'Worker identification is required before scanning.'
      });
    }

    const worker = await Worker.findOne({ workerId });
    if (!worker) {
      console.warn(`[Backend Security] Rejected scan attempt by unregistered worker: ${workerId}`);
      return res.status(403).json({
        success: false,
        error_code: 'WORKER_NOT_REGISTERED',
        message: 'Worker registration is required before scanning. Please register or contact your supervisor.'
      });
    }

    // --- STEP 2: WORKER STATUS CHECK ---
    if (worker.status === 'INACTIVE' || worker.status === 'BLOCKED') {
      console.warn(`[Backend Security] Rejected scan attempt by ${worker.status} worker: ${workerId}`);
      return res.status(403).json({
        success: false,
        error_code: 'WORKER_BLOCKED',
        message: `Worker account is ${worker.status}. Scanning access is denied.`
      });
    }

    // --- STEP 3: ACTIVE STRIP ASSIGNMENT & LIFECYCLE VALIDATION ---
    let assignedStrip = null;
    if (worker.assignedStripId) {
      assignedStrip = await Strip.findOne({ stripId: worker.assignedStripId });
    }

    if (!assignedStrip) {
      // In fallback, check if any active strip is attached to worker
      assignedStrip = await Strip.findOne({ workerId: worker.workerId, status: { $in: ['ACTIVE', 'EXPIRING_SOON'] } });
    }

    if (!assignedStrip) {
      console.warn(`[Backend Security] Rejected scan attempt: Worker ${workerId} has no active strip assigned.`);
      return res.status(400).json({
        success: false,
        error_code: 'NO_ACTIVE_STRIP',
        message: 'No active Cu-PAN strip assigned. Please attach and activate a valid strip.'
      });
    }

    // Check if batch is recalled
    const batch = await StripBatch.findOne({ batchId: assignedStrip.batchId });
    if (batch && batch.status === 'RECALLED') {
      assignedStrip.status = 'RECALLED';
      assignedStrip.stripStatus = 'RECALLED';
      await assignedStrip.save();
      return res.status(400).json({
        success: false,
        error_code: 'STRIP_RECALLED',
        message: `Assigned strip batch ${assignedStrip.batchId} has been recalled by safety administration.`
      });
    }

    // Check pre-scan sensing capacity & active wear expiry
    const initialLifecycle = assignedStrip.getLifecycleStatus();
    if (initialLifecycle.isExpired || initialLifecycle.isExhausted) {
      assignedStrip.status = 'EXPIRED';
      assignedStrip.stripStatus = initialLifecycle.isExhausted ? 'EXHAUSTED' : 'EXPIRED';
      await assignedStrip.save();

      const errorCode = initialLifecycle.isExhausted ? 'STRIP_EXHAUSTED' : 'STRIP_EXPIRED';
      const errorMsg = initialLifecycle.isExhausted
        ? 'Cu-PAN sensing capacity exhausted. Replace the strip before scanning.'
        : 'Replace the Cu-PAN strip before scanning. The assigned strip has exceeded its active wear life.';

      return res.status(400).json({
        success: false,
        error_code: errorCode,
        message: errorMsg,
        strip: {
          id: assignedStrip.stripId,
          cumulative_dose: assignedStrip.cumulativeDosePpmH,
          max_validated_dose: assignedStrip.maxValidatedDosePpmH,
          life_used_percent: initialLifecycle.lifeUsedPercent,
          life_remaining_percent: initialLifecycle.lifeRemainingPercent,
          status: assignedStrip.stripStatus
        }
      });
    }

    // --- STEP 4: IMAGE DECODING & VALIDATION ---
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'imageBase64 is required for Cu-PAN strip scanning'
      });
    }

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
    const fileName = `cupan-reading-${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    await fs.promises.writeFile(filePath, imageBuffer);
    const imageUrl = `/uploads/${fileName}`;

    const scanId = req.body.scan_id || `cupan_scan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    console.log(`[Backend] Processing authorized Cu-PAN scan ${scanId} for worker ${worker.workerId} (Strip: ${assignedStrip.stripId})`);

    // --- STEP 5: OPTICAL COLOR EXTRACTION & CHROMATIC NORMALIZATION ---
    const { stripColorRGB, referenceColorRGB, greyColorRGB, expiryPatchStatus, qualityGate } = await extractColorsFromImage(imageBuffer);
    const correctedColorRGB = normalizeLighting(stripColorRGB, referenceColorRGB);

    // Analyze Cu-PAN colorimetry and exposure kinetics
    const exposureAnalysis = standards.analyzeExposure(
      correctedColorRGB,
      Number(ambientTemp) || 25.0,
      Number(ambientHumidity) || 50.0
    );

    const calibrationCurveVersion = 'cupan-cielab-v1';
    const scanDose = exposureAnalysis.estimatedDosePpmHours;

    // --- STEP 6: ACCUMULATE STRIP SENSING DOSE & COMPUTE REMAINING LIFE ---
    assignedStrip.cumulativeDosePpmH = Number((assignedStrip.cumulativeDosePpmH || 0) + scanDose);
    assignedStrip.currentDose = scanDose;
    assignedStrip.scanCount = (assignedStrip.scanCount || 0) + 1;

    // Compute updated post-scan lifecycle
    const updatedLifecycle = assignedStrip.getLifecycleStatus();
    assignedStrip.lifeUsedPercent = updatedLifecycle.lifeUsedPercent !== null ? updatedLifecycle.lifeUsedPercent : 0;
    assignedStrip.lifeRemainingPercent = updatedLifecycle.lifeRemainingPercent !== null ? updatedLifecycle.lifeRemainingPercent : 100;
    assignedStrip.stripStatus = updatedLifecycle.stripStatus;
    assignedStrip.status = updatedLifecycle.status;
    await assignedStrip.save();

    // --- STEP 7: SAVE READING RECORD ---
    const reading = new Reading({
      workerId: worker.workerId,
      shiftId,
      scanId,
      stripId: assignedStrip.stripId,
      stripBatch: assignedStrip.batchId,
      cumulativeStripDosePpmH: assignedStrip.cumulativeDosePpmH,
      lifeRemainingPercent: updatedLifecycle.lifeRemainingPercent !== null ? updatedLifecycle.lifeRemainingPercent : 100,
      stripStatus: updatedLifecycle.stripStatus,
      imageUrl,
      chemistry: 'Cu-PAN',
      cameraProfile: req.body.cameraProfile || 'mobile_001',
      stripColorRGB,
      referenceColorRGB,
      greyColorRGB,
      correctedColorRGB: { r: correctedColorRGB.r, g: correctedColorRGB.g, b: correctedColorRGB.b },
      lab: exposureAnalysis.lab,
      deltaE00: exposureAnalysis.deltaE00,
      confidence: qualityGate.passed ? 0.94 : 0.40,
      calibrationStatus: exposureAnalysis.inRange ? 'VALID' : 'OUTSIDE CALIBRATION RANGE',
      expiryPatchStatus,
      ambientTemp: Number(ambientTemp) || 25.0,
      ambientHumidity: Number(ambientHumidity) || 50.0,
      estimatedDosePpmHours: scanDose,
      calibrationCurveVersion,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      createdAt: new Date()
    });

    await reading.save();

    console.log(`[Backend] Completed Cu-PAN scan ${scanId} -> Dose: ${scanDose} ppm·h | Strip Cumulative: ${assignedStrip.cumulativeDosePpmH.toFixed(2)} ppm·h | Remaining Life: ${updatedLifecycle.lifeRemainingPercent}% (${updatedLifecycle.statusLabel})`);

    // --- STEP 8: RETURN AUTHORITATIVE RESPONSE ---
    return res.status(201).json({
      success: true,
      readingId: reading._id.toString(),
      scan_id: scanId,
      chemistry: 'Cu-PAN',
      dose: scanDose,
      unit: 'ppm·h',
      worker: {
        id: worker.workerId,
        name: worker.name,
        status: worker.status
      },
      measurement: {
        dose: scanDose,
        unit: 'ppm·h',
        confidence: reading.confidence,
        alert_level: exposureAnalysis.alertLevel,
        alert_badge: exposureAnalysis.badgeClass,
        deltaE00: exposureAnalysis.deltaE00,
        lab: exposureAnalysis.lab,
        calibration_status: reading.calibrationStatus
      },
      model: {
        model_version: 'CUPAN-MODEL-v2.0',
        dataset_version: 'CUPAN-DATA-200-v2',
        calibration_status: reading.calibrationStatus,
        chemistry: 'Cu-PAN'
      },
      model_version: 'CUPAN-MODEL-v2.0',
      dataset_version: 'CUPAN-DATA-200-v2',
      strip: {
        id: assignedStrip.stripId,
        batch_id: assignedStrip.batchId,
        cumulative_dose: assignedStrip.cumulativeDosePpmH,
        max_validated_dose: assignedStrip.maxValidatedDosePpmH,
        life_used_percent: updatedLifecycle.lifeUsedPercent,
        life_remaining_percent: updatedLifecycle.lifeRemainingPercent,
        status: updatedLifecycle.stripStatus,
        status_label: updatedLifecycle.statusLabel,
        activated_at: assignedStrip.activatedAt,
        expires_at: assignedStrip.activeExpiryAt,
        time_remaining_seconds: updatedLifecycle.remainingSeconds,
        time_remaining_formatted: formatRemaining(updatedLifecycle.remainingSeconds),
        active_life_validated: !!assignedStrip.activeExpiryAt
      },
      strip_life: {
        remaining_percent: updatedLifecycle.lifeRemainingPercent,
        used_percent: updatedLifecycle.lifeUsedPercent,
        cumulative_dose_ppm_h: assignedStrip.cumulativeDosePpmH,
        max_validated_dose_ppm_h: assignedStrip.maxValidatedDosePpmH,
        status: updatedLifecycle.stripStatus,
        status_label: updatedLifecycle.statusLabel,
        replacement_required: updatedLifecycle.replacementRequired,
        replacement_urgency: updatedLifecycle.replacementUrgency,
        time_remaining: updatedLifecycle.remainingSeconds ? formatRemaining(updatedLifecycle.remainingSeconds) : null,
        time_remaining_seconds: updatedLifecycle.remainingSeconds
      },
      replacement: {
        required: updatedLifecycle.replacementRequired,
        expiring_soon: updatedLifecycle.isExpiringSoon,
        remaining_seconds: updatedLifecycle.remainingSeconds,
        remaining_formatted: formatRemaining(updatedLifecycle.remainingSeconds)
      },
      // Backward compatibility fields for dashboard and mobile clients
      estimatedDosePpmHours: scanDose,
      alertLevel: exposureAnalysis.alertLevel,
      badgeClass: exposureAnalysis.badgeClass,
      deltaE00: exposureAnalysis.deltaE00,
      lab: exposureAnalysis.lab,
      correctedColorRGB: reading.correctedColorRGB,
      stripColorRGB: reading.stripColorRGB,
      referenceColorRGB: reading.referenceColorRGB,
      expiryPatchStatus: reading.expiryPatchStatus,
      confidence: reading.confidence,
      calibrationStatus: reading.calibrationStatus,
      capturedAt: reading.capturedAt
    });
  } catch (error) {
    console.error('[ReadingController] Error processing scan:', error);
    return res.status(500).json({ success: false, error: 'Internal server error while processing Cu-PAN scan.' });
  }
};

/**
 * GET /api/v1/workers/:workerId/readings
 * Retrieve all historical readings for a worker across all strips
 */
exports.getReadingsByWorker = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { stripId } = req.query;

    const query = { workerId };
    if (stripId) query.stripId = stripId;

    const readings = await Reading.find(query).sort({ capturedAt: -1 });
    return res.status(200).json(readings);
  } catch (error) {
    console.error('[ReadingController] Error fetching worker readings:', error);
    return res.status(500).json({ error: 'Failed to retrieve worker readings.' });
  }
};
