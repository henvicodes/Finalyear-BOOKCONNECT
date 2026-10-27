const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const User = require("../models/User");
const Message = require("../models/Message");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/authMiddleware");
const { snapshotVersion } = require("../utils/versionHistory");
const { checkPin, pinFailureResponse } = require("../utils/pin");

// Statuses an author may set by hand. The review-workflow ones (under_review,
// seen, cost_proposed, declined) are only ever set by the submit / publisher routes.
const AUTHOR_SETTABLE_STATUSES = ["draft", "published", "archived"];
const { debit, credit, refund, resolveChainProof, parseAmount } = require("../utils/wallet");

// 1. POST /api/manuscripts -> Create manuscript (author or admin)
router.post("/", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const { title, content, genre, price, publisher, coverImage } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: "Title and Content are required" });
    }

    const manuscript = new Book({
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
    snapshotVersion(manuscript, "Manuscript created");
    await manuscript.save();

    res.status(201).json({ success: true, id: manuscript._id, data: manuscript });
  } catch (error) {
    console.error("Create manuscript error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. GET /api/manuscripts -> Get author's manuscripts (or all if admin)
router.get("/", protect, authorize("author", "admin"), async (req, res) => {
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
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2b. GET /api/manuscripts/submissions -> Manuscripts authors have sent to
// THIS publisher (publisher only). This is the publisher's inbox. It returns
// summaries — the draft text itself is read by opening one manuscript
// (GET /api/manuscripts/:id below), which checks the publisher is the one the
// author actually sent it to. Must be registered before "/:id".
router.get("/submissions", protect, authorize("publisher"), async (req, res) => {
  try {
    const submissions = await Book.find({
      publisher: req.user._id,
      status: { $in: ["under_review", "seen", "cost_proposed", "published"] },
    })
      .select("-content -chapters.content")
      .populate("author", "name email profilePicture")
      .sort("-updatedAt");

    res.json({ success: true, data: submissions });
  } catch (error) {
    console.error("Submissions list error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 4. PUT /api/manuscripts/:id -> Update manuscript details
router.put("/:id", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const { title, content, genre, price, status, publisher, coverImage } = req.body;

    if (title !== undefined) manuscript.title = title;
    if (content !== undefined) manuscript.content = content;
    if (typeof genre === "string") manuscript.genre = genre.toLowerCase();
    if (price !== undefined) {
      manuscript.price = parseFloat(price);
      manuscript.isPaid = parseFloat(price) > 0;
    }
    if (status !== undefined) {
      if (status !== manuscript.status && !AUTHOR_SETTABLE_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "That status is set automatically by the review process." });
      }
      manuscript.status = status;
    }
    if (publisher !== undefined) {
      if (publisher) {
        const target = await User.findOne({ _id: publisher, role: "publisher" }).select("_id");
        if (!target) {
          return res.status(400).json({ success: false, message: "That publisher was not found." });
        }
      }
      manuscript.publisher = publisher || null;
    }
    if (coverImage !== undefined) manuscript.coverImage = coverImage;

    if (content !== undefined || title !== undefined) {
      snapshotVersion(manuscript, "Edited");
    }
    await manuscript.save();

    const obj = manuscript.toObject();
    obj.id = obj._id;

    res.json({ success: true, data: obj });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 5. DELETE /api/manuscripts/:id -> Delete manuscript
router.delete("/:id", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    await manuscript.deleteOne();
    res.json({ success: true, message: "Manuscript deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 6. POST /api/manuscripts/:id/submit -> Submit to selected publisher
router.post("/:id/submit", protect, authorize("author", "admin"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (manuscript.author.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (!["draft", "declined"].includes(manuscript.status)) {
      return res.status(400).json({ success: false, message: "This manuscript has already been submitted." });
    }

    const { publisherId } = req.body;
    if (!publisherId && !manuscript.publisher) {
      return res.status(400).json({ success: false, message: "Please select a publisher first" });
    }
    if (publisherId) {
      const target = await User.findOne({ _id: publisherId, role: "publisher" }).select("_id");
      if (!target) {
        return res.status(400).json({ success: false, message: "That publisher was not found." });
      }
    }

    manuscript.status = "under_review";
    manuscript.declineReason = undefined;
    manuscript.declinedBy = undefined;
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
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 7. POST /api/manuscripts/:id/mark-seen -> Publisher marks manuscript as seen
router.post("/:id/mark-seen", protect, authorize("publisher", "admin"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (!manuscript.publisher || manuscript.publisher.toString() !== req.user._id.toString()) {
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
router.post("/:id/propose-cost", protect, authorize("publisher", "admin"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    if (!manuscript.publisher || manuscript.publisher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    if (!["under_review", "seen", "cost_proposed"].includes(manuscript.status)) {
      return res.status(400).json({ success: false, message: "An offer can only be made on a manuscript that is waiting for review." });
    }

    const cost = parseAmount(req.body.cost);
    if (cost === null) {
      return res.status(400).json({ success: false, message: "Valid cost is required" });
    }

    manuscript.publishingCost = cost;
    manuscript.status = "cost_proposed";
    await manuscript.save();

    // Create a system message alert in the chat thread
    await Message.create({
      sender: req.user._id,
      receiver: manuscript.author,
      book: manuscript._id,
      content: `PROPOSAL: Publisher has proposed a publishing fee of $${manuscript.publishingCost}.`,
      isSystem: true
    });

    res.json({ success: true, message: "Cost proposal sent successfully", data: manuscript });
  } catch (error) {
    console.error("Propose cost error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 8b. POST /api/manuscripts/:id/decline -> Publisher turns a submission down
router.post("/:id/decline", protect, authorize("publisher"), async (req, res) => {
  try {
    const manuscript = await Book.findById(req.params.id);
    if (!manuscript) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }
    if (!manuscript.publisher || manuscript.publisher.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    if (!["under_review", "seen", "cost_proposed"].includes(manuscript.status)) {
      return res.status(400).json({ success: false, message: "Only a manuscript waiting for review (or with an open offer) can be declined." });
    }

    const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 500) : "";

    // Claim the decline atomically so it can't race with the author paying an offer.
    const declined = await Book.findOneAndUpdate(
      { _id: manuscript._id, publisher: req.user._id, status: { $in: ["under_review", "seen", "cost_proposed"] } },
      {
        $set: { status: "declined", declineReason: reason, declinedBy: req.user._id },
        $unset: { publisher: "", publishingCost: "" },
      },
      { new: true }
    );
    if (!declined) {
      return res.status(409).json({ success: false, message: "This manuscript just changed state. Please refresh." });
    }

    await Message.create({
      sender: req.user._id,
      receiver: manuscript.author,
      book: manuscript._id,
      content: `DECLINED: The publisher has declined "${manuscript.title}"${reason ? `: ${reason}` : "."} You can edit it and send it to another publisher.`,
      isSystem: true
    });

    res.json({ success: true, message: "Submission declined", data: { _id: declined._id, status: declined.status } });
  } catch (error) {
    console.error("Decline error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 9. POST /api/manuscripts/:id/pay-cost -> Author pays publishing fee
router.post("/:id/pay-cost", protect, authorize("author", "admin"), async (req, res) => {
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

    const cost = manuscript.publishingCost;
    if (!manuscript.publisher || !Number.isFinite(cost) || cost < 0) {
      return res.status(400).json({ success: false, message: "There is no valid offer to pay." });
    }

    // Paying the fee spends money, so it needs the wallet PIN.
    const pinCheck = await checkPin(req.user._id, req.body.pin);
    if (!pinCheck.ok) return pinFailureResponse(res, pinCheck);

    // 1) Take the fee from the author (fails if the balance is too low right now).
    const author = await debit(req.user._id, cost);
    if (!author) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance to pay publishing fee." });
    }

    // 2) Claim the manuscript: only one request can flip cost_proposed -> published,
    //    so pressing "Pay" twice can never charge twice.
    const claimed = await Book.findOneAndUpdate(
      { _id: manuscript._id, author: req.user._id, status: "cost_proposed", publishingCost: cost },
      { $set: { status: "published", isPublishingPaid: true } },
      { new: true }
    );
    if (!claimed) {
      await refund(req.user._id, cost);
      return res.status(409).json({ success: false, message: "This offer was already paid or changed. Please refresh." });
    }

    // 3) Pay the publisher. If that fails, undo everything above.
    try {
      await credit(manuscript.publisher, cost);
    } catch (err) {
      await refund(req.user._id, cost);
      await Book.updateOne({ _id: claimed._id }, { $set: { status: "cost_proposed", isPublishingPaid: false } });
      console.error("Publishing fee credit error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }

    // Add default chapter from content if none exist
    if (claimed.chapters.length === 0) {
      claimed.chapters.push({
        title: "Introduction",
        content: claimed.content || "Empty manuscript content.",
        order: 1
      });
    }
    snapshotVersion(claimed, "Published");
    await claimed.save();

    const proof = await resolveChainProof(req.body.txHash, req.user._id, manuscript.publisher);
    if (proof.rejected) console.warn("Publishing-fee tx hash rejected:", proof.rejected);

    // Log in Transaction Ledger
    await Transaction.create({
      sender: req.user._id,
      receiver: manuscript.publisher,
      amount: cost,
      txHash: proof.onChain ? proof.txHash : undefined,
      onChain: !!proof.onChain,
      network: proof.onChain ? "sepolia" : undefined,
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

    res.json({
      success: true,
      message: "Payment processed successfully. Book published!",
      data: claimed,
      walletBalance: author.walletBalance,
      ...(proof.warning ? { chainWarning: proof.warning } : {}),
    });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
