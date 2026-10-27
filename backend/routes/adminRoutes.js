const express = require("express");
const router = express.Router();
const {
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
  deleteReview,
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/authMiddleware");

// All admin routes require authentication and "admin" role
router.use(protect);
router.use(authorize("admin"));

// Dashboard Statistics
router.get("/stats", getAdminStats);

// User Management (Readers, Authors, Publishers, Admins)
router.get("/users", getAllUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// Books & Manuscripts Direct Management
router.get("/books", getAllBooks);
router.put("/books/:id", updateBookDirectly);
router.delete("/books/:id", deleteBookDirectly);

// Publisher Submissions & Verification
router.get("/submissions", getSubmissions);
router.put("/publishers/:id/verify", verifyPublisher);

// Platform Financial & Blockchain Ledger
router.get("/transactions", getAllTransactions);

// Content Moderation (Reviews & Ratings)
router.get("/reviews", getAllReviews);
router.delete("/reviews/:bookId/:reviewId", deleteReview);

module.exports = router;
