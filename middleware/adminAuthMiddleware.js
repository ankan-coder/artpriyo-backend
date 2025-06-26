const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const adminAuthMiddleware = async (req, res, next) => {
  console.log('[ADMIN AUTH] Middleware called');
  console.log('[ADMIN AUTH] Request path:', req.originalUrl);
  console.log('[ADMIN AUTH] Request method:', req.method);
  console.log('[ADMIN AUTH] Request IP:', req.ip);
  
  try {
    // Get token from header
    const authHeader = req.header('Authorization');
    console.log('[ADMIN AUTH] Auth header present:', !!authHeader);
    
    const token = authHeader?.replace('Bearer ', '');
    console.log('[ADMIN AUTH] Token extracted:', !!token);
    
    if (!token) {
      console.log('[ADMIN AUTH] No token provided');
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // Verify token
    console.log('[ADMIN AUTH] Attempting to verify token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[ADMIN AUTH] Token verified successfully for userID:', decoded.userID);
    
    // Find user
    console.log('[ADMIN AUTH] Looking up user in database with userID:', decoded.userID);
    const user = await User.findOne({ userID: decoded.userID });
    
    if (!user) {
      console.log('[ADMIN AUTH] User not found in database for userID:', decoded.userID);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    console.log('[ADMIN AUTH] User found:', {
      userID: user.userID,
      email: user.email,
      accountType: user.accountType
    });

    // Check if user is admin
    console.log('[ADMIN AUTH] Checking admin privileges. User account type:', user.accountType);
    if (user.accountType !== 'Admin') {
      console.log('[ADMIN AUTH] Access denied - not an admin account');
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    console.log('[ADMIN AUTH] Admin authentication successful');
    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    console.log('[ADMIN AUTH] Authentication error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    console.error('Admin auth error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

module.exports = adminAuthMiddleware; 