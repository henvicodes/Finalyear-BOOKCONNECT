const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { tokenize, computeIDF, tfidfVector, cosineSimilarity } = require("../utils/textSimilarity");
const { buildItemCF, IMPLICIT_PURCHASE_RATING } = require("../utils/itemCF");

// How much each signal counts when both are available.
const CONTENT_WEIGHT = 0.6;
const CF_WEIGHT = 0.4;

// Builds the item-based collaborative-filtering model from every reader's
// ratings plus purchases (a purchase with no rating counts as a "liked").
async function loadCollaborativeModel() {
  const [books, buyers] = await Promise.all([
    Book.find({ status: "published" }).select("title ratings.user ratings.rating").lean(),
    User.find({ "purchasedBooks.0": { $exists: true } }).select("purchasedBooks").lean(),
  ]);

  const titles = new Map(books.map((b) => [b._id.toString(), b.title]));
  const published = new Set(titles.keys());
  const seen = new Set();
  const interactions = [];

  for (const b of books) {
    for (const r of b.ratings || []) {
      if (!r.user || !r.rating) continue;
      seen.add(`${r.user}:${b._id}`);
      interactions.push({ user: r.user.toString(), item: b._id.toString(), rating: r.rating });
    }
  }
  for (const u of buyers) {
    for (const id of u.purchasedBooks) {
      const item = id.toString();
      if (!published.has(item) || seen.has(`${u._id}:${item}`)) continue;
      interactions.push({ user: u._id.toString(), item, rating: IMPLICIT_PURCHASE_RATING });
    }
  }
  return { cf: buildItemCF(interactions), titles };
}

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
    // Don't recommend what the reader already bought OR already rated.
    const alreadyRated = await Book.find({ "ratings.user": userId }).select("_id").lean();
    const haveIds = new Set([...purchasedIds, ...alreadyRated.map((b) => b._id.toString())]);
    const unpurchased = candidates.filter((b) => !haveIds.has(b._id.toString()));

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

    // Content signal: TF-IDF similarity between the reader's taste profile and each book.
    const contentScore = new Map();
    unpurchased.forEach((book, i) => {
      const score = cosineSimilarity(profileVector, candidateVectors[i]);
      if (score > 0) contentScore.set(book._id.toString(), score);
    });

    // Collaborative signal: "readers with similar ratings liked this" (needs a few
    // readers with 2+ rated/bought books; otherwise it adds nothing and is skipped).
    let cfScore = new Map();
    let cfBecause = new Map();
    let titles = new Map();
    try {
      const model = await loadCollaborativeModel();
      titles = model.titles;
      if (model.cf.hasSignal) {
        const ranked = model.cf.recommend(userId.toString(), unpurchased.map((b) => b._id.toString()), unpurchased.length);
        cfScore = new Map(ranked.map((r) => [r.item, r.score]));
        cfBecause = new Map(ranked.map((r) => [r.item, r.because]));
      }
    } catch (cfErr) {
      console.error("Collaborative filtering skipped:", cfErr.message);
    }

    const maxContent = Math.max(0, ...contentScore.values());
    const maxCf = Math.max(0, ...cfScore.values());
    const useCf = maxCf > 0;

    const scored = unpurchased
      .map((book) => {
        const id = book._id.toString();
        const c = maxContent > 0 ? (contentScore.get(id) || 0) / maxContent : 0;
        const f = useCf ? (cfScore.get(id) || 0) / maxCf : 0;
        const score = useCf ? CONTENT_WEIGHT * c + CF_WEIGHT * f : c;
        const becauseTitle = titles.get(cfBecause.get(id));
        const cfLed = useCf && f > 0 && becauseTitle; // the more specific explanation wins
        return {
          book,
          score,
          reason: cfLed
            ? `Readers who liked "${becauseTitle}" also liked this`
            : book.genre
              ? `Matches your interest in ${book.genre}`
              : "Similar to books you've read",
        };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => ({ ...r, score: Math.round(r.score * 1000) / 1000 }));

    // If content similarity found nothing (e.g. very sparse vocabulary
    // overlap), still fall back to trending rather than an empty page.
    if (scored.length === 0) {
      const trending = [...unpurchased]
        .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
        .slice(0, 12)
        .map((b) => ({ book: b, score: null, reason: "Trending on BookConnect" }));
      return res.json({ success: true, data: trending, personalized: false });
    }

    res.json({ success: true, data: scored, personalized: true, collaborative: useCf });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
