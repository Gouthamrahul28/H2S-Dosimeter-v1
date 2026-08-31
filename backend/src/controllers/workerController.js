const Worker = require('../models/Worker');
const Reading = require('../models/Reading');

const DEFAULT_THRESHOLD_PPM_HOURS = 80;

/**
 * GET /api/v1/workers
 * List all workers
 */
exports.getWorkers = async (req, res) => {
  try {
    const workers = await Worker.find().sort({ workerId: 1 });
    const formatted = workers.map((w) => ({
      workerId: w.workerId,
      name: w.name,
      department: w.department
    }));
    return res.status(200).json(formatted);
  } catch (error) {
    console.error('[WorkerController] Error listing workers:', error);
    return res.status(500).json({ error: 'Failed to retrieve workers list' });
  }
};

/**
 * POST /api/v1/workers
 * Register a new worker
 */
exports.createWorker = async (req, res) => {
  try {
    const { workerId, name, department } = req.body;

    if (!workerId || !name || !department) {
      return res.status(400).json({ error: 'workerId, name, and department are required fields' });
    }

    const existingWorker = await Worker.findOne({ workerId });
    if (existingWorker) {
      return res.status(409).json({ error: `Worker with ID ${workerId} already exists` });
    }

    const newWorker = new Worker({
      workerId,
      name,
      department
    });

    await newWorker.save();

    return res.status(201).json({
      workerId: newWorker.workerId,
      name: newWorker.name,
      department: newWorker.department
    });
  } catch (error) {
    console.error('[WorkerController] Error creating worker:', error);
    return res.status(500).json({ error: 'Failed to create worker' });
  }
};

/**
 * GET /api/v1/workers/:workerId/cumulative-dose
 * Aggregates cumulative exposure dose and checks against threshold
 */
exports.getCumulativeDose = async (req, res) => {
  try {
    const { workerId } = req.params;
    const thresholdPpmHours = Number(process.env.THRESHOLD_PPM_HOURS) || DEFAULT_THRESHOLD_PPM_HOURS;

    const readings = await Reading.find({ workerId });

    const totalDosePpmHours = Math.round(
      readings.reduce((sum, r) => sum + (Number(r.estimatedDosePpmHours) || 0), 0) * 10
    ) / 10;

    const readingCount = readings.length;
    const overThreshold = totalDosePpmHours > thresholdPpmHours;

    return res.status(200).json({
      workerId,
      totalDosePpmHours,
      readingCount,
      thresholdPpmHours,
      overThreshold
    });
  } catch (error) {
    console.error('[WorkerController] Error calculating cumulative dose:', error);
    return res.status(500).json({ error: 'Failed to calculate cumulative dose' });
  }
};
