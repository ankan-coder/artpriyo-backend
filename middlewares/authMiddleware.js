const JWT = require("jsonwebtoken");
const userModel = require("../models/userModel");
const Administrator = require("../models/Administrator");

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

    console.log("Decoded token:", decoded);

    // Check if the token contains userType as administrator or user
    let user;

    if (decoded.userType === "administrator") {
      // Find administrator using id from token
      user = await Administrator.findOne({ _id: decoded.id || decoded._id });
      console.log("Administrator lookup result:", user);
    } else {
      // Find regular user using id from token (could be stored as id or _id)
      user = await userModel.findOne({
        $or: [{ _id: decoded.id || decoded._id }, { userID: decoded.userID }],
      });
      console.log("User lookup result:", user);
    }

    // Check if user/administrator exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          decoded.userType === "administrator"
            ? "Administrator not found"
            : "User not found",
      });
    } else {
      console.log(
        `${
          decoded.userType === "administrator" ? "Administrator" : "User"
        } found:`,
        user
      );
    }

    // Add user/administrator to request object
    req.user = {
      userType: decoded.userType,
      _id: user._id,
      email: user.email,
      ...(user.userID && { userID: user.userID }), // Add userID if it exists
      ...(decoded.userType === "administrator" && { role: user.role }), // Add role for administrators
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
