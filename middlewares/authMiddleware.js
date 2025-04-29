const JWT = require("jsonwebtoken");
const userModel = require("../models/userModel");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    // Verify token
    const decoded = JWT.verify(token, process.env.JWT_SECRET);

    // Find user using either _id or userID from token
    const user = await userModel.findOne({
      $or: [
        { _id: decoded._id },
        { userID: decoded.userID }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Add user to request object
    req.user = {
      userID: user.userID,
      _id: user._id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};

module.exports = { authMiddleware }; 