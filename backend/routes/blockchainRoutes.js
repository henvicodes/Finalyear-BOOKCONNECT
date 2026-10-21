const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Book = require("../models/Book");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { protect } = require("../middleware/authMiddleware");
const { checkPin, setPin, pinFailureResponse } = require("../utils/pin");
const { parseAmount, debit, credit, refund, resolveChainProof } = require("../utils/wallet");
// Module object (not destructured) so tests can replace the verifier.
const chainVerifier = require("../services/chainVerifier");

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

// 2b. POST /api/blockchain/onchain-register/:id -> Record a REAL on-chain
// registration transaction. The author's own MetaMask wallet signed and
// submitted it to the ManuscriptRegistry contract on Sepolia (see
// frontend/src/services/manuscriptRegistry.js). This route signs nothing: it
// LOOKS UP the transaction on the chain and only stores the hash if it really
// is a registration by the author's linked wallet in our registry contract.
router.post("/onchain-register/:id", protect, async (req, res) => {
  try {
    const { txHash } = req.body;
    if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return res.status(400).json({ success: false, message: "A valid transaction hash is required" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Book not found" });
    }
    if (book.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    // The same transaction can't be claimed by two different books.
    const claimedElsewhere = await Book.exists({ onChainTxHash: txHash, _id: { $ne: book._id } });
    if (claimedElsewhere) {
      return res.status(409).json({ success: false, message: "This transaction was already used for another book." });
    }

    const me = await User.findById(req.user._id).select("walletAddress");
    if (!me.walletAddress) {
      return res.status(400).json({ success: false, message: "Link your wallet before registering on-chain." });
    }

    const proof = await chainVerifier.verifyRegistration({ txHash, authorAddress: me.walletAddress });
    if (!proof.verified) {
      return res.status(422).json({
        success: false,
        message: `Could not verify this transaction on-chain. ${proof.reason || ""}`.trim(),
      });
    }

    book.onChainTxHash = txHash;
    book.onChainNetwork = "sepolia";
    await book.save();

    res.json({ success: true, message: "On-chain registration recorded", onChainTxHash: book.onChainTxHash });
  } catch (error) {
    console.error("On-chain register record error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 3. POST /api/blockchain/set-pin -> Set or change the 4-digit Security PIN.
// First time: just the new PIN. If a PIN already exists the caller must prove
// who they are with the current PIN OR the account password (the "forgot PIN"
// path) - otherwise anyone holding a stolen login token could overwrite it.
router.post("/set-pin", protect, async (req, res) => {
  try {
    const { pin, currentPin, password } = req.body;
    if (typeof pin !== "string" || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "PIN must be a 4-digit number" });
    }

    const user = await User.findById(req.user._id).select("+password +walletPin");
    if (user.walletPin) {
      if (currentPin) {
        const check = await checkPin(user._id, currentPin);
        if (!check.ok) return pinFailureResponse(res, check);
      } else if (password) {
        const okPassword = await user.comparePassword(String(password));
        if (!okPassword) {
          return res.status(401).json({ success: false, message: "Account password is incorrect." });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Enter your current PIN or your account password to change the PIN.",
        });
      }
    }

    await setPin(user._id, pin);
    res.json({ success: true, message: "Security PIN set successfully!" });
  } catch (error) {
    console.error("Set PIN error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 4. POST /api/blockchain/verify-pin -> Verify 4-digit Security PIN
router.post("/verify-pin", protect, async (req, res) => {
  try {
    const check = await checkPin(req.user._id, req.body.pin);
    if (!check.ok) return pinFailureResponse(res, check);
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
    const { receiverId, pin, note, txHash } = req.body;
    const senderId = req.user._id;

    const numAmount = parseAmount(req.body.amount);
    if (typeof receiverId !== "string" || !numAmount) {
      return res.status(400).json({ success: false, message: "Receiver and valid amount are required" });
    }
    if (receiverId === senderId.toString()) {
      return res.status(400).json({ success: false, message: "You cannot send money to yourself" });
    }

    const receiver = await User.findById(receiverId).select("name");
    if (!receiver) {
      return res.status(404).json({ success: false, message: "Recipient user not found" });
    }

    // A PIN is required for every transfer (set one first if you have none).
    const pinCheck = await checkPin(senderId, pin);
    if (!pinCheck.ok) return pinFailureResponse(res, pinCheck);

    const proof = await resolveChainProof(txHash, senderId, receiverId);
    if (proof.rejected) {
      return res.status(400).json({ success: false, message: proof.rejected });
    }

    // Debit is guarded (balance must still cover it); then credit; undo on failure.
    const sender = await debit(senderId, numAmount);
    if (!sender) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }
    try {
      await credit(receiverId, numAmount);
    } catch (err) {
      await refund(senderId, numAmount);
      console.error("Transfer credit error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    const tx = await Transaction.create({
      sender: senderId,
      receiver: receiverId,
      amount: numAmount,
      txHash: proof.onChain ? proof.txHash : undefined,
      onChain: !!proof.onChain,
      network: proof.onChain ? "sepolia" : undefined,
      type: "p2p_transfer",
      status: "completed",
      note: typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : "Web3 P2P Payment Transfer"
    });

    await tx.populate("sender", "name email role profilePicture");
    await tx.populate("receiver", "name email role profilePicture");

    res.status(201).json({
      success: true,
      message: `Successfully sent $${numAmount} to ${receiver.name}`,
      data: tx,
      senderWalletBalance: sender.walletBalance,
      ...(proof.warning ? { chainWarning: proof.warning } : {}),
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
