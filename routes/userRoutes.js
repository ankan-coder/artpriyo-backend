const express = require("express");
const {
  registerController,
  loginController,
  fetchUserDetails,
  updateUserDetails,
} = require("../controllers/userController");
const authMiddleware = require("../helpers/authMiddleware");
const userModel = require("../models/userModel");

// router object
const router = express.Router();

// routes
// Register || POST
router.post("/register", registerController);

// Login || POST
router.post("/login", loginController);

// User details || GET
router.get("/userDetails", authMiddleware, fetchUserDetails);

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

// export
module.exports = router;
