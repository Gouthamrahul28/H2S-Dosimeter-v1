const mongoose = require('mongoose');

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
    imageUrl: {
      type: String,
      required: [true, 'Image URL/path is required']
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
    correctedColorRGB: {
      r: { type: Number, required: true },
      g: { type: Number, required: true },
      b: { type: Number, required: true }
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
      required: true
    },
    calibrationCurveVersion: {
      type: String,
      required: true,
      default: 'placeholder-v1'
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
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('Reading', ReadingSchema);
