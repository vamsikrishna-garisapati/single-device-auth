const mongoose = require('mongoose');

const deviceChangeRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  currentDeviceId: {
    type: String,
    required: true
  },
  newDeviceId: {
    type: String,
    required: true
  },
  newDeviceInfo: {
    userAgent: String,
    ipAddress: String,
    platform: String,
    location: String
  },
  currentDeviceInfo: {
    userAgent: String,
    ipAddress: String,
    platform: String
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reason: {
    type: String,
    maxlength: 500
  },
  adminNotes: {
    type: String,
    maxlength: 1000
  }
}, {
  timestamps: true
});

// Index for efficient queries
deviceChangeRequestSchema.index({ user: 1, status: 1 });
deviceChangeRequestSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('DeviceChangeRequest', deviceChangeRequestSchema);

