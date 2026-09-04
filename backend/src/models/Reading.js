const mongoose = require('mongoose');
const { normalizeChemistryId } = require('../../../shared/chemistryRegistry.cjs');

const ReadingSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: [true, 'Worker ID is required'],
      ref: 'Worker',
      index: true
    },
    shiftId: {
      type: String,
      required: [true, 'Shift ID is required'],
      trim: true,
      index: true
    },
    scanId: {
      type: String,
      trim: true,
      index: true
    },
    stripId: {
      type: String,
      ref: 'Strip',
      trim: true,
      index: true
    },
    cumulativeStripDosePpmH: {
      type: Number,
      default: 0.0
    },
    lifeRemainingPercent: {
      type: Number,
      default: 100.0
    },
    stripStatus: {
      type: String,
      default: 'GOOD'
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL/path is required']
    },
    chemistry: {
      type: String,
      default: 'CU_PAN',
      required: true,
      index: true,
      set: (v) => normalizeChemistryId(v) || v
    },
    stripBatch: {
      type: String,
      default: 'CUPAN-BATCH-001',
      index: true
    },
    cameraProfile: {
      type: String,
      default: 'mobile_001'
    },
    stripColorRGB: {
      r: { type: Number, required: true },
      g: { type: Number, required: true },
      b: { type: Number, required: true }
    },
    referenceColorRGB: {
      r: { type: Number, required: true },
      g: { type: Number, required: true },
      b: { type: Number, required: true }
    },
    greyColorRGB: {
      r: { type: Number, default: 128 },
      g: { type: Number, default: 128 },
      b: { type: Number, default: 128 }
    },
    correctedColorRGB: {
      r: { type: Number, required: true },
      g: { type: Number, required: true },
      b: { type: Number, required: true }
    },
    lab: {
      L: { type: Number, default: 42.50 },
      a: { type: Number, default: 38.20 },
      b: { type: Number, default: -28.40 }
    },
    deltaE00: {
      type: Number,
      default: 0.0
    },
    confidence: {
      type: Number,
      default: 0.94
    },
    calibrationStatus: {
      type: String,
      enum: [
        'VALID',
        'OUTSIDE CALIBRATION RANGE',
        'NOT_CALIBRATED',
        'CALIBRATION_UNAVAILABLE',
        'IMAGE_PROCESSING_FAILED',
        'IMAGE_QUALITY_FAILED',
        'MODEL_UNAVAILABLE',
        'INVALID_COLOR_DATA',
        'OFFLINE_PENDING_SYNC',
        'VALID_ESTIMATE'
      ],
      default: 'VALID'
    },
    isVirginBaseline: {
      type: Boolean,
      default: false
    },
    expiryPatchStatus: {
      type: String,
      enum: ['valid', 'expired', 'unreadable'],
      default: 'valid'
    },
    ambientTemp: {
      type: Number,
      default: 25.0
    },
    ambientHumidity: {
      type: Number,
      default: 50.0
    },
    estimatedDosePpmHours: {
      type: Number,
      required: false,
      default: null
    },
    calibrationCurveVersion: {
      type: String,
      required: true,
      default: 'cupan-cielab-v1'
    },
    capturedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        ret.readingId = ret._id ? ret._id.toString() : undefined;
        ret.dose = ret.estimatedDosePpmHours;
        ret.unit = 'ppm·h';
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('Reading', ReadingSchema);
