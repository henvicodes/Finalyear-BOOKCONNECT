const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // timeout settings
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// Verify connection configuration
transporter.verify(function (error, success) {
  if (error) {
    console.log("Email server connection error:", error);
  } else {
    console.log("Email server is ready to send messages");
  }
});

const sendOTPEmail = async (email, name, otp) => {
  try {
    // Validate email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error("Email credentials not configured");
    }

    const mailOptions = {
      from: `"BookConnect" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email - OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #333; margin-bottom: 10px;">Email Verification</h2>
          </div>
          
          <p style="color: #666; font-size: 16px;">Hello ${name},</p>
          
          <p style="color: #666; font-size: 16px;">Thank you for registering with Literary Hub! Please use the following OTP code to verify your email address:</p>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center; margin: 30px 0; border-radius: 10px;">
            <h1 style="color: white; letter-spacing: 5px; font-size: 40px; margin: 0;">${otp}</h1>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #666; margin: 5px 0;"><strong>⏰ Valid for:</strong> 10 minutes</p>
            <p style="color: #666; margin: 5px 0;"><strong>🔒 One-time use only</strong></p>
          </div>
          
          <p style="color: #999; font-size: 14px;">If you didn't request this verification, please ignore this email.</p>
          
          <hr style="border: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">
            This is an automated message, please do not reply.<br>
            &copy; ${new Date().getFullYear()} Literary Hub. All rights reserved.
          </p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = { sendOTPEmail };
