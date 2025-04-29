const JWT = require("jsonwebtoken");
const userModel = require("../models/userModel");

const tokenCheckController = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "Authorization failed" });
    }

    const decoded = JWT.verify(token, process.env.JWT_SECRET);
    // Fix: Use "_id" instead of "id"
    const user = await userModel.findById(decoded._id);

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Authentication successful" });
  } catch (e) {
    console.error("Error in token validation:", e);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { tokenCheckController };
