const { hashPassword } = require("../helpers/authHelper");
const userModel = require("../models/userModel");

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

module.exports = { registerController };
