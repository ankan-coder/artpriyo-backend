const JWT = require("jsonwebtoken");
const { hashPassword, comparePassword } = require("../helpers/authHelper");
const {
  generateOTP,
  sendOTPEmail,
  sendForgotPasswordEmail,
} = require("../helpers/emailService");
const userModel = require("../models/userModel");
const mongoose = require("mongoose");
const Connection = require("../models/connectionModel");
const Post = require("../models/postModel");
const Event = require("../models/eventModel");
const Transaction = require("../models/transactionModel");
const bcrypt = require("bcrypt");

// Add this at the top with other imports
const otpStore = new Map(); // Temporary store for OTPs

// Register
const registerController = async (req, res) => {
  try {
    const { firstName, lastName, userName, accountType, email, password } =
      req.body;

    // Field validation
    if (!firstName)
      return res.status(400).json({ message: "First name is required" });
    if (!lastName)
      return res.status(400).json({ message: "Last name is required" });
    if (!userName)
      return res.status(400).json({ message: "Username is required" });
    if (!accountType)
      return res.status(400).json({ message: "Account type is required" });
    if (!email) return res.status(400).json({ message: "Email is required" });
    if (!password)
      return res.status(400).json({ message: "Password is required" }); // Check if the email already exists
    const existingEmail = await userModel.findOne({
      email: email.toLowerCase(),
    });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Check if the username already exists
    const existingUsername = await userModel.findOne({ userName });
    if (existingUsername) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // Hash Password
    const hashedPassword = await hashPassword(password);

    // Generate a new ObjectId as userID
    const userID = new mongoose.Types.ObjectId().toString(); // Save User
    const user = new userModel({
      userID,
      firstName,
      lastName,
      userName,
      accountType,
      email: email.toLowerCase(), // Ensure email is saved in lowercase
      password: hashedPassword,
      balance: 0,
    });

    await user.save();

    // Create Token
    const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Exclude password from response
    user.password = undefined;

    // Success response with token
    return res.status(201).json({
      message: "User registered successfully",
      token,
      user: { userID, firstName, lastName, userName, accountType, email },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error in register API" });
  }
};

// Login
const loginController = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    // Check if the user exists
    const user = await userModel.findOne({ email: email.toLowerCase() }); // Ensure email is case-insensitive
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Password Check
    const match = await comparePassword(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Create Token
    const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    // Exclude password from response
    user.password = undefined;
    return res
      .status(200)
      .json({ message: "Logged in successfully", token, user });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Error in Login API" });
  }
};

// Fetch User Details
const fetchUserDetails = async (req, res) => {
  try {
    // `req.user` is set by `authMiddleware`
    const user = await userModel
      .findById(req.user.userID)
      .select("-password") // Exclude password
      .populate({
        path: "followersCount followingCount",
        select: "followersCount followingCount",
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get actual counts from connections
    const followersCount = await Connection.countDocuments({
      recipient: req.user.userID,
      status: "accepted",
    });

    const followingCount = await Connection.countDocuments({
      requester: req.user.userID,
      status: "accepted",
    });

    // Update the user object with real counts
    const userWithCounts = {
      ...user.toObject(),
      followersCount,
      followingCount,
    };

    res.status(200).json({ success: true, user: userWithCounts });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Error in Fetch User Details API" });
  }
};

// Update User Details
const updateUserDetails = async (req, res) => {
  try {
    const userId = req.user.userID; // Extracted from token via authMiddleware

    const { image, firstName, lastName, userName, description } = req.body;

    const updatedFields = {};
    if (image) updatedFields.image = image;
    if (firstName) updatedFields.firstName = firstName;
    if (lastName) updatedFields.lastName = lastName;
    if (userName) updatedFields.userName = userName;
    if (description) updatedFields.description = description;

    if (Object.keys(updatedFields).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No fields to update" });
    }

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      { $set: updatedFields },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .send({ message: "Error in Update User Details API" });
  }
};

// Fetch User By ID
const fetchUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userID;

    // Find user by ID
    const user = await userModel
      .findById(userId)
      .select("-password") // Exclude password
      .populate({
        path: "followersCount followingCount",
        select: "followersCount followingCount",
      });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get actual counts from connections
    const followersCount = await Connection.countDocuments({
      recipient: userId,
      status: "accepted",
    });

    const followingCount = await Connection.countDocuments({
      requester: userId,
      status: "accepted",
    });

    // Check connection status
    const connection = await Connection.findOne({
      $or: [
        { requester: currentUserId, recipient: userId },
        { requester: userId, recipient: currentUserId },
      ],
    });

    const connectionStatus = connection
      ? {
          isConnected: connection.status === "accepted",
          isPending: connection.status === "pending",
          isRequester:
            connection.requester.toString() === currentUserId.toString(),
        }
      : {
          isConnected: false,
          isPending: false,
          isRequester: false,
        };

    // Update the user object with real counts and connection status
    const userWithCounts = {
      ...user.toObject(),
      followersCount,
      followingCount,
      connectionStatus,
    };

    res.status(200).json({ success: true, user: userWithCounts });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: "Error in Fetch User By ID API" });
  }
};

// Get User Statistics
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.userID;

    // Get user details including wallet balance
    const user = await userModel.findById(userId).select("balance");

    // Get total posts count
    const postsCount = await Post.countDocuments({ userID: userId });

    // Get followers and following counts
    const followersCount = await Connection.countDocuments({
      recipient: userId,
      status: "accepted",
    });

    const followingCount = await Connection.countDocuments({
      requester: userId,
      status: "accepted",
    });

    // Get total likes received and given
    const posts = await Post.find({ userID: userId });
    const likesReceived = posts.reduce(
      (total, post) => total + (post.likes || 0),
      0
    );

    // Get total comments received and given
    const commentsReceived = posts.reduce(
      (total, post) => total + (post.commentsCount || 0),
      0
    );

    // Get event participation stats
    const eventsJoined = await Event.countDocuments({
      $or: [{ creator: userId }, { participants: userId }],
    });

    // Get current date in YYYY-MM-DD format
    const currentDate = new Date().toISOString().split("T")[0];

    const currentEvents = await Event.countDocuments({
      $or: [{ creator: userId }, { participants: userId }],
      $and: [
        { startDate: { $lte: currentDate } },
        { endDate: { $gte: currentDate } },
      ],
    });

    // Get upcoming events
    const upcomingEvents = await Event.countDocuments({
      $or: [{ creator: userId }, { participants: userId }],
      startDate: { $gt: currentDate },
    });

    // Get past events
    const pastEvents = await Event.countDocuments({
      $or: [{ creator: userId }, { participants: userId }],
      endDate: { $lt: currentDate },
    });

    // Get total event earnings (from transactions)
    const eventEarnings = await Transaction.aggregate([
      {
        $match: {
          userID: userId,
          type: "credit",
          description: { $regex: "event", $options: "i" },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Get total event spending
    const eventSpending = await Transaction.aggregate([
      {
        $match: {
          userID: userId,
          type: "debit",
          description: { $regex: "event", $options: "i" },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      stats: {
        walletBalance: user.balance || 0,
        posts: postsCount,
        followers: followersCount,
        following: followingCount,
        likesReceived,
        commentsReceived,
        eventsJoined,
        currentEvents,
        upcomingEvents,
        pastEvents,
        eventEarnings: eventEarnings[0]?.total || 0,
        eventSpending: eventSpending[0]?.total || 0,
        netEventEarnings:
          (eventEarnings[0]?.total || 0) - (eventSpending[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      success: false,
      message: "Error while fetching user statistics",
      error: error.message,
    });
  }
};

// Change Email
const changeEmailController = async (req, res) => {
  try {
    const { currentEmail, newEmail, password, otp } = req.body;
    const userId = req.user.userID;

    // Validate required fields
    if (!currentEmail || !newEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // Find user by ID
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current email matches
    if (user.email !== currentEmail) {
      return res.status(400).json({
        success: false,
        message: "Current email does not match",
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid password",
      });
    }

    // Check if new email is already taken
    const existingUser = await userModel.findOne({ email: newEmail });
    if (existingUser && existingUser._id.toString() !== userId.toString()) {
      return res.status(400).json({
        success: false,
        message: "Email is already in use",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    // If OTP is not provided, send verification email
    if (!otp) {
      const generatedOTP = generateOTP();
      otpStore.set(userId, {
        otp: generatedOTP,
        newEmail,
        timestamp: Date.now(),
      });

      try {
        await sendOTPEmail(newEmail, generatedOTP);
        return res.status(200).json({
          success: true,
          message: "Verification OTP sent to your new email address",
          requiresOTP: true,
        });
      } catch (error) {
        console.error("Error sending OTP:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to send verification email",
        });
      }
    }

    // Verify OTP
    const storedOTP = otpStore.get(userId);
    if (!storedOTP || storedOTP.otp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    // Check if OTP is expired (10 minutes)
    if (Date.now() - storedOTP.timestamp > 10 * 60 * 1000) {
      otpStore.delete(userId);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Update email
    user.email = newEmail;
    await user.save();

    // Clear OTP from store
    otpStore.delete(userId);

    // Generate new token with updated email
    const token = await JWT.sign({ _id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "30d",
    });

    return res.status(200).json({
      success: true,
      message: "Email updated successfully",
      token,
      user: {
        _id: user._id,
        userID: user.userID,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
      },
    });
  } catch (error) {
    console.error("Error in change email:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating email",
    });
  }
};

// Change Password
const changePasswordController = async (req, res) => {
  try {
    console.log("Change password request body:", req.body);

    const { oldPassword, newPassword, confirmNewPassword, otp } = req.body;

    // Validate required fields
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      console.log("Missing required fields:", {
        oldPassword,
        newPassword,
        confirmNewPassword,
      });
      return res.status(400).json({
        success: false,
        message: "All fields are required",
        missingFields: {
          oldPassword: !oldPassword,
          newPassword: !newPassword,
          confirmNewPassword: !confirmNewPassword,
        },
      });
    }

    // Get user from token
    const userId = req.user.userID;
    console.log("User ID from token:", userId);

    const user = await userModel.findById(userId);
    console.log("Found user:", user ? "Yes" : "No");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify current password
    const isPasswordValid = await comparePassword(oldPassword, user.password);
    console.log("Password validation:", isPasswordValid ? "Valid" : "Invalid");

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Check if new passwords match
    if (newPassword !== confirmNewPassword) {
      console.log("Passwords don't match");
      return res.status(400).json({
        success: false,
        message: "New passwords do not match",
      });
    }

    // Check password length
    if (newPassword.length < 8) {
      console.log("Password too short:", newPassword.length);
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long",
      });
    }

    // If OTP is not provided, send OTP to user's email
    if (!otp) {
      console.log("No OTP provided, generating new OTP");
      const generatedOTP = generateOTP();
      console.log("Generated OTP:", generatedOTP);

      otpStore.set(user.email, {
        otp: generatedOTP,
        timestamp: Date.now(),
      });

      try {
        console.log("Sending OTP to email:", user.email);
        await sendOTPEmail(user.email, generatedOTP);
        return res.status(200).json({
          success: true,
          requiresOTP: true,
          message: "OTP sent to your email",
        });
      } catch (error) {
        console.error("Error sending OTP:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }
    }

    // Verify OTP if provided
    console.log("Verifying OTP");
    const storedOTP = otpStore.get(user.email);
    if (!storedOTP) {
      console.log("No stored OTP found");
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found. Please try again.",
      });
    }

    // Check OTP expiration (10 minutes)
    if (Date.now() - storedOTP.timestamp > 10 * 60 * 1000) {
      console.log("OTP expired");
      otpStore.delete(user.email);
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please try again.",
      });
    }

    // Verify OTP
    if (otp !== storedOTP.otp) {
      console.log("Invalid OTP provided");
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Hash new password
    console.log("Hashing new password");
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    console.log("Updating password");
    user.password = hashedPassword;
    await user.save();

    // Clear OTP from store
    console.log("Clearing OTP from store");
    otpStore.delete(user.email);

    // Generate new token
    console.log("Generating new token");
    const token = JWT.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
      token,
    });
  } catch (error) {
    console.error("Error in changePasswordController:", error);
    res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message,
    });
  }
};

// Send OTP for password reset
const sendOtpForPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  // Generate OTP
  const generatedOTP = generateOTP();
  console.log("Generated OTP:", generatedOTP);

  // OTP will be valid for 10 minutes
  otpStore.set(email, {
    otp: generatedOTP,
    timestamp: Date.now(),
  });

  try {
    await sendForgotPasswordEmail(email, generatedOTP);
    return res.status(200).json({
      success: true,
      message: "Verification OTP sent to your email address",
      requiresOTP: true,
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification email",
    });
  }
};

// Verify OTP for password reset
const verifyOtpForPasswordReset = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  const storedOTP = otpStore.get(email);
  if (!storedOTP || storedOTP.otp !== otp) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired OTP",
    });
  }

  // Check if OTP is expired (10 minutes)
  if (Date.now() - storedOTP.timestamp > 10 * 60 * 1000) {
    otpStore.delete(email);
    return res.status(400).json({
      success: false,
      message: "OTP has expired. Please request a new one.",
    });
  }

  // Clear OTP from store
  otpStore.delete(email);

  return res.status(200).json({
    success: true,
    message: "OTP verified successfully",
  });
};

// Save new password after OTP verification
const saveNewPassword = async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email and new password are required",
    });
  }

  // Validate password length
  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long",
    });
  }

  try {
    const user = await userModel.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error saving new password:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating password",
    });
  }
};

module.exports = {
  registerController,
  loginController,
  fetchUserDetails,
  updateUserDetails,
  fetchUserById,
  getUserStats,
  changeEmailController,
  changePasswordController,
  saveNewPassword,
  sendOtpForPasswordReset,
  verifyOtpForPasswordReset,
};
