const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Book = require("../models/Book");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
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

// 3. POST /api/blockchain/set-pin -> Set user 4-digit Security PIN
router.post("/set-pin", protect, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "PIN must be a 4-digit number" });
    }

    const user = await User.findById(req.user._id);
    user.walletPin = pin;
    await user.save();

    res.json({ success: true, message: "Security PIN set successfully!" });
  } catch (error) {
    console.error("Set PIN error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 4. POST /api/blockchain/verify-pin -> Verify 4-digit Security PIN
router.post("/verify-pin", protect, async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await User.findById(req.user._id);

    if (!user.walletPin) {
      return res.status(400).json({ success: false, hasPin: false, message: "No PIN set yet. Please set your 4-digit Security PIN." });
    }

    const isMatch = user.walletPin === pin;
    if (!isMatch) {
      return res.status(400).json({ success: false, hasPin: true, message: "Incorrect PIN code. Please try again." });
    }

    res.json({ success: true, hasPin: true, verified: true, message: "PIN verified!" });
  } catch (error) {
    console.error("Verify PIN error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 5. GET /api/blockchain/transactions -> Get transaction history ledger
router.get("/transactions", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const txs = await Transaction.find({
      $or: [{ sender: userId }, { receiver: userId }]
    })
      .populate("sender", "name email role profilePicture")
      .populate("receiver", "name email role profilePicture")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: txs });
  } catch (error) {
    console.error("Fetch transactions error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 6. POST /api/blockchain/transfer -> P2P Web3 Payment Transfer
router.post("/transfer", protect, async (req, res) => {
  try {
    const { receiverId, amount, pin, note, txHash } = req.body;
    const senderId = req.user._id;

    if (!receiverId || !amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Receiver and valid amount are required" });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({ success: false, message: "Recipient user not found" });
    }

    // Verify PIN
    if (sender.walletPin && sender.walletPin !== pin) {
      return res.status(400).json({ success: false, message: "Incorrect 4-digit Security PIN" });
    }

    // Check sender balance
    if ((sender.walletBalance || 0) < parseFloat(amount)) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    const numAmount = parseFloat(amount);

    // Update balances
    sender.walletBalance = (sender.walletBalance || 0) - numAmount;
    receiver.walletBalance = (receiver.walletBalance || 0) + numAmount;
    receiver.earnings = (receiver.earnings || 0) + numAmount;

    await sender.save();
    await receiver.save();

    // Create Transaction Record
    const tx = await Transaction.create({
      sender: senderId,
      receiver: receiverId,
      amount: numAmount,
      txHash: txHash || undefined,
      type: "p2p_transfer",
      status: "completed",
      note: note || "Web3 P2P Payment Transfer"
    });

    await tx.populate("sender", "name email role profilePicture");
    await tx.populate("receiver", "name email role profilePicture");

    res.status(201).json({
      success: true,
      message: `Successfully sent $${numAmount} to ${receiver.name}`,
      data: tx,
      senderWalletBalance: sender.walletBalance
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
