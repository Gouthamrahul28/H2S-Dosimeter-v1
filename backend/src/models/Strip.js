const mongoose = require('mongoose');
const { normalizeChemistryId } = require('../../../shared/chemistryRegistry.cjs');

const StripSchema = new mongoose.Schema(
  {
    stripId: {
      type: String,
      required: [true, 'Strip ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    batchId: {
      type: String,
      required: [true, 'Batch ID is required'],
      ref: 'StripBatch',
      trim: true,
      index: true
    },
    chemistry: {
      type: String,
      default: 'CU_PAN',
      required: true,
      index: true,
      set: (v) => normalizeChemistryId(v) || v
    },
    workerId: {
      type: String,
      ref: 'Worker',
      default: null,
      trim: true,
      index: true
    },
    qrCodePayload: {
      type: String,
      trim: true
    },
    assignedAt: {
      type: Date,
      default: null
    },
    activatedAt: {
      type: Date,
      default: null
    },
    activeExpiryAt: {
      type: Date,
      default: null // Calculated: activatedAt + batch.validatedActiveLifeHours
    },
    warningWindowHours: {
      type: Number,
      default: 24 // hours before expiry to trigger EXPIRING_SOON warning
    },
    status: {
      type: String,
      enum: ['UNISSUED', 'ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'USED', 'REPLACEMENT_REQUIRED', 'RECALLED'],
      default: 'UNISSUED',
      index: true
    },
    stripStatus: {
      type: String,
      enum: ['GOOD', 'REPLACE_SOON', 'REPLACE_NOW', 'EXHAUSTED', 'EXPIRED', 'RECALLED', 'UNISSUED'],
      default: 'GOOD',
      index: true
    },
    scanCount: {
      type: Number,
      default: 0
    },
    currentDose: {
      type: Number,
      default: 0.0
    },
    cumulativeDosePpmH: {
      type: Number,
      default: 0.0
    },
    maxValidatedDosePpmH: {
      type: Number,
      default: 160.0 // Default Cu-PAN calibrated limit (null if not yet validated)
    },
    lifeUsedPercent: {
      type: Number,
      default: 0.0
    },
    lifeRemainingPercent: {
      type: Number,
      default: 100.0
    },
    notes: {
      type: String,
      default: ''
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

// Method to compute dynamic remaining sensing life, remaining time & replacement status
StripSchema.methods.getLifecycleStatus = function () {
  if (this.status === 'RECALLED' || this.stripStatus === 'RECALLED') {
    return {
      status: 'RECALLED',
      stripStatus: 'RECALLED',
      statusLabel: 'RECALLED',
      lifeUsedPercent: 100,
      lifeRemainingPercent: 0,
      cumulativeDosePpmH: this.cumulativeDosePpmH || 0.0,
      maxValidatedDosePpmH: this.maxValidatedDosePpmH,
      remainingSeconds: 0,
      isExpiringSoon: false,
      isExpired: true,
      isExhausted: true,
      replacementRequired: true,
      replacementUrgency: 'CRITICAL'
    };
  }

  // --- 1. SENSING CAPACITY CALCULATION ---
  let lifeUsed = 0;
  let lifeRemaining = 100;
  const cumulativeDose = Number(this.cumulativeDosePpmH || this.currentDose || 0.0);
  const maxDose = this.maxValidatedDosePpmH ? Number(this.maxValidatedDosePpmH) : null;

  if (maxDose && maxDose > 0) {
    lifeUsed = Math.min(100, Math.max(0, Math.round((cumulativeDose / maxDose) * 100)));
    lifeRemaining = Math.max(0, 100 - lifeUsed);
  } else {
    lifeUsed = null;
    lifeRemaining = null;
  }

  // --- 2. TIME-BASED REPLACEMENT CALCULATION ---
  let timeRemainingSec = null;
  let isExpiredByTime = false;
  let isExpiringSoonByTime = false;

  if (this.activatedAt && this.activeExpiryAt) {
    const now = new Date();
    const expiry = new Date(this.activeExpiryAt);
    const diffMs = expiry.getTime() - now.getTime();
    timeRemainingSec = Math.max(0, Math.floor(diffMs / 1000));

    if (timeRemainingSec <= 0) {
      isExpiredByTime = true;
    } else if (timeRemainingSec <= (this.warningWindowHours * 3600)) {
      isExpiringSoonByTime = true;
    }
  }

  // --- 3. COMPUTE OVERALL STRIP STATUS ---
  const isExhaustedByDose = lifeRemaining !== null && lifeRemaining <= 0;
  const isExpired = isExpiredByTime || isExhaustedByDose || this.status === 'EXPIRED';

  let computedStripStatus = 'GOOD';
  let statusLabel = 'STRIP GOOD';
  let replacementUrgency = 'NORMAL';

  if (isExpired || isExhaustedByDose) {
    computedStripStatus = 'REPLACE_NOW';
    statusLabel = isExhaustedByDose ? 'CAPACITY EXHAUSTED' : 'STRIP EXPIRED';
    replacementUrgency = 'CRITICAL';
  } else if ((lifeRemaining !== null && lifeRemaining <= 10)) {
    computedStripStatus = 'REPLACE_NOW';
    statusLabel = 'REPLACE NOW (<10% LIFE)';
    replacementUrgency = 'HIGH';
  } else if ((lifeRemaining !== null && lifeRemaining <= 30) || isExpiringSoonByTime) {
    computedStripStatus = 'REPLACE_SOON';
    statusLabel = 'REPLACE SOON';
    replacementUrgency = 'MEDIUM';
  } else {
    computedStripStatus = 'GOOD';
    statusLabel = 'STRIP GOOD';
    replacementUrgency = 'NORMAL';
  }

  return {
    status: isExpired ? 'EXPIRED' : (computedStripStatus === 'REPLACE_SOON' ? 'EXPIRING_SOON' : 'ACTIVE'),
    stripStatus: computedStripStatus,
    statusLabel,
    cumulativeDosePpmH: cumulativeDose,
    maxValidatedDosePpmH: maxDose,
    lifeUsedPercent: lifeUsed,
    lifeRemainingPercent: lifeRemaining,
    remainingSeconds: timeRemainingSec,
    isExpiringSoon: computedStripStatus === 'REPLACE_SOON',
    isExpired,
    isExhausted: isExhaustedByDose,
    replacementRequired: isExpired || computedStripStatus === 'REPLACE_NOW',
    replacementUrgency,
    chemistry: this.chemistry || 'CU_PAN'
  };
};

module.exports = mongoose.model('Strip', StripSchema);
