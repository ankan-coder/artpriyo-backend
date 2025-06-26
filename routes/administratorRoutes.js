const express = require("express");
const router = express.Router();
const {
  login,
  addAdministrator,
  getAdministrators,
  updateAdministratorRole,
  forgotPassword,
  verifyOTP,
  resetPassword,
  refreshToken,
} = require("../controllers/administratorController");
const { protect } = require("../middleware/auth"); // Auth middleware

// Refresh token route
router.post("/refresh-token", refreshToken);

// Public routes
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/verify-otp", verifyOTP);
router.post("/reset-password", resetPassword);

// Protected routes
router.post("/add", protect, addAdministrator);
router.get("/list", protect, getAdministrators);
router.patch("/:id/role", protect, updateAdministratorRole);

module.exports = router;
