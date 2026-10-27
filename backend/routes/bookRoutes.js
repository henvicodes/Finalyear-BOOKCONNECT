const express = require("express");
const router = express.Router();
const {
  getBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  publishBook,
  rateBook,
  getMyBooks,
  getBookChapters,
  getChapterContent,
  addChapter,
  updateChapter,
  deleteChapter,
} = require("../controllers/bookController.js");
const { protect, authorize, optionalAuth } = require("../middleware/authMiddleware");

// Public
router.get("/", getBooks);
// optionalAuth: lets getBookById recognize the book's own author (who
// still needs full chapter content to edit it) while staying open to
// anonymous browsing for everyone else.
router.get("/:id", optionalAuth, getBookById);
router.get("/:id/chapters", getBookChapters);
// optionalAuth: chapter text itself is gated by purchase for paid books
// (see getChapterContent), but the route stays open to anonymous readers
// so free books still work without forcing a login wall.
router.get("/:id/chapters/:chapterId", optionalAuth, getChapterContent);

// Author only
router.get("/user/my-books", protect, authorize("author"), getMyBooks);
router.post("/", protect, authorize("author"), createBook);
router.put("/:id", protect, authorize("author"), updateBook);
router.delete("/:id", protect, authorize("author", "admin"), deleteBook);
router.post("/:id/publish", protect, authorize("author"), publishBook);

// Chapter management (author only)
router.post("/:id/chapters", protect, authorize("author"), addChapter);
router.put(
  "/:id/chapters/:chapterId",
  protect,
  authorize("author"),
  updateChapter,
);
router.delete(
  "/:id/chapters/:chapterId",
  protect,
  authorize("author"),
  deleteChapter,
);

// Any authenticated user
router.post("/:id/rate", protect, rateBook);

module.exports = router;
