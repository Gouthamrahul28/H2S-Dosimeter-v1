/**
 * backend/src/models/CalibrationSample.js
 * 
 * Mongoose Schema for Sensor Calibration Samples.
 * Strict Architecture:
 * - Differentiates sensor_chemistry ('CU_PAN' vs 'LEAD_ACETATE')
 * - Strictly enforces data_type isolation ('EXPERIMENTAL', 'SYNTHETIC', 'TEST')
 * - Records full colorimetric coordinates and environmental parameters
 */

const mongoose = require('mongoose');
const { normalizeChemistryId } = require('../../../shared/chemistryRegistry.cjs');

const ALLOWED_DATA_TYPES = ['EXPERIMENTAL', 'SYNTHETIC', 'TEST'];

const CalibrationSampleSchema = new mongoose.Schema(
  {
    sample_id: {
      type: String,
      required: [true, 'sample_id is required'],
      unique: true,
      trim: true,
      index: true
    },
    sensor_chemistry: {
      type: String,
      required: [true, 'sensor_chemistry is required'],
      index: true,
      set: (v) => normalizeChemistryId(v) || v
    },
    strip_id: {
      type: String,
      trim: true,
      default: null
    },
    strip_batch: {
      type: String,
      trim: true,
      default: null
    },
    exposure_concentration: {
      type: Number,
      required: [true, 'exposure_concentration (ppm) is required']
    },
    exposure_duration: {
      type: Number,
      required: [true, 'exposure_duration (minutes) is required']
    },
    reference_dose: {
      type: Number,
      required: [true, 'reference_dose (ppm·h) is required']
    },
    temperature: {
      type: Number,
      required: [true, 'temperature (°C) is required'],
      default: 25.0
    },
    humidity: {
      type: Number,
      required: [true, 'humidity (% RH) is required'],
      default: 50.0
    },
    RGB: {
      r: { type: Number, required: true },
      g: { type: Number, required: true },
      b: { type: Number, required: true }
    },
    Lab: {
      L: { type: Number, required: true },
      a: { type: Number, required: true },
      b: { type: Number, required: true }
    },
    deltaE00: {
      type: Number,
      default: null
    },
    image_reference: {
      type: String,
      default: null
    },
    quality_score: {
      type: Number,
      default: 100.0
    },
    data_type: {
      type: String,
      required: [true, 'data_type is required'],
      enum: {
        values: ALLOWED_DATA_TYPES,
        message: 'data_type must be EXPERIMENTAL, SYNTHETIC, or TEST'
      },
      index: true
    },
    dataset_version: {
      type: String,
      required: true,
      default: 'LEAD_ACETATE_DATASET_V1',
      index: true
    },
    created_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

module.exports = mongoose.model('CalibrationSample', CalibrationSampleSchema);
