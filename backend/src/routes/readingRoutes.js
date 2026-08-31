const express = require('express');
const router = express.Router();
const readingController = require('../controllers/readingController');

// POST /api/v1/readings
router.post('/', readingController.createReading);

module.exports = router;
