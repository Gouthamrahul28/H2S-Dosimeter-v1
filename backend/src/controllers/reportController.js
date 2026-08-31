const Worker = require('../models/Worker');
const Reading = require('../models/Reading');

const DEFAULT_THRESHOLD_PPM_HOURS = 80;

/**
 * GET /api/v1/reports/dgms?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Generates per-worker cumulative exposure summary for DGMS/OISD regulatory reporting
 */
exports.getDGMSReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const thresholdPpmHours = Number(process.env.THRESHOLD_PPM_HOURS) || DEFAULT_THRESHOLD_PPM_HOURS;

    // Build date filter for readings
    const dateQuery = {};
    if (from || to) {
      dateQuery.capturedAt = {};
      if (from) {
        const fromDate = new Date(from);
        fromDate.setHours(0, 0, 0, 0);
        dateQuery.capturedAt.$gte = fromDate;
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        dateQuery.capturedAt.$lte = toDate;
      }
    }

    const workers = await Worker.find().sort({ workerId: 1 });
    const allReadings = await Reading.find(dateQuery);

    // Group readings by workerId
    const readingsByWorker = new Map();
    for (const reading of allReadings) {
      if (!readingsByWorker.has(reading.workerId)) {
        readingsByWorker.set(reading.workerId, []);
      }
      readingsByWorker.get(reading.workerId).push(reading);
    }

    // Build report rows
    const report = workers.map((worker) => {
      const workerReadings = readingsByWorker.get(worker.workerId) || [];
      const totalDosePpmHours = Math.round(
        workerReadings.reduce((sum, r) => sum + (Number(r.estimatedDosePpmHours) || 0), 0) * 10
      ) / 10;
      const readingCount = workerReadings.length;
      const overThreshold = totalDosePpmHours > thresholdPpmHours;

      return {
        workerId: worker.workerId,
        name: worker.name,
        department: worker.department,
        totalDosePpmHours,
        readingCount,
        thresholdPpmHours,
        overThreshold
      };
    });

    return res.status(200).json(report);
  } catch (error) {
    console.error('[ReportController] Error generating DGMS report:', error);
    return res.status(500).json({ error: 'Failed to generate DGMS occupational health report' });
  }
};

/**
 * GET /api/v1/calibration/curves
 * List all available swappable chemistry calibration curves
 */
exports.getCalibrationCurves = async (req, res) => {
  try {
    const { getAvailableCalibrationCurves } = require('../services/doseCalculator');
    const activeVersion = process.env.CALIBRATION_CURVE_VERSION || 'placeholder-v1';
    const curves = getAvailableCalibrationCurves();
    return res.status(200).json({
      activeVersion,
      curves
    });
  } catch (error) {
    console.error('[ReportController] Error fetching calibration curves:', error);
    return res.status(500).json({ error: 'Failed to fetch calibration curves' });
  }
};

