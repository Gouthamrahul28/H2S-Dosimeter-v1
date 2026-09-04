/**
 * backend/src/models/CalibrationDataset.js
 * 
 * Mongoose Schema for Calibration Datasets.
 */

const mongoose = require('mongoose');
const { normalizeChemistryId } = require('../../../shared/chemistryRegistry.cjs');

const CalibrationDatasetSchema = new mongoose.Schema(
  {
    dataset_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    sensor_chemistry: {
      type: String,
      required: true,
      index: true,
      set: (v) => normalizeChemistryId(v) || v
    },
    dataset_version: {
      type: String,
      required: true
    },
    data_type: {
      type: String,
      required: true,
      enum: ['EXPERIMENTAL', 'SYNTHETIC', 'TEST'],
      default: 'EXPERIMENTAL'
    },
    status: {
      type: String,
      required: true,
      enum: ['CALIBRATION_DATA_REQUIRED', 'CALIBRATED', 'PENDING_VALIDATION', 'RETIRED'],
      default: 'CALIBRATION_DATA_REQUIRED'
    },
    sample_count: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    calibrated_domain: {
      minDosePpmH: { type: Number, default: null },
      maxDosePpmH: { type: Number, default: null },
      minTempC: { type: Number, default: null },
      maxTempC: { type: Number, default: null },
      minRhPct: { type: Number, default: null },
      maxRhPct: { type: Number, default: null }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('CalibrationDataset', CalibrationDatasetSchema);
