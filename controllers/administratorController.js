const Administrator = require("../models/Administrator");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

exports.addAdministrator = async (req, res) => {
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { name, role, email, password } = req.body;

    // Check if administrator with this email already exists
    const existingAdmin = await Administrator.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "An administrator with this email already exists",
      });
    }

    // Validate role
    const validRoles = [
      "super_admin",
      "content_admin",
      "event_admin",
      "user_admin",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Create new administrator
    const administrator = new Administrator({
      name,
      role,
      email,
      password,
    });

    await administrator.save();

    // Don't send password in response
    const adminResponse = {
      id: administrator._id,
      name: administrator.name,
      role: administrator.role,
      email: administrator.email,
      createdAt: administrator.createdAt,
    };

    res.status(201).json({
      success: true,
      message: "Administrator added successfully",
      data: adminResponse,
    });
  } catch (error) {
    console.error("Error adding administrator:", error);

    // Handle specific error types
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map((err) => err.message),
      });
    }

    res.status(500).json({
      success: false,
      message: "Error adding administrator",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and password",
      });
    }

    // 2) Check if administrator exists && password is correct
    const administrator = await Administrator.findOne({ email }).select(
      "+password"
    );
    if (!administrator || !(await administrator.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }

    // 3) If everything ok, send accessToken and refreshToken to client
    const accessToken = jwt.sign(
      { id: administrator._id, userType: "administrator" },
      process.env.JWT_SECRET,
      { expiresIn: "1m" } // Token expires in 1 day
    );
    const refreshToken = jwt.sign(
      { id: administrator._id, userType: "administrator" },
      process.env.REFRESH_SECRET,
      { expiresIn: "30d" } // Token expires in 30 days
    );

    // Remove password from output
    administrator.password = undefined;

    res.status(200).json({
      success: true,
      token: accessToken,
      refreshToken: refreshToken, // Include it in the response for React Native
      data: {
        administrator,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Error logging in administrator",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.getAdministrators = async (req, res) => {
  try {
    const administrators = await Administrator.find().select("-password");

    res.status(200).json({
      success: true,
      data: administrators,
    });
  } catch (error) {
    console.error("Error fetching administrators:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching administrators",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.updateAdministratorRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = [
      "super_admin",
      "content_admin",
      "event_admin",
      "user_admin",
    ];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role specified",
      });
    }

    // Find and update administrator
    const administrator = await Administrator.findByIdAndUpdate(
      id,
      { role },
      { new: true, runValidators: true }
    );

    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: "Administrator not found",
      });
    }

    // Don't send password in response
    const adminResponse = {
      id: administrator._id,
      name: administrator.name,
      role: administrator.role,
      email: administrator.email,
      createdAt: administrator.createdAt,
    };

    res.status(200).json({
      success: true,
      message: "Administrator role updated successfully",
      data: adminResponse,
    });
  } catch (error) {
    console.error("Error updating administrator role:", error);
    res.status(500).json({
      success: false,
      message: "Error updating administrator role",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find administrator by email
    const administrator = await Administrator.findOne({ email });
    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: "No administrator found with this email address",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    // Update administrator with OTP
    administrator.resetPasswordOTP = otp;
    administrator.resetPasswordOTPExpiry = otpExpiry;
    await administrator.save();

    // Send email with OTP
    const emailService = require("../services/emailService");
    await emailService.sendOTPEmail({
      to: administrator.email,
      name: administrator.name,
      otp: otp,
    });

    res.status(200).json({
      success: true,
      message: "Password reset instructions have been sent to your email",
    });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({
      success: false,
      message: "Error processing forgot password request",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find administrator by email
    const administrator = await Administrator.findOne({ email });
    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: "No administrator found with this email address",
      });
    }

    // Check if OTP exists and is not expired
    if (
      !administrator.resetPasswordOTP ||
      !administrator.resetPasswordOTPExpiry
    ) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new one.",
      });
    }

    // Check if OTP is expired
    if (Date.now() > administrator.resetPasswordOTPExpiry) {
      // Clear expired OTP
      administrator.resetPasswordOTP = null;
      administrator.resetPasswordOTPExpiry = null;
      await administrator.save();

      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (administrator.resetPasswordOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    // Clear OTP after successful verification
    administrator.resetPasswordOTP = null;
    administrator.resetPasswordOTPExpiry = null;
    await administrator.save();

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find administrator by email
    const administrator = await Administrator.findOne({ email });
    if (!administrator) {
      return res.status(404).json({
        success: false,
        message: "No administrator found with this email address",
      });
    }

    // Update password
    administrator.password = password;
    await administrator.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    // Try to get token from cookies first
    let token = req.cookies?.refreshToken;
    
    // If not in cookies, check if it's in the request body or headers
    if (!token && req.body && req.body.refreshToken) {
      token = req.body.refreshToken;
    }
    
    // Also check Authorization header with "Bearer" prefix
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    // If still no token found
    if (!token) {
      console.log("No refresh token found in request");
      return res.status(401).json({ message: "No refresh token" });
    }
    
    console.log("Refresh token found:", token.substring(0, 20) + "...");
    
    jwt.verify(token, process.env.REFRESH_SECRET, (err, user) => {
      if (err) {
        console.log("Token verification failed:", err.message);
        return res.status(403).json({ message: "Invalid refresh token" });
      }
      
      const newAccessToken = jwt.sign(
        { id: user.id, userType: "administrator" },
        process.env.JWT_SECRET,
        {
          expiresIn: "1h", // More reasonable expiration time
        }
      );
      
      res.json({ accessToken: newAccessToken });
    });
  } catch (error) {
    console.error("Error in refreshToken:", error);
    res.status(500).json({ 
      message: "Error refreshing token",
      error: process.env.NODE_ENV === "development" ? error.message : "Internal server error" 
    });
  }
};
