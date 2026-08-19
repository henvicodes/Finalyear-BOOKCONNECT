const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { tokenize, computeIDF, tfidfVector, cosineSimilarity } = require("../utils/textSimilarity");

// Flatten a book document into one text blob capturing its topical content —
// used both to build the reader's taste profile and to score candidates.
const bookText = (book) =>
  [book.title, book.description, book.genre, ...(book.tags || [])]
    .filter(Boolean)
    .join(" ");

// 1. GET /api/recommendations -> Personalized book recommendations for the
//    logged-in reader, via content-based filtering (TF-IDF + cosine similarity).
router.get("/", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const LIST_FIELDS = "title description genre tags coverImage price isPaid averageRating totalRatings totalReads author";

    const [user, candidates] = await Promise.all([
      User.findById(userId).populate("purchasedBooks", "title description genre tags"),
      Book.find({ status: "published", author: { $ne: userId } })
        .select(LIST_FIELDS)
        .populate("author", "name profilePicture")
        .lean(),
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const purchasedIds = new Set((user.purchasedBooks || []).map((b) => b._id.toString()));
    const unpurchased = candidates.filter((b) => !purchasedIds.has(b._id.toString()));

    // Books the reader has rated highly (4-5 stars) are a strong taste signal
    // too, even if they didn't purchase them (e.g. free books).
    const ratedBooks = await Book.find({
      status: "published",
      "ratings.user": userId,
      "ratings.rating": { $gte: 4 },
    }).select("title description genre tags");

    // Build the reader's taste profile: purchase history + high ratings +
    // explicit stated interests, all folded into one text blob.
    const profileParts = [
      ...(user.purchasedBooks || []).map(bookText),
      ...ratedBooks.map(bookText),
      (user.interests || []).join(" "),
    ].filter(Boolean);

    const hasProfile = profileParts.length > 0;

    if (!hasProfile || unpurchased.length === 0) {
      // Cold start (no purchase/rating/interest history yet) or nothing left
      // to recommend — fall back to platform-wide trending books so the
      // page is never empty for a brand-new reader.
      const trending = [...unpurchased]
        .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0) || (b.totalRatings || 0) - (a.totalRatings || 0))
        .slice(0, 12)
        .map((b) => ({ book: b, score: null, reason: "Trending on BookConnect" }));

      return res.json({ success: true, data: trending, personalized: false });
    }

    const profileText = profileParts.join(" ");
    const candidateTexts = unpurchased.map(bookText);

    // Build one shared corpus (reader profile + every candidate) so IDF
    // weights are computed consistently across all of them.
    const allDocs = [profileText, ...candidateTexts];
    const tokenizedDocs = allDocs.map(tokenize);
    const idf = computeIDF(tokenizedDocs);
    const vectors = tokenizedDocs.map((tokens) => tfidfVector(tokens, idf));

    const profileVector = vectors[0];
    const candidateVectors = vectors.slice(1);

    const scored = unpurchased
      .map((book, i) => ({
        book,
        score: cosineSimilarity(profileVector, candidateVectors[i]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => ({
        book: r.book,
        score: Math.round(r.score * 1000) / 1000,
        reason: r.book.genre
          ? `Matches your interest in ${r.book.genre}`
          : "Similar to books you've read",
      }));

    // If content similarity found nothing (e.g. very sparse vocabulary
    // overlap), still fall back to trending rather than an empty page.
    if (scored.length === 0) {
      const trending = [...unpurchased]
        .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
        .slice(0, 12)
        .map((b) => ({ book: b, score: null, reason: "Trending on BookConnect" }));
      return res.json({ success: true, data: trending, personalized: false });
    }

    res.json({ success: true, data: scored, personalized: true });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
