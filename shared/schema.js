// shared/schema.js
// Shared data models and contract definitions for the H2S Dosimeter System.
// Both backend Mongoose models and frontend interfaces follow these exact field names.

/**
 * Worker Definition
 */
const WorkerSchemaDefinition = {
  workerId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  }, // unique, human-entered code e.g. "W1023"
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
};

/**
 * Reading Definition
 */
const ReadingSchemaDefinition = {
  workerId: {
    type: String,
    required: true,
    ref: 'Worker',
    index: true
  }, // references Worker.workerId
  shiftId: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true
  }, // stored file path/URL, not the base64 itself
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
  correctedColorRGB: {
    r: { type: Number, required: true },
    g: { type: Number, required: true },
    b: { type: Number, required: true }
  },
  expiryPatchStatus: {
    type: String,
    enum: ['valid', 'expired', 'unreadable'],
    default: 'valid'
  }, // "valid" | "expired" | "unreadable"
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
    required: true
  },
  calibrationCurveVersion: {
    type: String,
    required: true,
    default: 'placeholder-v1'
  },
  capturedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
};

// Regulatory safety standard defaults
const SAFETY_STANDARDS = {
  DEFAULT_THRESHOLD_PPM_HOURS: 80.0, // DGMS/OISD 8-hour / cumulative advisory threshold
  CALIBRATION_CURVE_VERSION: 'placeholder-v1'
};

module.exports = {
  WorkerSchemaDefinition,
  ReadingSchemaDefinition,
  SAFETY_STANDARDS
};
