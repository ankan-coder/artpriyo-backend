const express = require("express");
const {
  registerController,
  loginController,
} = require("../controllers/userController");

// router object
const router = express.Router();

// routes
// Register || POST
router.post("/register", registerController);

// Login || POST
router.post("/login", loginController);

// export
module.exports = router;
