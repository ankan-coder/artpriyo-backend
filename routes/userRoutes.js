const express = require("express");
const {
  registerController,
  loginController,
  fetchUserDetails,
  updateUserDetails,
  fetchUserById,
  getUserStats,
  changeEmailController,
  changePasswordController,
  logoutController,
  getUserDetailsController,
} = require("../controllers/userController");
const { tokenCheckController } = require("../controllers/tokenCheckController");
const authMiddleware = require("../helpers/authMiddleware");
const userModel = require("../models/userModel");
const searchController = require("../controllers/searchController");

// router object
const router = express.Router();

// routes
// Register || POST
router.post("/register", registerController);

// Login || POST
router.post("/login", loginController);

// User details || GET
router.get("/userDetails", authMiddleware, fetchUserDetails);

// Get user by ID || GET
router.get("/user/:userId", authMiddleware, fetchUserById);

// Update user details || PUT
router.put("/update-user", authMiddleware, updateUserDetails);

// Get all users
router.get("/users", async (req, res) => {
  try {
    const users = await userModel.find(
      {},
      "firstName lastName userName accountType"
    ); // Fetch selected fields
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

// Check token for auth
router.get("/check-token", tokenCheckController);

// Update balance
router.patch("/update-balance/:userID", async (req, res) => {
  try {
    const { userID } = req.params;
    const { balance } = req.body;

    if (balance === undefined || isNaN(balance)) {
      return res.status(400).json({ error: "Invalid balance value" });
    }

    const updatedUser = await userModel.findOneAndUpdate(
      { userID },
      { $set: { balance } },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "Balance updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating balance:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check username availability || POST
router.post("/check-username", authMiddleware, async (req, res) => {
  try {
    const { userName } = req.body;

    if (!userName) {
      return res.status(400).json({
        success: false,
        message: "Username is required"
      });
    }

    // Check if username meets minimum length requirement
    if (userName.length < 3) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters long"
      });
    }

    // Check if username exists (case-insensitive)
    const existingUser = await userModel.findOne({
      userName: { $regex: new RegExp(`^${userName}$`, 'i') }
    });

    // If username exists and it's not the current user's username
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "Username is already taken"
      });
    }

    // Username is available
    return res.status(200).json({
      success: true,
      available: true,
      message: "Username is available"
    });
  } catch (error) {
    console.error("Error checking username:", error);
    return res.status(500).json({
      success: false,
      message: "Error checking username availability"
    });
  }
});

// Get user statistics
router.get("/stats", authMiddleware, getUserStats);

// Change email || PUT
router.put("/change-email", authMiddleware, changeEmailController);

// Change Password Route
router.post("/change/password", authMiddleware, changePasswordController);
router.put("/change/password", authMiddleware, changePasswordController);

// Search route
router.post("/search", authMiddleware, searchController);

// export
module.exports = router;
