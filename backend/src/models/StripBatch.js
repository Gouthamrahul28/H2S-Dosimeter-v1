const mongoose = require('mongoose');

const StripBatchSchema = new mongoose.Schema(
  {
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    chemistry: {
      type: String,
      default: 'Cu-PAN',
      required: true
    },
    manufacturedAt: {
      type: Date,
      default: Date.now
    },
    validatedShelfLifeDays: {
      type: Number,
      default: null // null if not yet experimentally validated
    },
    expiryAt: {
      type: Date,
      default: null // generated ONLY when validated_shelf_life_days exists
    },
    validatedActiveLifeHours: {
      type: Number,
      default: null // active in-use life hours after opening (e.g. 120 hrs / 5 days)
    },
    maxValidatedDosePpmH: {
      type: Number,
      default: 160.0 // maximum validated cumulative dose capacity (ppm·h)
    },
    storageMinTemp: {
      type: Number,
      default: 15.0
    },
    storageMaxTemp: {
      type: Number,
      default: 25.0
    },
    storageMaxHumidity: {
      type: Number,
      default: 60.0
    },
    packaging: {
      type: String,
      default: 'Sealed Foil with Desiccant Barrier'
    },
    stabilityTestReference: {
      type: String,
      default: 'Accelerated Arrhenius 40°C/75% RH (Protocol ASTM F1980)'
    },
    status: {
      type: String,
      enum: ['NOT_YET_VALIDATED', 'VALIDATED', 'PARTIALLY_VALIDATED', 'EXPIRED', 'RECALLED'],
      default: 'NOT_YET_VALIDATED',
      index: true
    },
    isDemo: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret.__v;
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('StripBatch', StripBatchSchema);
