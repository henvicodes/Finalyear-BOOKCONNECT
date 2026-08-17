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
    publisherVerification: {
      isVerified: {
        type: Boolean,
        default: false,
      },
      documentLink: {
        type: String,
      },
      blockchainHash: {
        type: String,
      },
    },
    earnings: {
      type: Number,
      default: 0,
    },
    walletBalance: {
      type: Number,
      default: 1000,
    },
    walletPin: {
      type: String,
      default: null,
    },
    walletAddress: {
      type: String,
      default: "",
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    otpCode: {
      type: String,
      select: false,
    },
    otpExpiry: {
      type: Date,
      select: false,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    tempRegistrationData: {
      type: mongoose.Schema.Types.Mixed,
      select: false,
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
