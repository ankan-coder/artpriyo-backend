const JWT = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
  try {
    console.log("Auth middleware called");
    
    if (!req.headers.authorization) {
      console.log("No authorization header");
      return res
        .status(401)
        .json({ success: false, message: "No token provided." });
    }

    const token = req.headers.authorization.split(" ")[1];
    console.log("Token from header:", token);

    if (!token) {
      console.log("Token is empty");
      return res
        .status(401)
        .json({ success: false, message: "Access Denied. No token found." });
    }

    // Verify token
    console.log("Verifying token with secret:", process.env.JWT_SECRET ? "Secret exists" : "Secret missing");
    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    console.log("Decoded token:", decoded);

    if (!decoded) {
      console.log("Token verification failed");
      return res
        .status(401)
        .json({ success: false, message: "Invalid token." });
    }

    // Attach user ID to request object
    req.user = { 
      _id: decoded._id,
      userID: decoded._id 
    };
    console.log("User set in request:", req.user);

    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error in authentication.",
      error: error.message,
    });
  }
};

module.exports = authMiddleware;
