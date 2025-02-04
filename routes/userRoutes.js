const express = require("express");
const {
  registerController,
  loginController,
  fetchUserDetails,
  updateUserDetails,
} = require("../controllers/userController");
const authMiddleware = require("../helpers/authMiddleware");

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

// export
module.exports = router;
