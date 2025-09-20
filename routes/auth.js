const express = require('express');
const router = express.Router();
const User = require('../models/User');
const DeviceChangeRequest = require('../models/DeviceChangeRequest');
const { generateToken, verifyToken, validateDevice } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Register new user
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, email, and password are required.'
      });
    }

    // Sanitize inputs
    const sanitizedUsername = username.trim();
    const sanitizedEmail = email.trim().toLowerCase();

    if (sanitizedUsername.length < 3 || sanitizedUsername.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Username must be between 3 and 30 characters.'
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: sanitizedEmail }, { username: sanitizedUsername }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists.'
      });
    }

    // Create new user
    const user = new User({
      username: sanitizedUsername,
      email: sanitizedEmail,
      password
    });

    await user.save();

    // Register first device
    const deviceId = user.generateDeviceId(req);
    await user.registerDevice(deviceId, req);

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token,
        deviceRegistered: true
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle specific error types
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this email or username already exists.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Login user
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    // Sanitize email
    const sanitizedEmail = email.trim().toLowerCase();

    // Find user
    const user = await User.findOne({ email: sanitizedEmail });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    // Generate device ID for current request
    const deviceId = user.generateDeviceId(req);

    // Check if device is registered
    if (!user.isDeviceRegistered(deviceId)) {
      // If user has no registered devices (first time login), register the device automatically
      if (user.registeredDevices.length === 0) {
        await user.registerDevice(deviceId, req);
        const token = generateToken(user._id);
        
        return res.json({
          success: true,
          message: 'Login successful. Device registered automatically.',
          data: {
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              role: user.role
            },
            token
          }
        });
      }
      
      // Check if this might be an IP change (same device, different IP)
      const { detectIPChange } = require('../utils/deviceFingerprint');
      const currentFingerprint = user.getDeviceFingerprint(req);
      const ipChangeDetection = detectIPChange(currentFingerprint, user.registeredDevices);
      
      if (ipChangeDetection.isIPChange) {
        // Update the existing device with new IP and allow login
        const similarDevice = ipChangeDetection.similarDevice;
        similarDevice.deviceInfo.ipAddress = currentFingerprint.fingerprint.ip;
        similarDevice.lastUsed = new Date();
        user.currentDeviceId = similarDevice.deviceId;
        await user.save();
        
        const token = generateToken(user._id);
        
        return res.json({
          success: true,
          message: 'Login successful. Device recognized (IP change detected).',
          data: {
            user: {
              id: user._id,
              username: user.username,
              email: user.email,
              role: user.role
            },
            token,
            ipChangeDetected: true,
            similarity: ipChangeDetection.similarity
          }
        });
      }
      
      // For truly new devices, create device change request
      const currentDeviceId = user.currentDeviceId || 'none';
      const currentDeviceInfo = user.registeredDevices.find(d => d.deviceId === user.currentDeviceId)?.deviceInfo || {};
      
      // Check if there's already a pending request for this device
      const existingRequest = await DeviceChangeRequest.findOne({
        user: user._id,
        newDeviceId: deviceId,
        status: 'pending'
      });

      if (existingRequest) {
        return res.status(403).json({
          success: false,
          message: 'Device change request already exists for this device.',
          data: {
            requestId: existingRequest._id,
            requiresApproval: true
          }
        });
      }
      
      const deviceChangeRequest = new DeviceChangeRequest({
        user: user._id,
        username: user.username,
        email: user.email,
        currentDeviceId: currentDeviceId,
        newDeviceId: deviceId,
        newDeviceInfo: {
          userAgent: req.get('User-Agent') || '',
          ipAddress: req.ip || req.connection.remoteAddress,
          platform: req.get('sec-ch-ua-platform') || 'Unknown'
        },
        currentDeviceInfo: currentDeviceInfo,
        reason: 'Login attempt from new device'
      });

      await deviceChangeRequest.save();

      return res.status(403).json({
        success: false,
        message: 'Device not registered. Device change request created.',
        data: {
          requestId: deviceChangeRequest._id,
          requiresApproval: true
        }
      });
    }

    // Update last used time and generate token
    await user.updateDeviceLastUsed(deviceId);
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// Logout user
router.post('/logout', verifyToken, async (req, res) => {
  try {
    // In a real application, you might want to blacklist the token
    // For this POC, we'll just return success
    res.json({
      success: true,
      message: 'Logout successful.'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed.'
    });
  }
});

// Get current user info
router.get('/me', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          registeredDevices: user.registeredDevices.length,
          currentDeviceId: user.currentDeviceId
        }
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information.'
    });
  }
});

// Request device change
router.post('/request-device-change', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const deviceId = user.generateDeviceId(req);

    // Check if device is already registered
    if (user.isDeviceRegistered(deviceId)) {
      return res.status(400).json({
        success: false,
        message: 'This device is already registered.'
      });
    }

    // Check for pending requests
    const existingRequest = await DeviceChangeRequest.findOne({
      user: user._id,
      newDeviceId: deviceId,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Device change request already exists for this device.'
      });
    }

    // Create device change request
    const currentDeviceId = user.currentDeviceId || 'none';
    const currentDeviceInfo = user.registeredDevices.find(d => d.deviceId === user.currentDeviceId)?.deviceInfo || {};
    
    const deviceChangeRequest = new DeviceChangeRequest({
      user: user._id,
      username: user.username,
      email: user.email,
      currentDeviceId: currentDeviceId,
      newDeviceId: deviceId,
      newDeviceInfo: {
        userAgent: req.get('User-Agent') || '',
        ipAddress: req.ip || req.connection.remoteAddress,
        platform: req.get('sec-ch-ua-platform') || 'Unknown'
      },
      currentDeviceInfo: currentDeviceInfo,
      reason: req.body.reason || 'User requested device change'
    });

    await deviceChangeRequest.save();

    res.status(201).json({
      success: true,
      message: 'Device change request created successfully.',
      data: {
        requestId: deviceChangeRequest._id,
        status: deviceChangeRequest.status
      }
    });

  } catch (error) {
    console.error('Device change request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create device change request.'
    });
  }
});

// Get user's device change requests
router.get('/my-requests', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    
    const requests = await DeviceChangeRequest.find({ user: user._id })
      .sort({ requestedAt: -1 })
      .select('-user');

    res.json({
      success: true,
      data: { requests }
    });
  } catch (error) {
    console.error('Get user requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device change requests.'
    });
  }
});

module.exports = router;
