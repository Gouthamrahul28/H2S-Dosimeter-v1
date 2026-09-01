const mongoose = require('mongoose');

const WorkerSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: [true, 'Worker ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Worker name is required'],
      trim: true
    },
    workerCode: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    worksite: {
      type: String,
      default: 'MRPL Refinery Unit 4',
      trim: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
      default: 'ACTIVE',
      index: true
    },
    assignedStripId: {
      type: String,
      default: null,
      trim: true
    },
    registrationDate: {
      type: Date,
      default: Date.now
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

module.exports = mongoose.model('Worker', WorkerSchema);
