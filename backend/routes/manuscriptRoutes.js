const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const User = require("../models/User");
const Message = require("../models/Message");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/authMiddleware");

// 1. POST /api/manuscripts -> Create manuscript (author only)
router.post("/", protect, authorize("author"), async (req, res) => {
  try {
    const { title, content, genre, price, publisher, coverImage } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Title and Content are required" });
    }

    const manuscript = await Book.create({
      title,
      content,
      description: `Manuscript: ${title}`,
      genre: (genre || "fiction").toLowerCase(),
      price: price ? parseFloat(price) : 0,
      isPaid: price && parseFloat(price) > 0 ? true : false,
      author: req.user._id,
      publisher: publisher || null,
      coverImage: coverImage || `https://picsum.photos/seed/${encodeURIComponent(title)}/300/450`,
      status: "draft"
    });

    res.status(201).json({ success: true, id: manuscript._id, data: manuscript });
  } catch (error) {
    console.error("Create manuscript error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 2. GET /api/manuscripts -> Get author's manuscripts
router.get("/", protect, authorize("author"), async (req, res) => {
  try {
    const manuscripts = await Book.find({ author: req.user._id })
      .populate("publisher", "name email profilePicture blockchainWallet walletAddress")
      .sort("-createdAt");
    
    // map _id to id for frontend compatibility
    const mapped = manuscripts.map(m => {
      const obj = m.toObject();
      obj.id = obj._id;
      return obj;
    });

    res.json({ success: true, data: mapped });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 3. GET /api/manuscripts/:id -> Get manuscript details
router.get("/:id", protect, async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id)
      .populate("author", "name email bio profilePicture blockchainWallet walletAddress")
      .populate("publisher", "name email profilePicture blockchainWallet walletAddress");

    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    // Verify authority
    if (
      manuscript.author._id.toString() !== req.user._id.toString() &&
      manuscript.publisher?._id.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const obj = manuscript.toObject();
    obj.id = obj._id;

    res.json({ success: true, data: obj });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 4. PUT /api/manuscripts/:id -> Update manuscript details
router.put("/:id", protect, authorize("author"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { title, content, genre, price, status, publisher, coverImage } = req.body;

    if (title !== undefined) manuscript.title = title;
    if (content !== undefined) manuscript.content = content;
    if (genre !== undefined) manuscript.genre = genre.toLowerCase();
    if (price !== undefined) {
      manuscript.price = parseFloat(price);
      manuscript.isPaid = parseFloat(price) > 0;
    }
    if (status !== undefined) manuscript.status = status;
    if (publisher !== undefined) manuscript.publisher = publisher || null;
    if (coverImage !== undefined) manuscript.coverImage = coverImage;

    await manuscript.save();
    
    const obj = manuscript.toObject();
    obj.id = obj._id;

    res.json({ success: true, data: obj });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 5. DELETE /api/manuscripts/:id -> Delete manuscript
router.delete("/:id", protect, authorize("author"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await manuscript.deleteOne();
    res.json({ success: true, message: "Manuscript deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 6. POST /api/manuscripts/:id/submit -> Submit to selected publisher
router.post("/:id/submit", protect, authorize("author"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { publisherId } = req.body;
    if (!publisherId && !manuscript.publisher) {
      return res.status(400).json({ success: false, message: "Please select a publisher first" });
    }

    manuscript.status = "under_review";
    if (publisherId) manuscript.publisher = publisherId;

    await manuscript.save();

    // Create a system message in the chat thread
    await Message.create({
      sender: req.user._id,
      receiver: manuscript.publisher,
      book: manuscript._id,
      content: `Submitted manuscript "${manuscript.title}" for publishing review.`,
      isSystem: true
    });

    res.json({ success: true, message: "Submitted successfully", data: manuscript });
  } catch (error) {
    console.error("Submit error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 7. POST /api/manuscripts/:id/mark-seen -> Publisher marks manuscript as seen
router.post("/:id/mark-seen", protect, authorize("publisher"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.publisher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (manuscript.status === "under_review") {
      manuscript.status = "seen";
      await manuscript.save();

      // Create a system message
      await Message.create({
        sender: req.user._id,
        receiver: manuscript.author,
        book: manuscript._id,
        content: `Publisher has opened and read your manuscript.`,
        isSystem: true
      });
    }

    res.json({ success: true, data: manuscript });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 8. POST /api/manuscripts/:id/propose-cost -> Publisher proposes publishing cost
router.post("/:id/propose-cost", protect, authorize("publisher"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.publisher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { cost } = req.body;
    if (cost === undefined || isNaN(cost)) {
      return res.status(400).json({ success: false, message: "Valid cost is required" });
    }

    manuscript.publishingCost = parseFloat(cost);
    manuscript.status = "cost_proposed";
    await manuscript.save();

    // Create a system message alert in the chat thread
    await Message.create({
      sender: req.user._id,
      receiver: manuscript.author,
      book: manuscript._id,
      content: `PROPOSAL: Publisher has proposed a publishing fee of $${cost}.`,
      isSystem: true
    });

    res.json({ success: true, message: "Cost proposal sent successfully", data: manuscript });
  } catch (error) {
    console.error("Propose cost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 9. POST /api/manuscripts/:id/pay-cost -> Author pays publishing fee
router.post("/:id/pay-cost", protect, authorize("author"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (manuscript.status !== "cost_proposed") {
      return res.status(400).json({ success: false, message: "No cost proposed yet" });
    }

    const author = await User.findById(req.user._id);
    if ((author.walletBalance || 0) < manuscript.publishingCost) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance to pay publishing fee." });
    }

    manuscript.isPublishingPaid = true;
    manuscript.status = "published";
    
    // Add default chapter from content if none exist
    if (manuscript.chapters.length === 0) {
      manuscript.chapters.push({
        title: "Introduction",
        content: manuscript.content || "Empty manuscript content.",
        order: 1
      });
    }

    await manuscript.save();

    // Deduct from Author
    author.walletBalance = (author.walletBalance || 0) - manuscript.publishingCost;
    await author.save();

    // Award royalty fees to publisher
    const publisher = await User.findById(manuscript.publisher);
    if (publisher) {
      publisher.earnings = (publisher.earnings || 0) + manuscript.publishingCost;
      publisher.walletBalance = (publisher.walletBalance || 0) + manuscript.publishingCost;
      await publisher.save();
    }

    const { txHash } = req.body;
    // Log in Transaction Ledger
    await Transaction.create({
      sender: req.user._id,
      receiver: manuscript.publisher,
      amount: manuscript.publishingCost,
      txHash: txHash || undefined,
      type: "publishing_fee",
      status: "completed",
      note: `Paid publishing fee for "${manuscript.title}"`
    });

    // System message
    await Message.create({
      sender: req.user._id,
      receiver: manuscript.publisher,
      book: manuscript._id,
      content: `PAYMENT COMPLETE: Author has paid the publishing fee of $${manuscript.publishingCost}. Book is now published!`,
      isSystem: true
    });

    res.json({ success: true, message: "Payment processed successfully. Book published!", data: manuscript, walletBalance: author.walletBalance });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
