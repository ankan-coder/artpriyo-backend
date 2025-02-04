const JWT = require("jsonwebtoken");

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from headers
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer token

    console.log(token);

    if (!token) {
      return res
        .status(401)
        .json({ message: "Access Denied. No token provided." });
    }

    // Verify token
    const decoded = JWT.verify(token, process.env.JWT_SECRET);

    // Attach user ID to request object
    req.user = { id: decoded._id };

    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = authMiddleware;
