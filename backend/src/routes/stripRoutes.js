const express = require('express');
const router = express.Router();
const stripController = require('../controllers/stripController');

// POST /api/v1/strip/activate
router.post('/activate', stripController.activateStrip);

// POST /api/v1/strip/replace
router.post('/replace', stripController.replaceStrip);

// Admin batch routes
router.get('/batches', stripController.getBatches);
router.post('/batches', stripController.createBatch);
router.post('/batches/:batchId/validate', stripController.validateBatch);
router.post('/batches/:batchId/recall', stripController.recallBatch);

module.exports = router;
