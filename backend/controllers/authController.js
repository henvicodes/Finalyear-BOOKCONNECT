const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { generateOTP, generateOTPExpiry } = require("../utils/otpGenerator");
const { sendOTPEmail } = require("../services/emailService");

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
      existingUser.otpCode = otp;
      existingUser.otpExpiry = otpExpiry;
      existingUser.tempRegistrationData = { name, email, password, role };

      await existingUser.save();
    } else {
      console.log("Creating new user");
      const newUser = new User({
        name,
        email,
        password,
        role: role || "reader",
        otpCode: otp,
        otpExpiry: otpExpiry,
        isEmailVerified: false,
        tempRegistrationData: { name, email, password, role },
      });

      await newUser.save();
      console.log("Created new user successfully");
    }

    // Send OTP via email
    try {
      await sendOTPEmail(email, name, otp);
      console.log("OTP email sent successfully");
    } catch (emailError) {
      console.log("=========================================");
      console.log(`[DEV MODE ONLY] Failed to send SMTP email to ${email}`);
      console.log(`Your verification OTP code is: ${otp}`);
      console.log("=========================================");
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
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

// Verify OTP
const verifyOTPAndRegister = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select(
      "+otpCode +otpExpiry +tempRegistrationData +password",
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

    // Verify OTP
    if (!user.otpCode || user.otpCode !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
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
    user.tempRegistrationData = undefined;

    await user.save();

    // Generate token and return user data
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
        token: generateToken(user._id, user.role),
      },
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Resend OTP
const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email }).select(
      "+otpCode +otpExpiry +tempRegistrationData",
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
    user.otpCode = otp;
    user.otpExpiry = otpExpiry;

    await user.save();

    // Send new OTP via email
    try {
      await sendOTPEmail(email, user.name, otp);
    } catch (emailError) {
      console.log("=========================================");
      console.log(`[DEV MODE ONLY] Failed to resend SMTP email to ${email}`);
      console.log(`Your verification OTP code is: ${otp}`);
      console.log("=========================================");
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
      error: error.message,
    });
  }
};

const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || "reader",
    });

    if (user) {
      res.status(201).json({
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
          token: generateToken(user._id, user.role),
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid user data",
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

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
        token: generateToken(user._id, user.role),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
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
        isVerified: user.isVerified,
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
const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, data: [] });
    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } }
      ],
      role: { $in: ["author", "publisher", "reader"] }
    }).select("name email role profilePicture").limit(100);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
module.exports = {
  sendRegistrationOTP,
  verifyOTPAndRegister,
  resendOTP,
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  linkWallet,
  searchUsers,
};
