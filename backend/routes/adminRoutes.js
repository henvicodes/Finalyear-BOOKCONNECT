const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const Book = require("../models/Book");
const Message = require("../models/Message");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const { protect, authorize } = require("../middleware/authMiddleware");

// Everything here is admin-only.
router.use(protect, authorize("admin"));

const ASSIGNABLE_ROLES = ["reader", "author", "publisher"];
const PLAGIARISM_FLAG = 20; // % similarity at or above which a manuscript is flagged
const escapeRegex = (s) => String(s).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (id) => mongoose.isValidObjectId(id);
const page = (req, def = 20) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || def, 1), 50);
  const skip = (Math.max(parseInt(req.query.page, 10) || 1, 1) - 1) * limit;
  return { limit, skip };
};
const reasonOf = (req, max = 300) => (typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, max) : "");

const audit = (req, action, targetType, targetId, targetLabel, details) =>
  AuditLog.create({ admin: req.user._id, action, targetType, targetId, targetLabel, details });

const notify = (req, receiver, content, book) =>
  Message.create({ sender: req.user._id, receiver, book, content, isSystem: true }).catch((e) =>
    console.error("Admin notify failed:", e.message)
  );

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const serverError = (res, label) => (error) => {
  console.error(`${label}:`, error);
  res.status(500).json({ success: false, message: "Server error" });
};

// ───────────────────────── 1. Overview ─────────────────────────
router.get("/overview", async (req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [byRole, suspended, newUsers, recentUsers, byStatus, money, onChain, health] = await Promise.all([
      User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      User.countDocuments({ isSuspended: true }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.find().sort("-createdAt").limit(6).select("name email role createdAt isSuspended"),
      Book.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Transaction.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: "$type", total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      Transaction.countDocuments({ onChain: true }),
      healthNumbers(),
    ]);

    const count = (rows, key) => Object.fromEntries(rows.map((r) => [r._id || "unknown", r[key]]));
    const moneyByType = Object.fromEntries(money.map((m) => [m._id, { total: m.total, count: m.count }]));
    res.json({
      success: true,
      data: {
        usersByRole: count(byRole, "count"),
        totalUsers: byRole.reduce((n, r) => n + r.count, 0),
        suspendedUsers: suspended,
        newUsersThisWeek: newUsers,
        recentUsers,
        booksByStatus: count(byStatus, "count"),
        totalBooks: byStatus.reduce((n, r) => n + r.count, 0),
        moneyByType,
        totalMoneyMoved: money.reduce((n, m) => n + m.total, 0),
        totalTransactions: money.reduce((n, m) => n + m.count, 0),
        onChainTransactions: onChain,
        health,
      },
    });
  } catch (e) {
    serverError(res, "Admin overview")(e);
  }
});

// Counts of things that need an admin's attention.
async function healthNumbers() {
  const [pendingVerifications, awaitingReview, openOffers, declined, failedPayments, flagged] = await Promise.all([
    User.countDocuments({ role: "publisher", "publisherVerification.status": "pending" }),
    Book.countDocuments({ status: { $in: ["under_review", "seen"] } }),
    Book.countDocuments({ status: "cost_proposed" }),
    Book.countDocuments({ status: "declined" }),
    Transaction.countDocuments({ status: "failed" }),
    Book.countDocuments({ plagiarismScore: { $gte: PLAGIARISM_FLAG }, status: { $ne: "archived" } }),
  ]);
  return { pendingVerifications, awaitingReview, openOffers, declined, failedPayments, flaggedManuscripts: flagged };
}

// ───────────────────────── 5. Platform health ─────────────────────────
router.get("/health", async (req, res) => {
  try {
    const stuckBefore = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [numbers, stuck, failed] = await Promise.all([
      healthNumbers(),
      Book.find({ status: { $in: ["under_review", "seen", "cost_proposed"] }, updatedAt: { $lt: stuckBefore } })
        .select("title status updatedAt author publisher")
        .populate("author", "name")
        .populate("publisher", "name")
        .sort("updatedAt")
        .limit(20),
      Transaction.find({ status: "failed" })
        .sort("-createdAt")
        .limit(20)
        .populate("sender", "name")
        .populate("receiver", "name"),
    ]);
    res.json({ success: true, data: { ...numbers, plagiarismThreshold: PLAGIARISM_FLAG, stuckSubmissions: stuck, failedTransactions: failed } });
  } catch (e) {
    serverError(res, "Admin health")(e);
  }
});

// ───────────────────────── 2. Users ─────────────────────────
router.get("/users", async (req, res) => {
  try {
    const { limit, skip } = page(req);
    const filter = {};
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const rx = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
      filter.$or = [{ name: rx }, { email: rx }];
    }
    if (["reader", "author", "publisher", "admin"].includes(req.query.role)) filter.role = req.query.role;
    if (req.query.status === "suspended") filter.isSuspended = true;
    if (req.query.status === "active") filter.isSuspended = { $ne: true };

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .select("name email role isSuspended suspendedReason createdAt walletBalance isEmailVerified publisherVerification.status publisherVerification.isVerified"),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, data: users, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    serverError(res, "Admin users")(e);
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) return fail(res, 400, "Invalid user id");
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, "User not found");
    const [booksAuthored, publishedBooks, transactions] = await Promise.all([
      Book.countDocuments({ author: user._id }),
      Book.countDocuments({ author: user._id, status: "published" }),
      Transaction.countDocuments({ $or: [{ sender: user._id }, { receiver: user._id }] }),
    ]);
    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
        isSuspended: user.isSuspended,
        suspendedReason: user.suspendedReason,
        suspendedAt: user.suspendedAt,
        walletBalance: user.walletBalance,
        earnings: user.earnings,
        walletAddress: user.walletAddress,
        purchasedCount: (user.purchasedBooks || []).length,
        createdAt: user.createdAt,
        publisherVerification: user.publisherVerification,
        booksAuthored,
        publishedBooks,
        transactions,
      },
    });
  } catch (e) {
    serverError(res, "Admin user detail")(e);
  }
});

// Admin accounts are never created or removed through the API (scripts/createAdmin.js
// is the only way in), and admins can't act on themselves or each other.
const loadTarget = async (req, res) => {
  if (!validId(req.params.id)) {
    fail(res, 400, "Invalid user id");
    return null;
  }
  const target = await User.findById(req.params.id);
  if (!target) {
    fail(res, 404, "User not found");
    return null;
  }
  if (target.role === "admin" || target._id.equals(req.user._id)) {
    fail(res, 403, "Admin accounts can't be changed here.");
    return null;
  }
  return target;
};

router.put("/users/:id/suspend", async (req, res) => {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    const reason = reasonOf(req);
    if (!reason) return fail(res, 400, "Give a reason for the suspension.");
    target.isSuspended = true;
    target.suspendedReason = reason;
    target.suspendedAt = new Date();
    await target.save();
    await audit(req, "user.suspend", "user", target._id, target.email, reason);
    res.json({ success: true, message: "User suspended" });
  } catch (e) {
    serverError(res, "Admin suspend")(e);
  }
});

router.put("/users/:id/unsuspend", async (req, res) => {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    target.isSuspended = false;
    target.suspendedReason = undefined;
    target.suspendedAt = undefined;
    await target.save();
    await audit(req, "user.unsuspend", "user", target._id, target.email, reasonOf(req));
    res.json({ success: true, message: "User reinstated" });
  } catch (e) {
    serverError(res, "Admin unsuspend")(e);
  }
});

router.put("/users/:id/role", async (req, res) => {
  try {
    const target = await loadTarget(req, res);
    if (!target) return;
    const { role } = req.body;
    if (!ASSIGNABLE_ROLES.includes(role)) return fail(res, 400, "Role must be reader, author or publisher.");
    if (role === target.role) return fail(res, 400, "The user already has that role.");

    const before = target.role;
    target.role = role;
    // Leaving the publisher role drops any verification: it belonged to that role.
    if (before === "publisher") target.publisherVerification = undefined;
    await target.save();
    await audit(req, "user.role", "user", target._id, target.email, `${before} -> ${role}. ${reasonOf(req)}`.trim());
    res.json({ success: true, message: `Role changed to ${role}` });
  } catch (e) {
    serverError(res, "Admin role")(e);
  }
});

// ───────────────── 2b. Publisher verification review ─────────────────
router.get("/publisher-verifications", async (req, res) => {
  try {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending";
    const rows = await User.find({ role: "publisher", "publisherVerification.status": status })
      .select("name email createdAt publisherVerification")
      .sort("publisherVerification.submittedAt");
    res.json({ success: true, data: rows });
  } catch (e) {
    serverError(res, "Admin verifications")(e);
  }
});

const loadPending = async (req, res) => {
  if (!validId(req.params.id)) {
    fail(res, 400, "Invalid user id");
    return null;
  }
  const user = await User.findOne({ _id: req.params.id, role: "publisher" });
  if (!user) {
    fail(res, 404, "Publisher not found");
    return null;
  }
  if (user.publisherVerification?.status !== "pending") {
    fail(res, 400, "This request is not waiting for review.");
    return null;
  }
  return user;
};

router.post("/publisher-verifications/:id/approve", async (req, res) => {
  try {
    const user = await loadPending(req, res);
    if (!user) return;
    const v = user.publisherVerification;
    const reviewedAt = new Date();
    // A fingerprint of exactly what was approved, by whom and when.
    const fingerprint =
      "0x" +
      crypto
        .createHash("sha256")
        .update(
          JSON.stringify({
            publisher: user._id.toString(),
            companyName: v.companyName,
            registrationType: v.registrationType,
            registrationNumber: v.registrationNumber,
            documentLink: v.documentLink,
            reviewedBy: req.user._id.toString(),
            reviewedAt: reviewedAt.toISOString(),
          })
        )
        .digest("hex");

    v.status = "approved";
    v.isVerified = true;
    v.reviewedAt = reviewedAt;
    v.reviewedBy = req.user._id;
    v.blockchainHash = fingerprint;
    v.rejectionReason = undefined;
    user.markModified("publisherVerification");
    await user.save();

    await audit(req, "publisher.approve", "publisher_verification", user._id, v.companyName || user.email, `${v.registrationType} ${v.registrationNumber}`);
    await notify(req, user._id, "VERIFIED: Your publisher details were checked and approved. Authors will now see a Verified badge on your profile.");
    res.json({ success: true, message: "Publisher verified", blockchainHash: fingerprint });
  } catch (e) {
    serverError(res, "Admin approve")(e);
  }
});

router.post("/publisher-verifications/:id/reject", async (req, res) => {
  try {
    const user = await loadPending(req, res);
    if (!user) return;
    const reason = reasonOf(req, 500);
    if (!reason) return fail(res, 400, "Tell the publisher why it was rejected.");
    const v = user.publisherVerification;
    v.status = "rejected";
    v.isVerified = false;
    v.reviewedAt = new Date();
    v.reviewedBy = req.user._id;
    v.rejectionReason = reason;
    user.markModified("publisherVerification");
    await user.save();

    await audit(req, "publisher.reject", "publisher_verification", user._id, v.companyName || user.email, reason);
    await notify(req, user._id, `NOT VERIFIED: Your publisher details could not be verified: ${reason} You can correct them and send again.`);
    res.json({ success: true, message: "Request rejected" });
  } catch (e) {
    serverError(res, "Admin reject")(e);
  }
});

// ───────────────────────── 3. Content moderation ─────────────────────────
router.get("/books", async (req, res) => {
  try {
    const { limit, skip } = page(req);
    const filter = {};
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.title = { $regex: escapeRegex(req.query.search.trim()), $options: "i" };
    }
    if (["draft", "under_review", "seen", "cost_proposed", "declined", "published", "archived"].includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.flagged === "true") filter.plagiarismScore = { $gte: PLAGIARISM_FLAG };

    const [books, total] = await Promise.all([
      Book.find(filter)
        .sort("-updatedAt")
        .skip(skip)
        .limit(limit)
        .select("title status genre isPaid price plagiarismScore plagiarismMatches qualityScore author publisher createdAt updatedAt")
        .populate("author", "name email")
        .populate("publisher", "name"),
      Book.countDocuments(filter),
    ]);
    res.json({ success: true, data: books, total, pages: Math.ceil(total / limit), plagiarismThreshold: PLAGIARISM_FLAG });
  } catch (e) {
    serverError(res, "Admin books")(e);
  }
});

// Take a book off the shelves without destroying it (readers who bought it keep their record).
router.post("/books/:id/unpublish", async (req, res) => {
  try {
    if (!validId(req.params.id)) return fail(res, 400, "Invalid book id");
    const reason = reasonOf(req, 500);
    if (!reason) return fail(res, 400, "Give a reason, the author will see it.");
    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, status: "published" },
      { $set: { status: "archived" } },
      { new: true }
    );
    if (!book) return fail(res, 404, "Only a published book can be unpublished.");
    await audit(req, "book.unpublish", "book", book._id, book.title, reason);
    await notify(req, book.author, `REMOVED: Your book "${book.title}" was unpublished by an administrator: ${reason}`, book._id);
    res.json({ success: true, message: "Book unpublished" });
  } catch (e) {
    serverError(res, "Admin unpublish")(e);
  }
});

// Permanent delete - refused if anyone bought the book (unpublish instead).
router.delete("/books/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) return fail(res, 400, "Invalid book id");
    const reason = reasonOf(req, 500);
    if (!reason) return fail(res, 400, "Give a reason for deleting.");
    const book = await Book.findById(req.params.id).select("title author");
    if (!book) return fail(res, 404, "Book not found");
    if (await User.exists({ purchasedBooks: book._id })) {
      return fail(res, 409, "Readers have bought this book, so it can't be deleted. Unpublish it instead.");
    }
    await Book.deleteOne({ _id: book._id });
    await audit(req, "book.delete", "book", book._id, book.title, reason);
    await notify(req, book.author, `DELETED: Your book "${book.title}" was deleted by an administrator: ${reason}`);
    res.json({ success: true, message: "Book deleted" });
  } catch (e) {
    serverError(res, "Admin delete book")(e);
  }
});

// ───────────────────────── 4. Transactions (read-only) ─────────────────────────
router.get("/transactions", async (req, res) => {
  try {
    const { limit, skip } = page(req);
    const filter = {};
    if (["publishing_fee", "book_purchase", "p2p_transfer"].includes(req.query.type)) filter.type = req.query.type;
    if (["completed", "pending", "failed"].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.onChain === "true") filter.onChain = true;
    if (req.query.onChain === "false") filter.onChain = false;

    const [rows, total, totals] = await Promise.all([
      Transaction.find(filter)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .populate("sender", "name email role")
        .populate("receiver", "name email role"),
      Transaction.countDocuments(filter),
      Transaction.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: "$amount" } } }]),
    ]);
    res.json({ success: true, data: rows, total, pages: Math.ceil(total / limit), totalAmount: totals[0]?.amount || 0 });
  } catch (e) {
    serverError(res, "Admin transactions")(e);
  }
});

// ───────────────────────── Audit log ─────────────────────────
router.get("/audit-log", async (req, res) => {
  try {
    const { limit, skip } = page(req, 25);
    const [rows, total] = await Promise.all([
      AuditLog.find().sort("-createdAt").skip(skip).limit(limit).populate("admin", "name"),
      AuditLog.countDocuments(),
    ]);
    res.json({ success: true, data: rows, total, pages: Math.ceil(total / limit) });
  } catch (e) {
    serverError(res, "Admin audit log")(e);
  }
});

module.exports = router;
