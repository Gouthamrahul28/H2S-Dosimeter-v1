const express = require('express');
const router = express.Router();
const workerController = require('../controllers/workerController');
const readingController = require('../controllers/readingController');

// GET /api/v1/workers
router.get('/', workerController.getWorkers);

// POST /api/v1/workers
router.post('/', workerController.createWorker);

// GET /api/v1/workers/:workerId/readings
router.get('/:workerId/readings', readingController.getReadingsByWorker);

// GET /api/v1/workers/:workerId/cumulative-dose
router.get('/:workerId/cumulative-dose', workerController.getCumulativeDose);

module.exports = router;
