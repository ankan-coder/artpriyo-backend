const jwt = require('jsonwebtoken');
const Administrator = require('../models/Administrator');

exports.protect = async (req, res, next) => {
  try {
    // 1) Get token from header
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    // 2) Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Check if administrator still exists
    const administrator = await Administrator.findById(decoded.id);
    if (!administrator) {
      return res.status(401).json({
        success: false,
        message: 'The administrator belonging to this token no longer exists'
      });
    }

    // Add administrator to request object
    req.administrator = administrator;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.administrator.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
}; 