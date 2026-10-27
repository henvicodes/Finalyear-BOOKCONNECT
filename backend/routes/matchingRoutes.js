const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Book = require("../models/Book");
const { protect } = require("../middleware/authMiddleware");
const { tokenize, computeIDF, tfidfVector, cosineSimilarity } = require("../utils/textSimilarity");

// Build one text blob capturing a user's literary "profile": stated bio,
// stated interests, and the genres/tags of books they're actually
// connected to (published for authors, purchased/rated for readers).
async function buildProfileText(user) {
  const parts = [user.bio || "", (user.interests || []).join(" ")];

  if (user.role === "author" || user.role === "publisher") {
    const filter = user.role === "author" ? { author: user._id } : { publisher: user._id };
    const books = await Book.find(filter).select("genre tags title description").limit(50);
    for (const b of books) {
      parts.push(b.genre || "", (b.tags || []).join(" "));
    }
  } else {
    const purchased = await Book.find({ _id: { $in: user.purchasedBooks || [] } }).select("genre tags");
    for (const b of purchased) {
      parts.push(b.genre || "", (b.tags || []).join(" "));
    }
  }

  return parts.filter(Boolean).join(" ");
}

// GET /api/matching -> Profile-similarity matches for the logged-in user,
// biased toward complementary roles (readers <-> authors/publishers),
// via vector-based profile text + cosine similarity.
router.get("/", protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ success: false, message: "User not found" });

    // Who's worth matching against depends on the viewer's own role — per
    // the synopsis: "connect authors with relevant readers and publishers".
    const complementaryRoles =
      me.role === "reader" ? ["author", "publisher"] :
      me.role === "author" ? ["reader", "publisher"] :
      me.role === "publisher" ? ["author", "reader"] :
      ["reader", "author", "publisher"];

    const candidates = await User.find({
      _id: { $ne: me._id },
      role: { $in: complementaryRoles },
    }).select("name email role profilePicture bio interests purchasedBooks");

    if (candidates.length === 0) {
      return res.json({ success: true, data: [], personalized: false });
    }

    const myText = await buildProfileText(me);

    if (!myText.trim()) {
      // No bio, no interests, no reading/publishing history yet — nothing
      // to compute similarity against. Return candidates unranked rather
      // than a confident-looking but meaningless score.
      return res.json({
        success: true,
        data: candidates.slice(0, 12).map((c) => ({ user: c, score: null, reason: "New to BookConnect" })),
        personalized: false,
      });
    }

    const candidateTexts = await Promise.all(candidates.map(buildProfileText));
    const allDocs = [myText, ...candidateTexts];
    const tokenizedDocs = allDocs.map(tokenize);
    const idf = computeIDF(tokenizedDocs);
    const vectors = tokenizedDocs.map((tokens) => tfidfVector(tokens, idf));

    const myVector = vectors[0];
    const candidateVectors = vectors.slice(1);

    const scored = candidates
      .map((c, i) => ({
        user: c,
        score: cosineSimilarity(myVector, candidateVectors[i]),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((r) => ({
        user: r.user,
        score: Math.round(r.score * 1000) / 1000,
        reason: `Shares interest in ${r.user.interests?.[0] || "similar genres"}`,
      }));

    if (scored.length === 0) {
      return res.json({
        success: true,
        data: candidates.slice(0, 12).map((c) => ({ user: c, score: null, reason: "New to BookConnect" })),
        personalized: false,
      });
    }

    res.json({ success: true, data: scored, personalized: true });
  } catch (error) {
    console.error("Matching error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
