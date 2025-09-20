const express = require('express');
const router = express.Router();
const User = require('../models/User');
const DeviceChangeRequest = require('../models/DeviceChangeRequest');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(verifyToken);
router.use(requireAdmin);

// Get all pending device change requests
router.get('/requests', async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 10 } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const requests = await DeviceChangeRequest.find(query)
      .populate('user', 'username email')
      .populate('reviewedBy', 'username')
      .sort({ requestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DeviceChangeRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device change requests.'
    });
  }
});

// Get specific device change request
router.get('/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;

    const request = await DeviceChangeRequest.findById(requestId)
      .populate('user', 'username email registeredDevices')
      .populate('reviewedBy', 'username');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Device change request not found.'
      });
    }

    res.json({
      success: true,
      data: { request }
    });
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get device change request.'
    });
  }
});

// Approve device change request
router.post('/requests/:requestId/approve', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNotes } = req.body;

    const request = await DeviceChangeRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Device change request not found.'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been processed.'
      });
    }

    // Update request status
    request.status = 'approved';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    request.adminNotes = adminNotes;

    await request.save();

    // Update user's device registration
    const user = await User.findById(request.user);
    if (user) {
      // Remove old device if it exists
      if (user.currentDeviceId) {
        user.registeredDevices = user.registeredDevices.filter(
          device => device.deviceId !== user.currentDeviceId
        );
      }
      
      // Register new device
      const newDeviceInfo = {
        userAgent: request.newDeviceInfo.userAgent,
        ipAddress: request.newDeviceInfo.ipAddress,
        platform: request.newDeviceInfo.platform
      };

      user.registeredDevices.push({
        deviceId: request.newDeviceId,
        deviceInfo: newDeviceInfo,
        registeredAt: new Date(),
        lastUsed: new Date()
      });

      user.currentDeviceId = request.newDeviceId;
      await user.save();
      
      console.log(`Device change approved for user ${user.username}. New device registered.`);
    }

    res.json({
      success: true,
      message: 'Device change request approved successfully.',
      data: { request }
    });

  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve device change request.'
    });
  }
});

// Reject device change request
router.post('/requests/:requestId/reject', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { adminNotes, reason } = req.body;

    const request = await DeviceChangeRequest.findById(requestId);
    
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Device change request not found.'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Request has already been processed.'
      });
    }

    // Update request status
    request.status = 'rejected';
    request.reviewedAt = new Date();
    request.reviewedBy = req.user._id;
    request.adminNotes = adminNotes;
    request.reason = reason || request.reason;

    await request.save();

    res.json({
      success: true,
      message: 'Device change request rejected successfully.',
      data: { request }
    });

  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject device change request.'
    });
  }
});

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const users = await User.find({})
      .select('-password -registeredDevices')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments({});

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users.'
    });
  }
});

// Get user details
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    // Get user's device change requests
    const requests = await DeviceChangeRequest.find({ user: userId })
      .sort({ requestedAt: -1 })
      .limit(10);

    res.json({
      success: true,
      data: { 
        user,
        recentRequests: requests
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user details.'
    });
  }
});

// Get request history
router.get('/requests/history', async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    
    const query = {};
    if (userId) {
      query.user = userId;
    }

    const requests = await DeviceChangeRequest.find(query)
      .populate('user', 'username email')
      .populate('reviewedBy', 'username')
      .sort({ requestedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await DeviceChangeRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get request history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get request history.'
    });
  }
});

// Get admin dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      recentRequests
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      DeviceChangeRequest.countDocuments({ status: 'pending' }),
      DeviceChangeRequest.countDocuments({ status: 'approved' }),
      DeviceChangeRequest.countDocuments({ status: 'rejected' }),
      DeviceChangeRequest.find({})
        .populate('user', 'username email')
        .sort({ requestedAt: -1 })
        .limit(5)
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          pendingRequests,
          approvedRequests,
          rejectedRequests
        },
        recentRequests
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data.'
    });
  }
});

// Deactivate/Activate user
router.post('/users/:userId/toggle-status', async (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    user.isActive = isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user: { id: user._id, username: user.username, isActive: user.isActive } }
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status.'
    });
  }
});

module.exports = router;

