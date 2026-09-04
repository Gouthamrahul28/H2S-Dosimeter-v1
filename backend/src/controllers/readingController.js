const fs = require('fs');
const path = require('path');
const Reading = require('../models/Reading');
const Worker = require('../models/Worker');
const Strip = require('../models/Strip');
const StripBatch = require('../models/StripBatch');
const { processImage } = require('../services/imageProcessingPipeline');
const { extractColorsFromImage } = require('../services/colorExtraction');
const { normalizeLighting } = require('../services/lightingCorrection');
const standards = require('../../../shared/colorimetricStandards.cjs');
const {
  normalizeChemistryId,
  getChemistryConfig,
  validateModelChemistryMatch,
  CHEMISTRY_IDS
} = require('../../../shared/chemistryRegistry.cjs');
const { leadAcetateModelInstance } = require('../services/leadAcetateCalibrationService');

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

    // Resolve Strip Chemistry & Configuration
    const rawChem = assignedStrip.chemistry || batch?.chemistry || req.body.chemistry || 'CU_PAN';
    const stripChemistry = normalizeChemistryId(rawChem) || CHEMISTRY_IDS.CU_PAN;
    const chemistryConfig = getChemistryConfig(stripChemistry);

    // Hard Isolation Rule 1: Validate Model Chemistry Match if explicitly requested
    const requestedModelChem = req.body.model_chemistry || req.body.modelChemistry;
    if (requestedModelChem) {
      const matchCheck = validateModelChemistryMatch(stripChemistry, requestedModelChem);
      if (!matchCheck.valid) {
        return res.status(400).json({
          success: false,
          error_code: matchCheck.errorCode,
          calibration_status: 'MODEL_CHEMISTRY_MISMATCH',
          message: matchCheck.error,
          sensor_chemistry: stripChemistry,
          requested_model_chemistry: normalizeChemistryId(requestedModelChem)
        });
      }
    }

    // Hard Isolation Rule 2: Verify calibration availability for sensor chemistry
    if (stripChemistry === CHEMISTRY_IDS.LEAD_ACETATE) {
      // Non-negotiable Rule: DO NOT copy Cu-PAN calibration into Lead Acetate.
      // Explicitly report unavailable state, DO NOT return fake 0.0 ppm.
      if (!leadAcetateModelInstance.isFitted && (!chemistryConfig.calibrationModel || chemistryConfig.calibrationStatus === 'CALIBRATION_DATA_REQUIRED')) {
        return res.status(422).json({
          success: false,
          error_code: 'CALIBRATION_UNAVAILABLE',
          calibration_status: 'CALIBRATION_DATA_REQUIRED',
          chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
          display_name: chemistryConfig.displayName,
          message: 'Lead Acetate calibration is not available. Real experimental calibration data is required before exposure can be calculated.',
          strip: {
            id: assignedStrip.stripId,
            batch_id: assignedStrip.batchId,
            chemistry: CHEMISTRY_IDS.LEAD_ACETATE
          }
        });
      }
    }

    // Check pre-scan sensing capacity & active wear expiry
    const initialLifecycle = assignedStrip.getLifecycleStatus();
    if (initialLifecycle.isExpired || initialLifecycle.isExhausted) {
      assignedStrip.status = 'EXPIRED';
      assignedStrip.stripStatus = initialLifecycle.isExhausted ? 'EXHAUSTED' : 'EXPIRED';
      await assignedStrip.save();

      const errorCode = initialLifecycle.isExhausted ? 'STRIP_EXHAUSTED' : 'STRIP_EXPIRED';
      const errorMsg = initialLifecycle.isExhausted
        ? `${chemistryConfig.displayName} sensing capacity exhausted. Replace the strip before scanning.`
        : `Replace the ${chemistryConfig.displayName} strip before scanning. The assigned strip has exceeded its active wear life.`;

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
          status: assignedStrip.stripStatus,
          chemistry: stripChemistry
        }
      });
    }

    // --- STEP 4: IMAGE DECODING & VALIDATION ---
    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: `imageBase64 is required for ${chemistryConfig.displayName} strip scanning`
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

    // --- STEP 5: STANDARDIZED OPTICAL COLOR EXTRACTION & CHROMATIC ADAPTATION ---
    const opticalResult = await processImage(imageBuffer, {
      baselineLab: stripChemistry === CHEMISTRY_IDS.CU_PAN ? standards.VIRGIN_BASELINE_LAB : null
    });

    const stripColorRGB = opticalResult.rgb;
    const referenceColorRGB = opticalResult.referenceColor.white.rgb;
    const greyColorRGB = opticalResult.referenceColor.grey.rgb;
    const correctedColorRGB = opticalResult.correctedRgb;
    const qualityGate = opticalResult.quality;
    if (!qualityGate.passed) {
      console.warn(`[Backend Optical Gate] Scan rejected for worker ${worker.workerId}: ${qualityGate.reasons.join('; ')}`);
      return res.status(422).json({
        success: false,
        error_code: 'IMAGE_PROCESSING_FAILED',
        calibration_status: 'IMAGE_PROCESSING_FAILED',
        dose: null,
        message: `Optical image quality gate rejected frame: ${qualityGate.reasons.join('; ')}`,
        quality: qualityGate
      });
    }

    const expiryPatchStatus = qualityGate.passed ? 'valid' : 'unreadable';

    // --- STEP 6: CHEMISTRY-SPECIFIC EXPOSURE DOSIMETRY INTERPRETATION ---
    let scanDose = null;
    let exposureAnalysis = null;
    let calibrationCurveVersion = 'cupan-cielab-v1';

    if (stripChemistry === CHEMISTRY_IDS.CU_PAN) {
      // Analyze Cu-PAN exposure kinetics using chromatically adapted Lab & CIEDE2000
      const deltaE00 = opticalResult.deltaE00 !== null ? opticalResult.deltaE00 : standards.ciede2000(standards.VIRGIN_BASELINE_LAB, opticalResult.lab);
      const doseEst = standards.estimateDoseFromDeltaE(deltaE00, Number(ambientTemp) || 25.0, Number(ambientHumidity) || 50.0);
      const riskZone = standards.ppmToAlertLevel(doseEst.dosePpmHours);

      exposureAnalysis = {
        chemistry: 'Cu-PAN',
        dose: doseEst.dosePpmHours,
        estimatedDosePpmHours: doseEst.dosePpmHours,
        unit: 'ppm·h',
        alertLevel: riskZone.level,
        alertColor: riskZone.color,
        badgeClass: riskZone.badgeClass,
        note: riskZone.note,
        deltaE00,
        lab: opticalResult.lab,
        inRange: doseEst.inRange,
        isVirginBaseline: !!doseEst.isVirginBaseline,
        calibrationStatus: doseEst.status,
        confidence: qualityGate.passed ? (doseEst.inRange ? 0.94 : 0.60) : 0.40
      };

      scanDose = doseEst.dosePpmHours;
    } else if (stripChemistry === CHEMISTRY_IDS.LEAD_ACETATE) {
      // Analyze Lead Acetate exposure using fitted LeadAcetateModelV1
      const pred = leadAcetateModelInstance.predict({
        sensor_chemistry: CHEMISTRY_IDS.LEAD_ACETATE,
        deltaE00: opticalResult.deltaE00,
        L: opticalResult.lab.L,
        a: opticalResult.lab.a,
        b: opticalResult.lab.b,
        temperature: Number(ambientTemp) || 25.0,
        humidity: Number(ambientHumidity) || 50.0
      });

      const isSafe = (pred.dosePpmHours || 0) <= 5.0;
      const isWarning = (pred.dosePpmHours || 0) > 5.0 && (pred.dosePpmHours || 0) <= 15.0;
      const alertLvl = pred.status === 'VALID_ESTIMATE' ? (isSafe ? 'SAFE' : isWarning ? 'WARNING' : 'DANGER') : 'CAUTION';

      exposureAnalysis = {
        chemistry: 'LEAD_ACETATE',
        dose: pred.dosePpmHours,
        estimatedDosePpmHours: pred.dosePpmHours,
        unit: 'mL_H2S',
        alertLevel: alertLvl,
        alertColor: alertLvl === 'SAFE' ? '#10b981' : alertLvl === 'WARNING' ? '#f59e0b' : '#f43f5e',
        badgeClass: alertLvl === 'SAFE' ? 'safe' : alertLvl === 'WARNING' ? 'warning' : 'severe',
        note: `Lead acetate optical darkening relative dose: ${pred.dosePpmHours !== null ? pred.dosePpmHours.toFixed(1) : '--'} mL H2S`,
        deltaE00: opticalResult.deltaE00,
        lab: opticalResult.lab,
        inRange: pred.isCalibratedDomain,
        isVirginBaseline: pred.dosePpmHours === 0.0,
        calibrationStatus: pred.status,
        confidence: pred.confidence
      };

      scanDose = pred.dosePpmHours;
      calibrationCurveVersion = 'lead_acetate_model_v1';
    }

    // --- STEP 6: ACCUMULATE STRIP SENSING DOSE & COMPUTE REMAINING LIFE ---
    if (scanDose !== null && typeof scanDose === 'number') {
      assignedStrip.cumulativeDosePpmH = Number((assignedStrip.cumulativeDosePpmH || 0) + scanDose);
      assignedStrip.currentDose = scanDose;
      assignedStrip.scanCount = (assignedStrip.scanCount || 0) + 1;
    }

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
      chemistry: stripChemistry,
      cameraProfile: req.body.cameraProfile || 'mobile_001',
      stripColorRGB,
      referenceColorRGB,
      greyColorRGB,
      correctedColorRGB: { r: correctedColorRGB.r, g: correctedColorRGB.g, b: correctedColorRGB.b },
      lab: exposureAnalysis ? exposureAnalysis.lab : opticalResult.lab,
      deltaE00: exposureAnalysis ? exposureAnalysis.deltaE00 : opticalResult.deltaE00,
      confidence: qualityGate.passed ? (exposureAnalysis?.confidence || 0.94) : 0.40,
      calibrationStatus: exposureAnalysis ? (exposureAnalysis.inRange ? (exposureAnalysis.calibrationStatus || 'VALID') : 'OUTSIDE CALIBRATION RANGE') : 'CALIBRATION_UNAVAILABLE',
      isVirginBaseline: exposureAnalysis?.isVirginBaseline || false,
      expiryPatchStatus,
      ambientTemp: Number(ambientTemp) || 25.0,
      ambientHumidity: Number(ambientHumidity) || 50.0,
      estimatedDosePpmHours: scanDose,
      calibrationCurveVersion,
      capturedAt: capturedAt ? new Date(capturedAt) : new Date(),
      createdAt: new Date()
    });

    await reading.save();

    const displayUnit = exposureAnalysis?.unit || 'ppm·h';
    console.log(`[Backend] Completed ${stripChemistry} scan ${scanId} -> Dose: ${scanDose !== null ? scanDose : '--'} ${displayUnit} | Strip Cumulative: ${assignedStrip.cumulativeDosePpmH.toFixed(2)} | Remaining Life: ${updatedLifecycle.lifeRemainingPercent}% (${updatedLifecycle.statusLabel})`);

    // --- STEP 8: RETURN AUTHORITATIVE RESPONSE ---
    return res.status(201).json({
      success: true,
      readingId: reading._id.toString(),
      scan_id: scanId,
      chemistry: stripChemistry,
      chemistry_display: chemistryConfig.displayName,
      dose: scanDose,
      unit: displayUnit,
      isVirginBaseline: exposureAnalysis?.isVirginBaseline || false,
      worker: {
        id: worker.workerId,
        name: worker.name,
        status: worker.status
      },
      measurement: {
        dose: scanDose,
        unit: displayUnit,
        confidence: reading.confidence,
        alert_level: exposureAnalysis?.alertLevel || 'SAFE',
        alert_badge: exposureAnalysis?.badgeClass || 'safe',
        deltaE00: exposureAnalysis?.deltaE00 || opticalResult.deltaE00,
        lab: exposureAnalysis?.lab || opticalResult.lab,
        calibration_status: reading.calibrationStatus,
        isVirginBaseline: exposureAnalysis?.isVirginBaseline || false
      },
      model: {
        model_version: stripChemistry === CHEMISTRY_IDS.LEAD_ACETATE ? 'LEAD_ACETATE_MODEL_V1' : 'CUPAN-MODEL-v2.0',
        dataset_version: stripChemistry === CHEMISTRY_IDS.LEAD_ACETATE ? 'LEAD_ACETATE_DATASET_V1' : 'CUPAN-DATA-200-v2',
        calibration_status: reading.calibrationStatus,
        chemistry: stripChemistry
      },
      model_version: stripChemistry === CHEMISTRY_IDS.LEAD_ACETATE ? 'LEAD_ACETATE_MODEL_V1' : 'CUPAN-MODEL-v2.0',
      dataset_version: stripChemistry === CHEMISTRY_IDS.LEAD_ACETATE ? 'LEAD_ACETATE_DATASET_V1' : 'CUPAN-DATA-200-v2',
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
        active_life_validated: !!assignedStrip.activeExpiryAt,
        chemistry: stripChemistry
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
      sensor_chemistry: stripChemistry,
      quality: qualityGate,
      quality_score: qualityGate?.score || 95,
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
    return res.status(500).json({ success: false, error: 'Internal server error while processing dosimeter scan.' });
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
