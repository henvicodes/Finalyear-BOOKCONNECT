const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please add a name"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Please add an email"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      required: [true, "Please add a password"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["reader", "author", "publisher", "admin"],
      default: "reader",
    },
    profilePicture: {
      type: String,
      default: "default-avatar.png",
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
    },
    interests: [
      {
        type: String,
        enum: [
          "fiction",
          "non-fiction",
          "science",
          "technology",
          "poetry",
          "drama",
          "history",
          "biography",
        ],
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    blockchainWallet: {
      address: String,
      isLinked: {
        type: Boolean,
        default: false,
      },
    },
    purchasedBooks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    ],
    // Publisher identity check. A publisher submits evidence; an admin reviews it
    // and approves/rejects. `isVerified` is only ever set by an admin approval.
    publisherVerification: {
      status: {
        type: String,
        enum: ["none", "pending", "approved", "rejected"],
        default: "none",
      },
      isVerified: {
        type: Boolean,
        default: false,
      },
      companyName: { type: String, trim: true, maxlength: 120 },
      websiteUrl: { type: String, trim: true, maxlength: 300 },
      registrationType: {
        type: String,
        enum: ["CIN", "LLPIN", "GSTIN", "UDYAM", "ISBN_PREFIX", "OTHER"],
      },
      registrationNumber: { type: String, trim: true, maxlength: 60 },
      isbnPrefix: { type: String, trim: true, maxlength: 20 },
      documentLink: {
        type: String,
      },
      notes: { type: String, maxlength: 1000 },
      submittedAt: Date,
      reviewedAt: Date,
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectionReason: { type: String, maxlength: 500 },
      // SHA-256 fingerprint of the approved details (tamper-evident record).
      blockchainHash: {
        type: String,
      },
    },
    // Admin moderation: a suspended account can't log in or use existing sessions.
    isSuspended: { type: Boolean, default: false },
    suspendedReason: { type: String, maxlength: 300 },
    suspendedAt: Date,
    earnings: {
      type: Number,
      default: 0,
    },
    walletBalance: {
      type: Number,
      default: 1000,
    },
    // bcrypt hash of the 4-digit wallet PIN (never the PIN itself). Older
    // accounts may still hold a plain PIN — utils/pin.js upgrades it to a
    // hash the next time it is verified.
    walletPin: {
      type: String,
      default: null,
      select: false,
    },
    pinFailedAttempts: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },
    walletAddress: {
      type: String,
      default: "",
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    // SHA-256 hash of the emailed one-time code (not the code itself), plus
    // a counter so the 6 digits can't be brute-forced.
    otpCode: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  // If it's already a bcrypt hash, don't hash it again
  if (this.password && /^\$2[ayb]\$.{56}$/.test(this.password)) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User = mongoose.model("User", userSchema);

module.exports = User;
