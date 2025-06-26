const { body, validationResult } = require('express-validator');

exports.validateAdministrator = [
  // Name validation
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 3 })
    .withMessage('Name must be at least 3 characters long')
    .matches(/^[a-zA-Z\s]*$/)
    .withMessage('Name can only contain letters and spaces'),

  // Role validation
  body('role')
    .notEmpty()
    .withMessage('Role is required')
    .isIn(['super_admin', 'content_admin', 'event_admin', 'user_admin'])
    .withMessage('Invalid role specified'),

  // Email validation
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  // Password validation
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/^(?=.*[A-Z])/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/^(?=.*\d)/)
    .withMessage('Password must contain at least one number')
    .matches(/^(?=.*[!@#$%^&*])/)
    .withMessage('Password must contain at least one special character'),

  // Custom validation middleware
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }
    next();
  }
]; 