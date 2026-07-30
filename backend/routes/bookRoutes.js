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
const { protect, authorize } = require("../middleware/authMiddleware");

// Public
router.get("/", getBooks);
router.get("/:id", getBookById);
router.get("/:id/chapters", getBookChapters);
router.get("/:id/chapters/:chapterId", getChapterContent);

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
