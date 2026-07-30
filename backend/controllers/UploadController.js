const User = require("../models/User");

const uploadProfilePicture = async (req, res) => {
  try {
    const { profilePicture } = req.body;

    if (!profilePicture) {
      return res.status(400).json({
        success: false,
        message: "profilePicture field is required",
      });
    }

    // base64 of 2 MB image is ~2.7 MB as a string
    if (profilePicture.length > 3_500_000) {
      return res.status(413).json({
        success: false,
        message: "Image is too large. Please use an image under 2 MB.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { profilePicture },
      { new: true },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      message: "Profile picture updated",
      data: { profilePicture: user.profilePicture },
    });
  } catch (error) {
    console.error("uploadProfilePicture error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = { uploadProfilePicture };
