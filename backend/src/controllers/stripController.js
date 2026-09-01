const Strip = require('../models/Strip');
const StripBatch = require('../models/StripBatch');
const Worker = require('../models/Worker');
const Reading = require('../models/Reading');

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
 * GET /api/v1/workers/:workerId/active-strip
 * Retrieve the current active Cu-PAN strip assigned to a worker with live countdown and sensing capacity
 */
exports.getActiveStripForWorker = async (req, res) => {
  try {
    const { workerId } = req.params;

    const worker = await Worker.findOne({ workerId });
    if (!worker) {
      return res.status(404).json({
        success: false,
        error_code: 'WORKER_NOT_REGISTERED',
        message: 'Worker not found in the registry.'
      });
    }

    if (!worker.assignedStripId) {
      return res.status(200).json({
        success: true,
        workerId: worker.workerId,
        hasActiveStrip: false,
        strip: null,
        message: 'No active Cu-PAN strip currently assigned.'
      });
    }

    const strip = await Strip.findOne({ stripId: worker.assignedStripId });
    if (!strip) {
      return res.status(200).json({
        success: true,
        workerId: worker.workerId,
        hasActiveStrip: false,
        strip: null,
        message: 'Assigned strip record not found.'
      });
    }

    const batch = await StripBatch.findOne({ batchId: strip.batchId });
    const lifecycle = strip.getLifecycleStatus();

    // Update DB status if not already set
    if (strip.stripStatus !== lifecycle.stripStatus || strip.status !== lifecycle.status) {
      strip.status = lifecycle.status;
      strip.stripStatus = lifecycle.stripStatus;
      strip.lifeUsedPercent = lifecycle.lifeUsedPercent !== null ? lifecycle.lifeUsedPercent : 0;
      strip.lifeRemainingPercent = lifecycle.lifeRemainingPercent !== null ? lifecycle.lifeRemainingPercent : 100;
      await strip.save();
    }

    return res.status(200).json({
      success: true,
      workerId: worker.workerId,
      hasActiveStrip: !lifecycle.isExpired && !lifecycle.isExhausted && strip.status !== 'RECALLED',
      strip: {
        stripId: strip.stripId,
        batchId: strip.batchId,
        status: lifecycle.status,
        stripStatus: lifecycle.stripStatus,
        statusLabel: lifecycle.statusLabel,
        cumulativeDosePpmH: lifecycle.cumulativeDosePpmH,
        maxValidatedDosePpmH: lifecycle.maxValidatedDosePpmH,
        lifeUsedPercent: lifecycle.lifeUsedPercent,
        lifeRemainingPercent: lifecycle.lifeRemainingPercent,
        activatedAt: strip.activatedAt,
        activeExpiryAt: strip.activeExpiryAt,
        scanCount: strip.scanCount,
        currentDose: strip.currentDose,
        remainingSeconds: lifecycle.remainingSeconds,
        remainingFormatted: formatRemaining(lifecycle.remainingSeconds),
        isExpiringSoon: lifecycle.isExpiringSoon,
        isExpired: lifecycle.isExpired,
        isExhausted: lifecycle.isExhausted,
        replacementRequired: lifecycle.replacementRequired,
        replacementUrgency: lifecycle.replacementUrgency,
        activeLifeValidated: !!strip.activeExpiryAt,
        batch: batch ? {
          batchId: batch.batchId,
          manufacturedAt: batch.manufacturedAt,
          validatedShelfLifeDays: batch.validatedShelfLifeDays,
          maxValidatedDosePpmH: batch.maxValidatedDosePpmH,
          shelfLifeValidated: !!batch.validatedShelfLifeDays,
          status: batch.status
        } : null
      }
    });
  } catch (error) {
    console.error('[StripController] Error getting active strip:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve active strip info.' });
  }
};

/**
 * POST /api/v1/strip/activate
 * Assign and activate a new Cu-PAN strip for a registered worker
 */
exports.activateStrip = async (req, res) => {
  try {
    const { workerId, stripId, batchId = 'CUPAN-BATCH-001', qrCodePayload } = req.body;

    if (!workerId || !stripId) {
      return res.status(400).json({
        success: false,
        error_code: 'INVALID_PARAMETERS',
        message: 'workerId and stripId are required.'
      });
    }

    // 1. Verify worker registration & status
    const worker = await Worker.findOne({ workerId });
    if (!worker) {
      return res.status(403).json({
        success: false,
        error_code: 'WORKER_NOT_REGISTERED',
        message: 'Worker registration is required before activating a strip.'
      });
    }

    if (worker.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error_code: 'WORKER_BLOCKED',
        message: `Worker account is ${worker.status}. Contact supervisor.`
      });
    }

    // 2. Verify or create batch
    let batch = await StripBatch.findOne({ batchId });
    if (!batch) {
      batch = new StripBatch({
        batchId,
        chemistry: 'Cu-PAN',
        maxValidatedDosePpmH: 160.0,
        status: 'NOT_YET_VALIDATED'
      });
      await batch.save();
    }

    if (batch.status === 'RECALLED') {
      return res.status(400).json({
        success: false,
        error_code: 'BATCH_RECALLED',
        message: `Batch ${batchId} has been recalled by safety administration. Cannot activate.`
      });
    }

    // Check shelf-life expiry prior to use (if validated)
    if (batch.expiryAt && new Date() > new Date(batch.expiryAt)) {
      return res.status(400).json({
        success: false,
        error_code: 'BATCH_SHELF_LIFE_EXPIRED',
        message: `This strip has exceeded its validated storage shelf life (${batch.expiryAt.toISOString()}).`
      });
    }

    // 3. Mark any existing active strip for this worker as USED
    if (worker.assignedStripId) {
      await Strip.updateMany(
        { stripId: worker.assignedStripId, workerId },
        { status: 'USED', stripStatus: 'EXHAUSTED' }
      );
    }

    // 4. Find or create the strip instance
    let strip = await Strip.findOne({ stripId });
    if (!strip) {
      strip = new Strip({
        stripId,
        batchId,
        qrCodePayload: qrCodePayload || stripId
      });
    }

    const now = new Date();
    strip.workerId = worker.workerId;
    strip.assignedAt = now;
    strip.activatedAt = now;
    strip.status = 'ACTIVE';
    strip.stripStatus = 'GOOD';
    strip.scanCount = 0;
    strip.currentDose = 0.0;
    strip.cumulativeDosePpmH = 0.0;
    strip.maxValidatedDosePpmH = batch.maxValidatedDosePpmH || 160.0;
    strip.lifeUsedPercent = 0;
    strip.lifeRemainingPercent = 100;

    // Compute active wear life expiry only if batch has validatedActiveLifeHours
    if (batch.validatedActiveLifeHours && batch.validatedActiveLifeHours > 0) {
      strip.activeExpiryAt = new Date(now.getTime() + batch.validatedActiveLifeHours * 3600 * 1000);
    } else {
      strip.activeExpiryAt = null; // Stated as NOT YET VALIDATED
    }

    await strip.save();

    // 5. Update worker record
    worker.assignedStripId = strip.stripId;
    await worker.save();

    const lifecycle = strip.getLifecycleStatus();

    console.log(`[StripController] Worker ${workerId} activated fresh Cu-PAN strip ${stripId} (Batch: ${batchId}, Max Capacity: ${strip.maxValidatedDosePpmH} ppm·h)`);

    return res.status(200).json({
      success: true,
      message: 'Cu-PAN strip successfully activated.',
      worker: {
        id: worker.workerId,
        name: worker.name,
        status: worker.status
      },
      strip: {
        stripId: strip.stripId,
        batchId: strip.batchId,
        status: strip.status,
        stripStatus: strip.stripStatus,
        statusLabel: lifecycle.statusLabel,
        cumulativeDosePpmH: strip.cumulativeDosePpmH,
        maxValidatedDosePpmH: strip.maxValidatedDosePpmH,
        lifeUsedPercent: strip.lifeUsedPercent,
        lifeRemainingPercent: strip.lifeRemainingPercent,
        activatedAt: strip.activatedAt,
        activeExpiryAt: strip.activeExpiryAt,
        remainingSeconds: lifecycle.remainingSeconds,
        remainingFormatted: formatRemaining(lifecycle.remainingSeconds),
        activeLifeValidated: !!strip.activeExpiryAt
      }
    });
  } catch (error) {
    console.error('[StripController] Error activating strip:', error);
    return res.status(500).json({ success: false, error: 'Failed to activate Cu-PAN strip.' });
  }
};

/**
 * POST /api/v1/strip/replace
 * Replace an expired or consumed strip with a new one
 */
exports.replaceStrip = async (req, res) => {
  return exports.activateStrip(req, res);
};

/**
 * Admin: GET /api/v1/admin/batches
 * List all Cu-PAN batches and validation records
 */
exports.getBatches = async (req, res) => {
  try {
    const batches = await StripBatch.find().sort({ createdAt: -1 });
    return res.status(200).json(batches);
  } catch (error) {
    console.error('[StripController] Error listing batches:', error);
    return res.status(500).json({ error: 'Failed to retrieve batches.' });
  }
};

/**
 * Admin: POST /api/v1/admin/batches
 * Create a new Cu-PAN strip manufacturing batch
 */
exports.createBatch = async (req, res) => {
  try {
    const {
      batchId,
      chemistry = 'Cu-PAN',
      manufacturedAt,
      validatedShelfLifeDays,
      validatedActiveLifeHours,
      maxValidatedDosePpmH,
      storageMinTemp,
      storageMaxTemp,
      storageMaxHumidity,
      packaging,
      stabilityTestReference,
      status,
      isDemo
    } = req.body;

    if (!batchId) {
      return res.status(400).json({ error: 'batchId is required.' });
    }

    const existing = await StripBatch.findOne({ batchId });
    if (existing) {
      return res.status(409).json({ error: `Batch ${batchId} already exists.` });
    }

    let expiryAt = null;
    const mfg = manufacturedAt ? new Date(manufacturedAt) : new Date();
    if (validatedShelfLifeDays && Number(validatedShelfLifeDays) > 0) {
      expiryAt = new Date(mfg.getTime() + Number(validatedShelfLifeDays) * 86400 * 1000);
    }

    const batch = new StripBatch({
      batchId,
      chemistry,
      manufacturedAt: mfg,
      validatedShelfLifeDays: validatedShelfLifeDays ? Number(validatedShelfLifeDays) : null,
      expiryAt,
      validatedActiveLifeHours: validatedActiveLifeHours ? Number(validatedActiveLifeHours) : null,
      maxValidatedDosePpmH: maxValidatedDosePpmH !== undefined ? Number(maxValidatedDosePpmH) : 160.0,
      storageMinTemp: storageMinTemp !== undefined ? Number(storageMinTemp) : 15.0,
      storageMaxTemp: storageMaxTemp !== undefined ? Number(storageMaxTemp) : 25.0,
      storageMaxHumidity: storageMaxHumidity !== undefined ? Number(storageMaxHumidity) : 60.0,
      packaging: packaging || 'Sealed Foil with Desiccant Barrier',
      stabilityTestReference: stabilityTestReference || 'Accelerated Arrhenius 40°C/75% RH',
      status: status || (validatedShelfLifeDays ? 'VALIDATED' : 'NOT_YET_VALIDATED'),
      isDemo: !!isDemo
    });

    await batch.save();
    return res.status(201).json(batch);
  } catch (error) {
    console.error('[StripController] Error creating batch:', error);
    return res.status(500).json({ error: 'Failed to create batch.' });
  }
};

/**
 * Admin: POST /api/v1/admin/batches/:batchId/validate
 * Update experimental shelf life & active life validation parameters
 */
exports.validateBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { validatedShelfLifeDays, validatedActiveLifeHours, maxValidatedDosePpmH, stabilityTestReference, status = 'VALIDATED' } = req.body;

    const batch = await StripBatch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({ error: `Batch ${batchId} not found.` });
    }

    if (validatedShelfLifeDays !== undefined) {
      batch.validatedShelfLifeDays = Number(validatedShelfLifeDays) || null;
      if (batch.validatedShelfLifeDays) {
        batch.expiryAt = new Date(batch.manufacturedAt.getTime() + batch.validatedShelfLifeDays * 86400 * 1000);
      } else {
        batch.expiryAt = null;
      }
    }

    if (validatedActiveLifeHours !== undefined) {
      batch.validatedActiveLifeHours = Number(validatedActiveLifeHours) || null;
    }

    if (maxValidatedDosePpmH !== undefined) {
      batch.maxValidatedDosePpmH = Number(maxValidatedDosePpmH) || null;
    }

    if (stabilityTestReference) {
      batch.stabilityTestReference = stabilityTestReference;
    }

    batch.status = status;
    await batch.save();

    return res.status(200).json(batch);
  } catch (error) {
    console.error('[StripController] Error validating batch:', error);
    return res.status(500).json({ error: 'Failed to update batch validation.' });
  }
};

/**
 * Admin: POST /api/v1/admin/batches/:batchId/recall
 * Recall a contaminated or compromised batch
 */
exports.recallBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await StripBatch.findOne({ batchId });
    if (!batch) {
      return res.status(404).json({ error: `Batch ${batchId} not found.` });
    }

    batch.status = 'RECALLED';
    await batch.save();

    // Mark all strips in this batch as RECALLED
    await Strip.updateMany({ batchId }, { status: 'RECALLED', stripStatus: 'RECALLED' });

    return res.status(200).json({
      success: true,
      message: `Batch ${batchId} and all associated strips have been marked RECALLED.`,
      batch
    });
  } catch (error) {
    console.error('[StripController] Error recalling batch:', error);
    return res.status(500).json({ error: 'Failed to recall batch.' });
  }
};

/**
 * Admin: PATCH /api/v1/admin/workers/:workerId/status
 * Change worker status (ACTIVE, INACTIVE, BLOCKED)
 */
exports.updateWorkerStatus = async (req, res) => {
  try {
    const { workerId } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'BLOCKED'].includes(status)) {
      return res.status(400).json({ error: "status must be 'ACTIVE', 'INACTIVE', or 'BLOCKED'." });
    }

    const worker = await Worker.findOne({ workerId });
    if (!worker) {
      return res.status(404).json({ error: `Worker ${workerId} not found.` });
    }

    worker.status = status;
    await worker.save();

    return res.status(200).json(worker);
  } catch (error) {
    console.error('[StripController] Error updating worker status:', error);
    return res.status(500).json({ error: 'Failed to update worker status.' });
  }
};
