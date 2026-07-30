const mongoose = require("mongoose");

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Book title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    genre: {
      type: String,
      required: [true, "Genre is required"],
      enum: [
        "fiction",
        "non-fiction",
        "science",
        "technology",
        "poetry",
        "drama",
        "history",
        "biography",
        "mystery",
        "romance",
        "thriller",
        "fantasy",
        "horror",
        "children",
      ],
    },
    coverImage: {
      type: String,
      default: "default-cover.jpg",
    },
    contentFile: {
      type: String,
    },
    content: {
      type: String,
    },
    chapters: [chapterSchema],
    language: {
      type: String,
      default: "english",
    },
    status: {
      type: String,
      enum: ["draft", "under_review", "seen", "cost_proposed", "published", "archived"],
      default: "draft",
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    tags: [{ type: String, trim: true }],
    totalReads: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },
    ratings: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5 },
        review: { type: String, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    averageRating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    // Blockchain
    blockchainHash: { type: String },
    isBlockchainVerified: { type: Boolean, default: false },
    // Publisher association (optional)
    publisher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    publishingCost: {
      type: Number,
      default: 0,
    },
    isPublishingPaid: {
      type: Boolean,
      default: false,
    },
    qualityScore: {
      type: Number,
    },
    readabilityScore: {
      type: String,
    },
    plagiarismScore: {
      type: Number,
    },
    plagiarismMatches: [
      {
        title: String,
        author: String,
        similarity: Number,
      },
    ],
    isCollaborative: { type: Boolean, default: false },
    collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// average rating before save
bookSchema.pre("save", function () {
  if (this.ratings.length > 0) {
    const sum = this.ratings.reduce((acc, r) => acc + r.rating, 0);
    this.averageRating = Math.round((sum / this.ratings.length) * 10) / 10;
    this.totalRatings = this.ratings.length;
  }
});

// Indexes for search
bookSchema.index({ title: "text", description: "text", tags: "text" });
bookSchema.index({ author: 1, status: 1 });
bookSchema.index({ genre: 1, status: 1 });

const Book = mongoose.model("Book", bookSchema);
module.exports = Book;
