const express = require('express');
const router = express.Router();
const calibrationController = require('../controllers/calibrationController');
const modelController = require('../controllers/modelCalibrationController');

// Camera CCM Calibration
router.post('/camera', calibrationController.calibrateCamera);

// Cu-PAN Chemical Calibration
router.post('/cupan', calibrationController.recordCuPANCalibration);
router.get('/cupan', calibrationController.getCuPANCalibration);

// Cu-PAN Model & Metrology Suite
router.get('/summary', modelController.getCalibrationSummary);
router.get('/dataset', modelController.getCalibrationDataset);
router.get('/metrics', modelController.getCalibrationMetrics);
router.get('/graphs', modelController.getCalibrationGraphs);
router.get('/model', modelController.getCalibrationModel);
router.post('/train', modelController.trainModel);

// Cumulative Retraining Workflow APIs
router.post('/data/add', modelController.addCalibrationData);
router.get('/data/pending', modelController.getPendingCalibrationData);
router.post('/data/approve', modelController.approvePendingData);
router.get('/versions', modelController.getCalibrationVersions);
router.post('/candidate/train', modelController.trainCandidateModel);
router.get('/candidate/compare', modelController.compareCandidateModel);
router.post('/candidate/publish', modelController.publishCandidateModel);
router.post('/rollback', modelController.rollbackModel);
router.get('/coverage', modelController.getCalibrationCoverage);
router.get('/trends', modelController.getCalibrationTrends);

module.exports = router;
