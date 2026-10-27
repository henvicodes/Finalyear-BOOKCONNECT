const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/authMiddleware");
const { checkPin, pinFailureResponse } = require("../utils/pin");
const { debit, credit, refund, resolveChainProof } = require("../utils/wallet");

// 1. POST /api/books/:id/purchase -> Unlock paid book
router.post("/:id/purchase", protect, authorize("reader", "admin"), async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book || book.status !== "published") {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    const price = book.isPaid ? (book.price || 0) : 0;

    // Spending money needs the wallet PIN (free books don't).
    if (price > 0) {
      const pinCheck = await checkPin(req.user._id, req.body.pin);
      if (!pinCheck.ok) return pinFailureResponse(res, pinCheck);
    }

    // One atomic step: only succeeds if the book isn't owned yet AND the balance
    // still covers the price, so double-clicks / parallel requests can't double-spend.
    const notOwned = { purchasedBooks: { $ne: book._id } };
    const push = { $push: { purchasedBooks: book._id } };
    const buyer = price > 0
      ? await debit(req.user._id, price, notOwned, push)
      : await User.findOneAndUpdate({ _id: req.user._id, ...notOwned }, push, { new: true });

    if (!buyer) {
      const current = await User.findById(req.user._id).select("purchasedBooks");
      if (current.purchasedBooks.some((id) => id.equals(book._id))) {
        return res.status(400).json({ success: false, message: "Book already purchased" });
      }
      return res.status(400).json({ success: false, message: "Insufficient wallet balance to purchase this book." });
    }

    // Pay the author. If that fails, undo the buyer's side so no money vanishes.
    try {
      await credit(book.author, price);
    } catch (err) {
      await refund(req.user._id, price, { $pull: { purchasedBooks: book._id } });
      console.error("Purchase credit error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const proof = await resolveChainProof(req.body.txHash, req.user._id, book.author);
    if (proof.rejected) {
      // Money already moved in-app; just don't attach the bad hash.
      console.warn("Purchase tx hash rejected:", proof.rejected);
    }
    await Transaction.create({
      sender: req.user._id,
      receiver: book.author,
      amount: price,
      txHash: proof.onChain ? proof.txHash : undefined,
      onChain: !!proof.onChain,
      network: proof.onChain ? "sepolia" : undefined,
      type: "book_purchase",
      status: "completed",
      note: `Purchased book "${book.title}"`
    });

    res.json({
      success: true,
      message: `Successfully purchased "${book.title}"! Unlocked all chapters.`,
      purchasedBooks: buyer.purchasedBooks,
      walletBalance: buyer.walletBalance,
      ...(proof.warning ? { chainWarning: proof.warning } : {}),
    });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. GET /api/books/user/library -> Get user unlocked/purchased library
router.get("/user/library", protect, authorize("reader", "admin"), async (req, res) => {
  try {
    if (req.user.role === "admin") {
      const allBooks = await Book.find({ status: "published" }).populate("author", "name profilePicture");
      return res.json({ success: true, data: allBooks });
    }
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
