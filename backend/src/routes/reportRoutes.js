const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// GET /api/v1/reports/dgms
router.get('/dgms', reportController.getDGMSReport);

module.exports = router;
