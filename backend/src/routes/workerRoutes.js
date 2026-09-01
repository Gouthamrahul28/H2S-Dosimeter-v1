const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');
const readingController = require('../controllers/readingController');
const stripController = require('../controllers/stripController');

// GET /api/v1/workers - list all workers
router.get('/', workerController.getWorkers);

// POST /api/v1/workers - register worker
router.post('/', workerController.createWorker);

// GET /api/v1/workers/:workerId/active-strip - active strip & replacement countdown
router.get('/:workerId/active-strip', stripController.getActiveStripForWorker);

// POST /api/v1/workers/:workerId/strip/activate - activate strip
router.post('/:workerId/strip/activate', (req, res, next) => {
  req.body.workerId = req.params.workerId;
  return stripController.activateStrip(req, res, next);
});

// PATCH /api/v1/workers/:workerId/status - update worker status
router.patch('/:workerId/status', stripController.updateWorkerStatus);

// GET /api/v1/workers/:workerId/readings - reading history
router.get('/:workerId/readings', readingController.getReadingsByWorker);

// GET /api/v1/workers/:workerId/cumulative-dose - cumulative exposure
router.get('/:workerId/cumulative-dose', workerController.getCumulativeDose);

module.exports = router;
