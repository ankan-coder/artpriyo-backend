const nodemailer = require('nodemailer');

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "try.ankan@gmail.com",
    pass: "wdwifxkkuixawkhm", // Replace with your Gmail App Password
  },
});

const sendOTPEmail = async ({ to, name, otp }) => {
  const mailOptions = {
    from: "try.ankan@gmail.com",
    to,
    subject: 'Password Reset OTP - Admin Portal',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4A90E2; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Admin Portal</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${name},</p>
          <p>We received a request to reset your password. Please use the following OTP to proceed:</p>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #4A90E2; margin: 0; letter-spacing: 5px;">${otp}</h1>
          </div>
          <p>This OTP will expire in 15 minutes.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p>Best regards,<br>Admin Portal Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
};

module.exports = {
  sendOTPEmail
}; 