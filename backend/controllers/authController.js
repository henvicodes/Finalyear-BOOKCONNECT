const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { generateOTP, generateOTPExpiry, hashOTP, otpMatches, MAX_OTP_ATTEMPTS } = require("../utils/otpGenerator");
// Used as a module object (not destructured) so tests can replace sendOTPEmail.
const emailService = require("../services/emailService");
const { setAuthCookie, clearAuthCookie } = require("../utils/authCookie");

// In development, when SMTP isn't working, print the code so sign-up can still be
// tested. Never in production — a log file is not a safe place for a login code.
const logOtpForDev = (email, otp, what) => {
  if (process.env.NODE_ENV === "production") return;
  console.log("=========================================");
  console.log(`[DEV ONLY] Could not send the ${what} email to ${email}`);
  console.log(`Verification code: ${otp}`);
  console.log("=========================================");
};

// When the code e-mail can't be sent: in development print the code so sign-up
// can still be tested; in production tell the user honestly instead of letting
// them wait for an email that will never arrive. Returns true if a response was sent.
const emailFailed = (res, email, otp, what) => {
  if (process.env.NODE_ENV === "production") {
    res.status(502).json({
      success: false,
      message: "We could not send the verification email right now. Please try again in a few minutes.",
    });
    return true;
  }
  logOtpForDev(email, otp, what);
  return false;
};

// Send OTP
const sendRegistrationOTP = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = generateOTPExpiry(10); // 10 minutes expiry

    if (existingUser) {
      existingUser.name = name;
      existingUser.password = password;
      existingUser.role = role || "reader";
      existingUser.otpCode = hashOTP(otp);
      existingUser.otpExpiry = otpExpiry;
      existingUser.otpAttempts = 0;

      await existingUser.save();
    } else {
      console.log("Creating new user");
      const newUser = new User({
        name,
        email,
        password,
        role: role || "reader",
        otpCode: hashOTP(otp),
        otpExpiry: otpExpiry,
        otpAttempts: 0,
        isEmailVerified: false,
      });

      await newUser.save();
      console.log("Created new user successfully");
    }

    // Send OTP via email
    try {
      await emailService.sendOTPEmail(email, name, otp);
      console.log("OTP email sent successfully");
    } catch (emailError) {
      console.error("OTP email failed:", emailError.message);
      if (emailFailed(res, email, otp, "verification")) return;
    }

    res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      data: {
        email,
        expiresIn: "10 minutes",
      },
    });
  } catch (error) {
    console.error("Send OTP Error Details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    // Check for specific mongoose errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
};

// Verify OTP
const verifyOTPAndRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (typeof email !== "string" || typeof otp !== "string") {
      return res.status(400).json({ success: false, message: "Email and OTP are required" });
    }

    // Find user by email
    const user = await User.findOne({ email }).select(
      "+otpCode +otpExpiry +otpAttempts +password",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already verified
    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    // Too many wrong guesses: the code is burned and a new one must be requested.
    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many wrong codes. Please request a new one.",
      });
    }

    // Verify OTP (hash compared in constant time)
    if (!otpMatches(user.otpCode, otp)) {
      const updated = await User.findByIdAndUpdate(
        user._id, { $inc: { otpAttempts: 1 } }, { new: true }
      ).select("+otpAttempts");
      const left = MAX_OTP_ATTEMPTS - (updated.otpAttempts || 0);
      return res.status(400).json({
        success: false,
        message: left > 0
          ? `Invalid OTP code. ${left} attempt${left === 1 ? "" : "s"} left.`
          : "Too many wrong codes. Please request a new one.",
      });
    }

    // Check OTP expiry
    if (user.otpExpiry < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Mark email as verified and clear OTP fields
    user.isEmailVerified = true;
    user.otpCode = undefined;
    user.otpExpiry = undefined;
    user.otpAttempts = undefined;

    await user.save();

    // Sign the user in: httpOnly cookie for the browser app, and the token in
    // the body for non-browser API clients.
    const sessionToken = generateToken(user._id, user.role);
    setAuthCookie(res, sessionToken);
    res.status(201).json({
      success: true,
      message: "Email verified successfully! Registration complete.",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
        isEmailVerified: user.isEmailVerified,
        token: sessionToken,
      },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (typeof email !== "string") {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email }).select(
      "+otpCode +otpExpiry +otpAttempts",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified",
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = generateOTPExpiry(10);

    // Update user with new OTP
    user.otpCode = hashOTP(otp);
    user.otpExpiry = otpExpiry;
    user.otpAttempts = 0;

    await user.save();

    // Send new OTP via email
    try {
      await emailService.sendOTPEmail(email, user.name, otp);
    } catch (emailError) {
      console.error("OTP email failed:", emailError.message);
      if (emailFailed(res, email, otp, "verification (resend)")) return;
    }

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      data: {
        email,
        expiresIn: "10 minutes",
      },
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
};

// POST /api/auth/logout - ends the browser session by clearing the cookie
const logoutUser = (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out" });
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isPasswordMatch = await user.comparePassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        suspended: true,
        message: "This account has been suspended. Contact support.",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first — finish registration with the code we emailed you.",
      });
    }

    const sessionToken = generateToken(user._id, user.role);
    setAuthCookie(res, sessionToken);
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        isVerified: user.isVerified,
        walletBalance: user.walletBalance,
        earnings: user.earnings,
        token: sessionToken,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        bio: user.bio,
        interests: user.interests,
        isVerified: user.isVerified || !!user.publisherVerification?.isVerified,
        publisherVerificationStatus: user.role === "publisher" ? (user.publisherVerification?.status || "none") : undefined,
        blockchainWallet: user.blockchainWallet,
        walletBalance: user.walletBalance,
        earnings: user.earnings,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.bio = req.body.bio || user.bio;
      user.interests = req.body.interests || user.interests;

      if (req.body.profilePicture) {
        user.profilePicture = req.body.profilePicture;
      }

      const updatedUser = await user.save();

      res.json({
        success: true,
        data: {
          _id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          profilePicture: updatedUser.profilePicture,
          bio: updatedUser.bio,
          interests: updatedUser.interests,
          isVerified: updatedUser.isVerified,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const linkWallet = async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (typeof walletAddress !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return res.status(400).json({ success: false, message: "A valid wallet address is required" });
    }

    // One MetaMask account can belong to only one BookConnect account. Two accounts
    // sharing a wallet would make a buyer and seller the same address on-chain, and
    // the payment contract refuses to let a wallet pay itself.
    const taken = await User.findOne({
      _id: { $ne: req.user._id },
      $or: [
        { walletAddress: { $regex: `^${walletAddress}$`, $options: "i" } },
        { "blockchainWallet.address": { $regex: `^${walletAddress}$`, $options: "i" } },
      ],
    }).select("_id");
    if (taken) {
      return res.status(409).json({
        success: false,
        message: "That MetaMask account is already linked to another BookConnect account. Switch to a different MetaMask account and try again.",
      });
    }

    const user = await User.findById(req.user._id);

    if (user) {
      user.blockchainWallet = {
        address: walletAddress,
        isLinked: true,
      };
      user.walletAddress = walletAddress;

      await user.save();

      res.json({
        success: true,
        message: "Wallet linked successfully",
        data: {
          walletAddress: user.blockchainWallet.address,
          isLinked: user.blockchainWallet.isLinked,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
// DELETE /api/auth/link-wallet - disconnect the linked wallet from this account
const unlinkWallet = async (req, res) => {
  try {
    await User.updateOne(
      { _id: req.user._id },
      { $set: { walletAddress: "", blockchainWallet: { isLinked: false } } }
    );
    res.json({ success: true, message: "Wallet unlinked" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (typeof q !== "string" || !q) return res.json({ success: true, data: [] });
    // escape so user input is matched literally (no regex injection / ReDoS)
    const safe = q.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      $or: [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } }
      ],
      role: { $in: ["author", "publisher", "reader"] },
      isSuspended: { $ne: true },
    }).select("name email role profilePicture publisherVerification.isVerified walletAddress blockchainWallet.address blockchainWallet.isLinked").limit(100);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
module.exports = {
  sendRegistrationOTP,
  verifyOTPAndRegister,
  resendOTP,
  loginUser,
  logoutUser,
  getUserProfile,
  updateUserProfile,
  linkWallet,
  unlinkWallet,
  searchUsers,
};
