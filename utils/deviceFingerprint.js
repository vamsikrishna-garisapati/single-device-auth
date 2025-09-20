// Advanced device fingerprinting utilities
const crypto = require('crypto');

/**
 * Generate a comprehensive device fingerprint
 * @param {Object} req - Express request object
 * @param {String} userId - User ID
 * @returns {Object} Device fingerprint and ID
 */
function generateDeviceFingerprint(req, userId) {
  // Get all available device characteristics
  const fingerprint = {
    // Browser characteristics
    userAgent: req.get('User-Agent') || '',
    platform: req.get('sec-ch-ua-platform') || req.get('X-Platform') || 'Unknown',
    language: req.get('accept-language') || req.get('X-Language') || 'en-US',
    languages: req.get('X-Languages') || req.get('accept-language') || 'en-US',
    
    // Display characteristics
    screenRes: req.get('X-Screen-Resolution') || 'unknown',
    colorDepth: req.get('X-Color-Depth') || 'unknown',
    pixelRatio: req.get('X-Pixel-Ratio') || '1',
    
    // Hardware characteristics
    hardwareConcurrency: req.get('X-Hardware-Concurrency') || 'unknown',
    maxTouchPoints: req.get('X-Max-Touch-Points') || '0',
    
    // System characteristics
    timezone: req.get('X-Timezone') || 'UTC',
    
    // Network characteristics (for monitoring, not identification)
    ip: req.ip || req.connection.remoteAddress,
    forwardedFor: req.get('X-Forwarded-For'),
    realIp: req.get('X-Real-IP')
  };

  // Generate primary device ID (stable characteristics only)
  const stableFingerprint = {
    userAgent: fingerprint.userAgent,
    platform: fingerprint.platform,
    language: fingerprint.language,
    languages: fingerprint.languages,
    screenRes: fingerprint.screenRes,
    colorDepth: fingerprint.colorDepth,
    pixelRatio: fingerprint.pixelRatio,
    hardwareConcurrency: fingerprint.hardwareConcurrency,
    maxTouchPoints: fingerprint.maxTouchPoints,
    timezone: fingerprint.timezone
  };

  const deviceId = crypto
    .createHash('sha256')
    .update(`${userId}-${JSON.stringify(stableFingerprint)}`)
    .digest('hex');

  return {
    deviceId,
    fingerprint,
    stableFingerprint
  };
}

/**
 * Check if two device fingerprints are similar (for IP change detection)
 * @param {Object} fingerprint1 - First fingerprint
 * @param {Object} fingerprint2 - Second fingerprint
 * @returns {Object} Similarity analysis
 */
function compareDeviceFingerprints(fingerprint1, fingerprint2) {
  const stableKeys = [
    'userAgent', 'platform', 'language', 'languages', 
    'screenRes', 'colorDepth', 'pixelRatio', 
    'hardwareConcurrency', 'maxTouchPoints', 'timezone'
  ];

  let matches = 0;
  let total = stableKeys.length;
  const differences = [];

  stableKeys.forEach(key => {
    if (fingerprint1[key] === fingerprint2[key]) {
      matches++;
    } else {
      differences.push({
        key,
        value1: fingerprint1[key],
        value2: fingerprint2[key]
      });
    }
  });

  const similarity = (matches / total) * 100;

  return {
    similarity,
    matches,
    total,
    differences,
    isSimilar: similarity >= 80 // 80% similarity threshold
  };
}

/**
 * Generate a fallback device ID for IP changes
 * @param {Object} req - Express request object
 * @param {String} userId - User ID
 * @returns {String} Fallback device ID
 */
function generateFallbackDeviceId(req, userId) {
  // Use only the most stable characteristics
  const stableData = {
    userAgent: req.get('User-Agent') || '',
    platform: req.get('sec-ch-ua-platform') || req.get('X-Platform') || 'Unknown',
    language: req.get('accept-language') || req.get('X-Language') || 'en-US',
    screenRes: req.get('X-Screen-Resolution') || 'unknown',
    hardwareConcurrency: req.get('X-Hardware-Concurrency') || 'unknown'
  };

  return crypto
    .createHash('sha256')
    .update(`${userId}-${JSON.stringify(stableData)}`)
    .digest('hex');
}

/**
 * Detect if this might be the same device with changed IP
 * @param {Object} currentFingerprint - Current device fingerprint
 * @param {Array} registeredDevices - User's registered devices
 * @returns {Object} IP change detection result
 */
function detectIPChange(currentFingerprint, registeredDevices) {
  for (let device of registeredDevices) {
    if (device.deviceInfo) {
      const comparison = compareDeviceFingerprints(
        currentFingerprint.stableFingerprint,
        device.deviceInfo
      );
      
      if (comparison.isSimilar) {
        return {
          isIPChange: true,
          similarDevice: device,
          similarity: comparison.similarity,
          differences: comparison.differences
        };
      }
    }
  }
  
  return { isIPChange: false };
}

module.exports = {
  generateDeviceFingerprint,
  compareDeviceFingerprints,
  generateFallbackDeviceId,
  detectIPChange
};
