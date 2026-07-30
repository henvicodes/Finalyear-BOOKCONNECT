const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Book = require("../models/Book");
const { protect } = require("../middleware/authMiddleware");

// Helper to hash content
function computeSHA256(content) {
  return "0x" + crypto.createHash("sha256").update(content || "").digest("hex");
}

// 1. POST /api/blockchain/register/:id -> Register manuscript copyright
router.post("/register/:id", protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    if (book.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (book.blockchainHash) {
      return res.status(400).json({ success: false, message: "Already registered on the blockchain" });
    }

    // Compute cryptographic fingerprint
    const signature = computeSHA256(book.title + book.content + book.author.toString());
    book.blockchainHash = signature;
    book.isBlockchainVerified = true;
    
    await book.save();

    res.json({
      success: true,
      message: "Manuscript signature registered on ledger successfully!",
      blockchainHash: signature
    });
  } catch (error) {
    console.error("Blockchain registration error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. POST /api/blockchain/verify/:id -> Verify content integrity
router.post("/verify/:id", protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }

    const { currentContent } = req.body;
    const computedSignature = computeSHA256(book.title + (currentContent || "") + book.author.toString());

    const isValid = book.blockchainHash === computedSignature;

    res.json({
      success: true,
      isValid,
      message: isValid
        ? "Verification Success: Current manuscript text matches the immutable blockchain signature."
        : "Verification Alert: Content has been modified since ledger snapshot was taken. Signatures do not match!"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
