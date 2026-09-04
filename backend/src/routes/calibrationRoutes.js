const express = require('express');
const router = express.Router();
const calibrationController = require('../controllers/calibrationController');
const modelController = require('../controllers/modelCalibrationController');

// Centralized Sensor Chemistry Abstraction APIs
router.get('/chemistries', calibrationController.getRegisteredChemistries);
router.get('/profile', calibrationController.getCalibrationProfile);

// Camera CCM Calibration
router.post('/camera', calibrationController.calibrateCamera);

// Cu-PAN Chemical Calibration
router.post('/cupan', calibrationController.recordCuPANCalibration);
router.get('/cupan', calibrationController.getCuPANCalibration);

// Lead Acetate Dedicated Calibration APIs (Phase 4)
router.get('/lead-acetate', calibrationController.getLeadAcetateProfile);
router.get('/lead-acetate/dataset', calibrationController.getLeadAcetateDataset);
router.post('/lead-acetate/sample', calibrationController.recordLeadAcetateSample);
router.post('/lead-acetate/validate', calibrationController.validateLeadAcetateInputs);
router.post('/lead-acetate/predict', calibrationController.predictLeadAcetateExposure);
router.post('/lead-acetate/fit-test-fixture', calibrationController.loadTestPlumbingFixture);
router.post('/lead-acetate/fit-experimental', calibrationController.fitExperimentalLeadAcetate);
router.post('/lead-acetate/reset', calibrationController.resetLeadAcetateCalibration);
router.get('/models/:chemistry/:version', calibrationController.getModelByChemistryAndVersion);

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
