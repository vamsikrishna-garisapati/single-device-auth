const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  });
};

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token or user not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired. Please login again.' 
      });
    }
    
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token.' 
    });
  }
};

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      message: 'Access denied. Admin privileges required.' 
      });
  }
  next();
};

// Device validation middleware
const validateDevice = async (req, res, next) => {
  try {
    const user = req.user;
    const deviceId = user.generateDeviceId(req);
    
    // Check if device is registered (not just current device)
    if (!user.isDeviceRegistered(deviceId)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Device not authorized. Please request device change.',
        code: 'DEVICE_NOT_AUTHORIZED'
      });
    }

    // Update last used time and current device
    await user.updateDeviceLastUsed(deviceId);
    user.currentDeviceId = deviceId;
    await user.save();
    
    next();
  } catch (error) {
    console.error('Device validation error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Device validation error.' 
    });
  }
};

module.exports = {
  generateToken,
  verifyToken,
  requireAdmin,
  validateDevice
};

