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
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret._id;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('Worker', WorkerSchema);
