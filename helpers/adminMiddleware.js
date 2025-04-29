const User = require("../models/userModel");

const adminMiddleware = async (req, res, next) => {
  try {
    // The user object should be attached by the auth middleware
    if (!req.user || !req.user.userID) {
      return res.status(401).json({ 
        success: false, 
        message: "Unauthorized: User not authenticated." 
      });
    }

    // Find the user in the database
    const user = await User.findById(req.user.userID);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    // Check if the user is an admin based on accountType field
    if (user.accountType !== 'Admin') {
      return res.status(403).json({ 
        success: false, 
        message: "Forbidden: Admin access required" 
      });
    }

    // Add isAdmin flag to req.user
    req.user.isAdmin = true;
    
    // If all checks pass, proceed to the next middleware/controller
    next();
  } catch (error) {
    console.error("Admin Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in authentication.",
      error: error.message,
    });
  }
};

module.exports = adminMiddleware; 