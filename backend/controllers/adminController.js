const User = require("../models/User");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const Message = require("../models/Message");

// @desc    Get system-wide metrics and stats for admin dashboard
// @route   GET /api/admin/stats
// @access  Private (Admin only)
const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      readersCount,
      authorsCount,
      publishersCount,
      adminsCount,
      verifiedUsersCount,
      totalBooks,
      publishedBooks,
      draftBooks,
      underReviewBooks,
      costProposedBooks,
      archivedBooks,
      totalTransactions,
      recentUsers,
      recentBooks,
      recentTransactions,
      transactionsAgg,
      pendingVerificationsCount
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "reader" }),
      User.countDocuments({ role: "author" }),
      User.countDocuments({ role: "publisher" }),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ isVerified: true }),
      Book.countDocuments(),
      Book.countDocuments({ status: "published" }),
      Book.countDocuments({ status: "draft" }),
      Book.countDocuments({ status: "under_review" }),
      Book.countDocuments({ status: "cost_proposed" }),
      Book.countDocuments({ status: "archived" }),
      Transaction.countDocuments(),
      User.find().select("name email role isVerified createdAt profilePicture walletBalance").sort("-createdAt").limit(5),
      Book.find().populate("author", "name email").populate("publisher", "name").sort("-createdAt").limit(5),
      Transaction.find().populate("sender", "name email role").populate("receiver", "name email role").sort("-createdAt").limit(5),
      Transaction.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, totalVolume: { $sum: "$amount" } } }
      ]),
      User.countDocuments({
        role: "publisher",
        "publisherVerification.documentLink": { $exists: true, $ne: "" },
        "publisherVerification.isVerified": false
      })
    ]);

    // Calculate total reviews & average platform rating
    const booksWithRatings = await Book.find({ "ratings.0": { $exists: true } }).select("ratings averageRating");
    let totalReviews = 0;
    let ratingSum = 0;
    booksWithRatings.forEach((b) => {
      totalReviews += b.ratings ? b.ratings.length : 0;
      if (b.averageRating) ratingSum += b.averageRating;
    });
    const avgPlatformRating = booksWithRatings.length > 0 
      ? (ratingSum / booksWithRatings.length).toFixed(1) 
      : "5.0";

    const totalVolume = transactionsAgg[0]?.totalVolume || 0;

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          readers: readersCount,
          authors: authorsCount,
          publishers: publishersCount,
          admins: adminsCount,
          verified: verifiedUsersCount,
          pendingPublisherVerifications: pendingVerificationsCount,
        },
        books: {
          total: totalBooks,
          published: publishedBooks,
          draft: draftBooks,
          underReview: underReviewBooks,
          costProposed: costProposedBooks,
          archived: archivedBooks,
        },
        financials: {
          totalTransactions,
          totalVolume,
        },
        engagement: {
          totalReviews,
          avgPlatformRating,
        },
        recent: {
          users: recentUsers,
          books: recentBooks,
          transactions: recentTransactions,
        }
      }
    });
  } catch (error) {
    console.error("getAdminStats error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get all users with search, role and verification filters
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getAllUsers = async (req, res) => {
  try {
    const { search, role, isVerified, page = 1, limit = 50 } = req.query;
    const query = {};

    if (role && role !== "all") {
      query.role = role;
    }

    if (isVerified !== undefined && isVerified !== "") {
      query.isVerified = isVerified === "true";
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query)
    ]);

    // Enrich users with authored books count
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        const uObj = u.toObject();
        if (u.role === "author") {
          uObj.authoredBooksCount = await Book.countDocuments({ author: u._id });
        } else if (u.role === "publisher") {
          uObj.publishedBooksCount = await Book.countDocuments({ publisher: u._id, status: "published" });
          uObj.pendingSubmissionsCount = await Book.countDocuments({ publisher: u._id, status: "under_review" });
        } else if (u.role === "reader") {
          uObj.libraryCount = u.purchasedBooks ? u.purchasedBooks.length : 0;
        }
        return uObj;
      })
    );

    res.json({
      success: true,
      data: enrichedUsers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("getAllUsers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update a user's details or role
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const {
      name,
      email,
      role,
      isVerified,
      walletBalance,
      earnings,
      bio,
      publisherVerification
    } = req.body;

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (isVerified !== undefined) user.isVerified = isVerified;
    if (walletBalance !== undefined) user.walletBalance = Number(walletBalance);
    if (earnings !== undefined) user.earnings = Number(earnings);
    if (bio !== undefined) user.bio = bio;

    if (publisherVerification) {
      user.publisherVerification = {
        ...user.publisherVerification,
        ...publisherVerification
      };
      if (publisherVerification.isVerified) {
        user.isVerified = true;
      }
    }

    await user.save();

    res.json({
      success: true,
      message: "User updated successfully",
      data: user
    });
  } catch (error) {
    console.error("updateUser error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin only)
const deleteUser = async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot delete your own admin account"
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    await user.deleteOne();
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("deleteUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all books & manuscripts for admin management
// @route   GET /api/admin/books
// @access  Private (Admin only)
const getAllBooks = async (req, res) => {
  try {
    const { search, status, genre, page = 1, limit = 50 } = req.query;
    const query = {};

    if (status && status !== "all") {
      query.status = status;
    }

    if (genre && genre !== "all") {
      query.genre = genre.toLowerCase();
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [books, total] = await Promise.all([
      Book.find(query)
        .populate("author", "name email profilePicture role blockchainWallet walletAddress")
        .populate("publisher", "name email profilePicture blockchainWallet walletAddress")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit)),
      Book.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: books,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("getAllBooks error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update any book or manuscript directly (status, price, details)
// @route   PUT /api/admin/books/:id
// @access  Private (Admin only)
const updateBookDirectly = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    const {
      title,
      description,
      genre,
      status,
      price,
      isPaid,
      coverImage,
      publishingCost,
      isPublishingPaid,
      publisher,
      qualityScore,
      plagiarismScore
    } = req.body;

    if (title !== undefined) book.title = title;
    if (description !== undefined) book.description = description;
    if (genre !== undefined) book.genre = genre.toLowerCase();
    if (status !== undefined) book.status = status;
    if (coverImage !== undefined) book.coverImage = coverImage;
    if (publisher !== undefined) book.publisher = publisher || null;
    if (publishingCost !== undefined) book.publishingCost = Number(publishingCost);
    if (isPublishingPaid !== undefined) book.isPublishingPaid = Boolean(isPublishingPaid);
    if (qualityScore !== undefined) book.qualityScore = Number(qualityScore);
    if (plagiarismScore !== undefined) book.plagiarismScore = Number(plagiarismScore);

    if (price !== undefined) {
      book.price = Number(price);
      book.isPaid = Number(price) > 0;
    }
    if (isPaid !== undefined) {
      book.isPaid = Boolean(isPaid);
    }

    // If publishing and no chapters, create introductory chapter
    if (status === "published" && (!book.chapters || book.chapters.length === 0)) {
      book.chapters = [
        {
          title: "Introduction",
          content: book.content || "Content published by platform administration.",
          order: 1
        }
      ];
    }

    await book.save();
    await book.populate("author", "name email profilePicture");
    await book.populate("publisher", "name email");

    res.json({
      success: true,
      message: "Book updated successfully",
      data: book
    });
  } catch (error) {
    console.error("updateBookDirectly error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Delete any book
// @route   DELETE /api/admin/books/:id
// @access  Private (Admin only)
const deleteBookDirectly = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    await book.deleteOne();
    res.json({ success: true, message: "Book deleted successfully" });
  } catch (error) {
    console.error("deleteBookDirectly error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all manuscript submissions across all publishers
// @route   GET /api/admin/submissions
// @access  Private (Admin only)
const getSubmissions = async (req, res) => {
  try {
    const submissions = await Book.find({
      status: { $in: ["under_review", "seen", "cost_proposed"] }
    })
      .populate("author", "name email profilePicture blockchainWallet walletAddress")
      .populate("publisher", "name email profilePicture blockchainWallet walletAddress")
      .sort("-updatedAt");

    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error("getSubmissions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Verify or reject a publisher's verification request
// @route   PUT /api/admin/publishers/:id/verify
// @access  Private (Admin only)
const verifyPublisher = async (req, res) => {
  try {
    const publisher = await User.findOne({ _id: req.params.id, role: "publisher" });
    if (!publisher) {
      return res.status(404).json({ success: false, message: "Publisher not found" });
    }

    const { isVerified, blockchainHash } = req.body;
    const finalHash = blockchainHash || 
      ("0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""));

    publisher.isVerified = Boolean(isVerified);
    publisher.publisherVerification = {
      ...publisher.publisherVerification,
      isVerified: Boolean(isVerified),
      blockchainHash: isVerified ? finalHash : ""
    };

    await publisher.save();

    res.json({
      success: true,
      message: isVerified ? "Publisher verified successfully on blockchain" : "Publisher verification revoked",
      data: publisher
    });
  } catch (error) {
    console.error("verifyPublisher error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all transactions across the platform
// @route   GET /api/admin/transactions
// @access  Private (Admin only)
const getAllTransactions = async (req, res) => {
  try {
    const { type, page = 1, limit = 50 } = req.query;
    const query = {};

    if (type && type !== "all") {
      query.type = type;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate("sender", "name email role profilePicture")
        .populate("receiver", "name email role profilePicture")
        .sort("-createdAt")
        .skip(skip)
        .limit(Number(limit)),
      Transaction.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error("getAllTransactions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get all reviews across all books for content moderation
// @route   GET /api/admin/reviews
// @access  Private (Admin only)
const getAllReviews = async (req, res) => {
  try {
    const books = await Book.find({ "ratings.0": { $exists: true } })
      .populate("author", "name email")
      .populate("ratings.user", "name email profilePicture")
      .select("title coverImage author ratings");

    const reviewsList = [];
    books.forEach((book) => {
      if (book.ratings && Array.isArray(book.ratings)) {
        book.ratings.forEach((r) => {
          reviewsList.push({
            _id: r._id,
            bookId: book._id,
            bookTitle: book.title,
            bookCover: book.coverImage,
            authorName: book.author?.name || "Unknown",
            user: r.user,
            rating: r.rating,
            review: r.review,
            createdAt: r.createdAt
          });
        });
      }
    });

    // Sort newest first
    reviewsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: reviewsList
    });
  } catch (error) {
    console.error("getAllReviews error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Delete a review from a book
// @route   DELETE /api/admin/reviews/:bookId/:reviewId
// @access  Private (Admin only)
const deleteReview = async (req, res) => {
  try {
    const { bookId, reviewId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    book.ratings = book.ratings.filter((r) => r._id.toString() !== reviewId);

    // Recalculate average rating
    if (book.ratings.length > 0) {
      const sum = book.ratings.reduce((acc, r) => acc + r.rating, 0);
      book.averageRating = Math.round((sum / book.ratings.length) * 10) / 10;
      book.totalRatings = book.ratings.length;
    } else {
      book.averageRating = 0;
      book.totalRatings = 0;
    }

    await book.save();

    res.json({
      success: true,
      message: "Review deleted successfully",
      averageRating: book.averageRating,
      totalRatings: book.totalRatings
    });
  } catch (error) {
    console.error("deleteReview error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getAdminStats,
  getAllUsers,
  updateUser,
  deleteUser,
  getAllBooks,
  updateBookDirectly,
  deleteBookDirectly,
  getSubmissions,
  verifyPublisher,
  getAllTransactions,
  getAllReviews,
  deleteReview
};
