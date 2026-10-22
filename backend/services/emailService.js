const nodemailer = require("nodemailer");

// Two ways to send mail:
//  - Brevo's HTTPS API (set BREVO_API_KEY). Use this on hosts that block SMTP
//    ports, which includes most free hosting (e.g. Render's free web services).
//  - Gmail over SMTP (EMAIL_USER + EMAIL_PASS), fine on a normal computer.
const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const useBrevo = () => !!process.env.BREVO_API_KEY;

let transporter = null;
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
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
  }
  return transporter;
};

// Verify the Gmail connection at start-up (skipped in tests, which never send
// real mail, and when Brevo is used instead).
if (process.env.NODE_ENV !== "test" && !useBrevo() && process.env.EMAIL_USER) {
  getTransporter().verify(function (error) {
    if (error) {
      console.log("Email server connection error:", error.message);
    } else {
      console.log("Email server is ready to send messages");
    }
  });
} else if (useBrevo() && process.env.NODE_ENV !== "test") {
  console.log("Email will be sent through the Brevo API");
}

// The address mail is sent from. With Brevo it must be a sender you verified there.
const senderAddress = () => process.env.EMAIL_FROM || process.env.EMAIL_USER;

const deliverWithBrevo = async ({ to, toName, subject, html }) => {
  const from = senderAddress();
  if (!from) throw new Error("EMAIL_FROM is not configured");

  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "BookConnect", email: from },
      to: [{ email: to, ...(toName ? { name: toName } : {}) }],
      subject,
      htmlContent: html,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json()).message || "";
    } catch (_) {
      /* body was not JSON */
    }
    throw new Error(`Brevo responded ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response.json().catch(() => ({}));
};

const deliverWithGmail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error("Email credentials not configured");
  }
  return getTransporter().sendMail({
    from: `"BookConnect" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

const deliver = (message) => (useBrevo() ? deliverWithBrevo(message) : deliverWithGmail(message));

const sendOTPEmail = async (email, name, otp) => {
  try {
    const html = `
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
      `;

    return await deliver({
      to: email,
      toName: name,
      subject: "Verify Your Email - OTP Code",
      html,
    });
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

module.exports = { sendOTPEmail };
