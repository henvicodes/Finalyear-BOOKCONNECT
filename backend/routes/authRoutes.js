const express = require("express");
const router = express.Router();
const {
  sendRegistrationOTP,
  verifyOTPAndRegister,
  resendOTP,
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  linkWallet,
  searchUsers,
} = require("../controllers/authController");
const { uploadProfilePicture } = require("../controllers/UploadController.js");
const { protect } = require("../middleware/authMiddleware");
const {
  validateRegister,
  validateLogin,
  validate,
} = require("../utils/validators");

//  Public
router.post("/send-otp", validateRegister, validate, sendRegistrationOTP);
router.post("/verify-otp", verifyOTPAndRegister);
router.post("/resend-otp", resendOTP);
router.post("/register", validateRegister, validate, registerUser);
router.post("/login", validateLogin, validate, loginUser);

// Private
router.get("/profile", protect, getUserProfile);
router.put("/profile", protect, updateUserProfile);
router.put("/profile/picture", protect, uploadProfilePicture); // ← new
router.post("/link-wallet", protect, linkWallet);
router.get("/search", protect, searchUsers);

module.exports = router;
