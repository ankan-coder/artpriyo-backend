const JWT = require("jsonwebtoken");
const { hashPassword, comparePassword } = require("../helpers/authHelper");
const userModel = require("../models/userModel");

// Register
const registerController = async (req, res) => {
  try {
    const { firstName, lastName, userName, accountType, email, password } =
      req.body;

    // Field validation
    if (!firstName) {
      return res.status(400).json({ message: "First name is required" });
    }

    if (!lastName) {
      return res.status(400).json({ message: "Last name is required" });
    }

    if (!userName) {
      return res.status(400).json({ message: "Username is required" });
    }

    if (!accountType) {
      return res.status(400).json({ message: "Account type is required" });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    // Check if the user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash Password
    const hashedPassword = await hashPassword(password);

    // Save User
    const user = new userModel({
      firstName,
      lastName,
      userName,
      accountType,
      email,
      password: hashedPassword,
    });

    await user.save();

    // Success response
    return res.status(201).json({
      message: "User registered successfully",
      user: { firstName, lastName, userName, accountType, email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in register API" });
  }
};

const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(500)
        .json({ message: "Email and password are required" });
    }
    // Check if the user exists
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(500).json({ message: "User not found" });
    }

    // Password Check
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(500).json({ message: "Invalid email or password" });
    }

    // Create Token
    const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Undefined password
    user.password = undefined;
    res.status(200).send({ message: "Logged in successfully", token, user });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Error in Login API" });
  }
};

module.exports = { registerController, loginController };
