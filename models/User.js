const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  registeredDevices: [{
    deviceId: String,
    deviceInfo: {
      userAgent: String,
      ipAddress: String,
      platform: String
    },
    registeredAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: Date.now
    }
  }],
  currentDeviceId: {
    type: String,
    default: null
  },
  lastKnownIP: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate device ID using advanced fingerprinting
userSchema.methods.generateDeviceId = function(req) {
  const { generateDeviceFingerprint } = require('../utils/deviceFingerprint');
  
  const result = generateDeviceFingerprint(req, this._id);
  
  // Store IP separately for security monitoring
  this.lastKnownIP = result.fingerprint.ip;
  
  return result.deviceId;
};

// Get device fingerprint for comparison
userSchema.methods.getDeviceFingerprint = function(req) {
  const { generateDeviceFingerprint } = require('../utils/deviceFingerprint');
  return generateDeviceFingerprint(req, this._id);
};

// Check if device is registered
userSchema.methods.isDeviceRegistered = function(deviceId) {
  return this.registeredDevices.some(device => device.deviceId === deviceId);
};

// Register new device
userSchema.methods.registerDevice = function(deviceId, req) {
  const deviceInfo = {
    userAgent: req.get('User-Agent') || '',
    ipAddress: req.ip || req.connection.remoteAddress,
    platform: req.get('sec-ch-ua-platform') || 'Unknown'
  };

  this.registeredDevices.push({
    deviceId,
    deviceInfo,
    registeredAt: new Date(),
    lastUsed: new Date()
  });

  this.currentDeviceId = deviceId;
  return this.save();
};

// Update device last used time
userSchema.methods.updateDeviceLastUsed = function(deviceId) {
  const device = this.registeredDevices.find(d => d.deviceId === deviceId);
  if (device) {
    device.lastUsed = new Date();
    return this.save();
  }
  return Promise.resolve();
};

module.exports = mongoose.model('User', userSchema);

