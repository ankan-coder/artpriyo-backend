const nodemailer = require("nodemailer");

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "try.ankan@gmail.com",
    pass: "wdwifxkkuixawkhm", // Replace with your Gmail App Password
  },
});

// Function to generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Function to send OTP email
const sendOTPEmail = async (email, otp) => {
  try {
    const mailOptions = {
      from: "try.ankan@gmail.com",
      to: email,
      subject: "Email Change Verification - OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #297BCE;">Email Change Verification</h2>
          <p>You have requested to change your email address. Please use the following OTP to verify your new email:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #297BCE; margin: 0;">${otp}</h1>
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this change, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send verification email");
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
