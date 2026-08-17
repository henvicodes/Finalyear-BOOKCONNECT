const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/authMiddleware");

// 1. POST /api/books/:id/purchase -> Unlock paid book
router.post("/:id/purchase", protect, authorize("reader"), async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    const user = await User.findById(req.user._id);
    if (user.purchasedBooks.includes(book._id)) {
      return res.status(400).json({ success: false, message: "Book already purchased" });
    }

    const price = book.isPaid ? (book.price || 0) : 0;
    if (price > 0 && (user.walletBalance || 0) < price) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance to purchase this book." });
    }

    user.purchasedBooks.push(book._id);
    user.walletBalance = (user.walletBalance || 0) - price;
    await user.save();

    // Send payment royalty to author
    const author = await User.findById(book.author);
    if (author) {
      author.earnings = (author.earnings || 0) + price;
      author.walletBalance = (author.walletBalance || 0) + price;
      await author.save();
    }

    const { txHash } = req.body;
    // Log in Transaction Ledger
    await Transaction.create({
      sender: req.user._id,
      receiver: book.author,
      amount: price,
      txHash: txHash || undefined,
      type: "book_purchase",
      status: "completed",
      note: `Purchased book "${book.title}"`
    });

    res.json({
      success: true,
      message: `Successfully purchased "${book.title}"! Unlocked all chapters.`,
      purchasedBooks: user.purchasedBooks,
      walletBalance: user.walletBalance
    });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. GET /api/books/user/library -> Get user unlocked/purchased library
router.get("/user/library", protect, authorize("reader"), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: "purchasedBooks",
      populate: {
        path: "author",
        select: "name profilePicture"
      }
    });

    res.json({ success: true, data: user.purchasedBooks });
  } catch (error) {
    console.error("Get library error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
