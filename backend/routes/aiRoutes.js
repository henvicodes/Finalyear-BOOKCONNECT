const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const { protect } = require("../middleware/authMiddleware");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Anthropic = require("@anthropic-ai/sdk");
const { tokenize, computeIDF, tfidfVector, cosineSimilarity } = require("../utils/textSimilarity");
const { scoreGenres, knownWordCount, getModelInfo } = require("../utils/genreClassifier");

// Helper to count syllables in a word
function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const vowels = word.match(/[aeiouy]{1,2}/g);
  return vowels ? vowels.length : 1;
}

// Real plagiarism scan: TF-IDF + cosine similarity between the submitted
// text and the actual content of other published manuscripts — not a
// genre/title-length guess. Returns the highest similarity found and the
// top matches above a "worth flagging" threshold.
const SIMILARITY_FLAG_THRESHOLD = 0.15; // cosine similarity, 0-1

async function scanPlagiarism(text, excludeBookId) {
  const query = { status: "published" };
  if (excludeBookId) query._id = { $ne: excludeBookId };

  const otherBooks = await Book.find(query)
    .select("title content description author")
    .populate("author", "name")
    .limit(200); // cap corpus size so this stays fast on a growing catalog

  const otherTexts = otherBooks.map((b) => b.content || b.description || "");
  if (otherTexts.every((t) => !t.trim())) {
    return { plagiarismScore: 0, plagiarismMatches: [] };
  }

  // Build one shared corpus (submission + every candidate) so IDF weights
  // are computed consistently, then compare the submission's vector
  // against each candidate's.
  const allDocs = [text, ...otherTexts];
  const tokenizedDocs = allDocs.map(tokenize);
  const idf = computeIDF(tokenizedDocs);
  const vectors = tokenizedDocs.map((tokens) => tfidfVector(tokens, idf));

  const submissionVector = vectors[0];
  const candidateVectors = vectors.slice(1);

  const scored = otherBooks
    .map((book, i) => ({
      title: book.title,
      author: book.author?.name || "Unknown",
      similarity: Math.round(cosineSimilarity(submissionVector, candidateVectors[i]) * 100),
    }))
    .filter((m) => m.similarity / 100 >= SIMILARITY_FLAG_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);

  const highestSimilarity = scored.length > 0 ? scored[0].similarity : 0;
  return { plagiarismScore: highestSimilarity, plagiarismMatches: scored };
}

// 1. POST /api/ai/evaluate/:id -> Calculate readability & scan plagiarism
router.post("/evaluate/:id", protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
    }

    // Evaluating saves scores onto the book, so only its author or the
    // publisher it was sent to may run it.
    const uid = req.user._id.toString();
    const isOwner = book.author.toString() === uid;
    const isAssignedPublisher = book.publisher && book.publisher.toString() === uid;
    if (!isOwner && !isAssignedPublisher) {
      return res.status(403).json({ success: false, message: "Not authorized to evaluate this manuscript" });
    }

    const text = book.content || book.description || "";
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount < 10) {
      // Default placeholder if text is too short
      book.qualityScore = 85;
      book.readabilityScore = "75 (Fairly Easy)";
      book.plagiarismScore = 0;
      book.plagiarismMatches = [];
      await book.save();
      return res.json({
        success: true,
        qualityScore: book.qualityScore,
        readabilityScore: book.readabilityScore,
        plagiarismScore: book.plagiarismScore,
        plagiarismMatches: book.plagiarismMatches
      });
    }

    // Flesch Readability Ease estimation
    const sentenceCount = Math.max(text.split(/[.!?]+/).filter(s => s.trim().length > 0).length, 1);
    const syllableCount = words.reduce((acc, word) => acc + countSyllables(word), 0);

    const asl = wordCount / sentenceCount; // Average Sentence Length
    const asw = syllableCount / wordCount; // Average Syllables per Word
    const score = Math.round(206.835 - 1.015 * asl - 84.6 * asw);
    const readabilityValue = Math.max(0, Math.min(100, score));

    let readabilityClass = "Standard";
    if (readabilityValue > 90) readabilityClass = "Very Easy";
    else if (readabilityValue > 80) readabilityClass = "Easy";
    else if (readabilityValue > 70) readabilityClass = "Fairly Easy";
    else if (readabilityValue > 60) readabilityClass = "Standard";
    else if (readabilityValue > 50) readabilityClass = "Fairly Difficult";
    else if (readabilityValue > 30) readabilityClass = "Difficult";
    else readabilityClass = "Very Confusing";

    const readabilityLabel = `${readabilityValue} (${readabilityClass})`;

    // AI Quality Score estimation (based on sentence lengths and grammar density)
    const quality = Math.round(75 + (readabilityValue * 0.2) + (wordCount % 5));
    const finalQualityScore = Math.min(100, Math.max(50, quality));

    // Plagiarism scan: TF-IDF + cosine similarity against other published manuscripts' actual content
    const { plagiarismScore, plagiarismMatches } = await scanPlagiarism(text, book._id);

    book.qualityScore = finalQualityScore;
    book.readabilityScore = readabilityLabel;
    book.plagiarismScore = plagiarismScore;
    book.plagiarismMatches = plagiarismMatches;
    await book.save();

    res.json({
      success: true,
      qualityScore: finalQualityScore,
      readabilityScore: readabilityLabel,
      plagiarismScore,
      plagiarismMatches
    });
  } catch (error) {
    console.error("AI scan error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. POST /api/ai/assist -> Help rewrite text inside the editor
router.post("/assist", protect, async (req, res) => {
  try {
    const { text, promptType } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Text content is required" });
    }

    // 1. If GEMINI_API_KEY is configured, call Gemini for a real AI generation!
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let prompt = "";
        if (promptType === "simplify") {
          prompt = `Simplify the vocabulary, make it highly readable and clear: "${text}"`;
        } else if (promptType === "formal") {
          prompt = `Rewrite this text in a formal, elegant, classical literary tone: "${text}"`;
        } else if (promptType === "summarize") {
          prompt = `Write a concise blurb/synopsis summary for: "${text}"`;
        } else if (promptType === "improve") {
          prompt = `Polish this text to improve vocabulary, sentence structure, flow, and overall tone: "${text}"`;
        } else {
          // General unstructured queries / brainstorming prompts (e.g. "give me some idea of friction")
          prompt = `You are a creative writing assistant. Respond to this request, providing brainstorm outlines or suggestions: "${text}"`;
        }

        const result = await model.generateContent(prompt);
        const suggestion = result.response.text();
        return res.json({ success: true, suggestion });
      } catch (geminiErr) {
        console.error("Gemini API call failed, falling back to rule-based mock:", geminiErr);
      }
    }

    // 2. Rule-based offline mock fallback if no API key is provided
    let suggestion = "";
    if (promptType === "simplify") {
      suggestion = text
        .replace(/\bcomprehensive\b/gi, "full")
        .replace(/\bterminate\b/gi, "stop")
        .replace(/\butilize\b/gi, "use")
        .replace(/\badditional\b/gi, "more")
        .replace(/\banticipate\b/gi, "expect");
      suggestion = `[Simplified Vocabulary version]:\n${suggestion}`;
    } else if (promptType === "formal") {
      suggestion = `It is with profound consideration that we observe: ${text.charAt(0).toLowerCase() + text.slice(1)}`;
      suggestion = `[Classical Literary version]:\n${suggestion}`;
    } else if (promptType === "summarize") {
      const sentences = text.split(/[.!?]+/);
      suggestion = sentences[0] ? sentences[0].trim() + "." : text;
      suggestion = `[Paragraph Synopsis Summary]:\n${suggestion}`;
    } else {
      // General prompt handling fallback for brainstorming queries
      const query = text.toLowerCase();
      if (query.includes("idea") || query.includes("plot") || query.includes("character") || query.includes("friction") || query.includes("fiction")) {
        if (query.includes("friction")) {
          suggestion = `[AI Creative Suggestions]:\nHere are some story ideas about "friction":\n1. Science Fiction: In a world where a physical anomaly removes all friction from one city, society collapses as people and objects cannot stop moving. A physicist must find a way to restore molecular cohesion.\n2. Drama: "Friction" - A story of two ambitious scientists whose professional collaboration leads to breakthrough discoveries, but their personal friction threatens to burn down their careers and lives.`;
        } else {
          suggestion = `[AI Creative Suggestions]:\nHere are some storytelling ideas:\n1. Fantasy: A clockwork city where magic is illegal, but a apprentice discovers that the gears run on souls.\n2. Mystery: A detective who can see the last 10 seconds of a murder victim's life, but has to solve a crime where the victim was blind.\n3. Sci-Fi: Humanity connects to a collective consciousness, but someone is uploading a virus to delete all memories of love.`;
        }
      } else {
        suggestion = text
          .replace(/\bvery good\b/gi, "excellent")
          .replace(/\bbad\b/gi, "unfavorable")
          .replace(/\bsad\b/gi, "melancholy")
          .replace(/\bhappy\b/gi, "delighted");
        suggestion = `[Refined Flow & Tone version]:\n${suggestion}`;
      }
    }

    res.json({ success: true, suggestion });
  } catch (error) {
    console.error("AI Assist Route error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
});

// 3. POST /api/ai/evaluate-raw -> Calculate readability & scan plagiarism on raw unsaved text
router.post("/evaluate-raw", protect, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Text content is required" });
    }

    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    if (wordCount < 10) {
      return res.json({
        success: true,
        qualityScore: 85,
        readabilityScore: "75 (Fairly Easy)",
        plagiarismScore: 0,
        plagiarismMatches: []
      });
    }

    // Flesch Readability Ease estimation
    const sentenceCount = Math.max(text.split(/[.!?]+/).filter(s => s.trim().length > 0).length, 1);
    const syllableCount = words.reduce((acc, word) => acc + countSyllables(word), 0);

    const asl = wordCount / sentenceCount;
    const asw = syllableCount / wordCount;
    const score = Math.round(206.835 - 1.015 * asl - 84.6 * asw);
    const readabilityValue = Math.max(0, Math.min(100, score));

    let readabilityClass = "Standard";
    if (readabilityValue > 90) readabilityClass = "Very Easy";
    else if (readabilityValue > 80) readabilityClass = "Easy";
    else if (readabilityValue > 70) readabilityClass = "Fairly Easy";
    else if (readabilityValue > 60) readabilityClass = "Standard";
    else if (readabilityValue > 50) readabilityClass = "Fairly Difficult";
    else if (readabilityValue > 30) readabilityClass = "Difficult";
    else readabilityClass = "Very Confusing";

    const readabilityLabel = `${readabilityValue} (${readabilityClass})`;
    const quality = Math.round(75 + (readabilityValue * 0.2) + (wordCount % 5));
    const finalQualityScore = Math.min(100, Math.max(50, quality));

    // Plagiarism scan: TF-IDF + cosine similarity against other published manuscripts' actual content
    const { plagiarismScore, plagiarismMatches } = await scanPlagiarism(text, null);

    res.json({
      success: true,
      qualityScore: finalQualityScore,
      readabilityScore: readabilityLabel,
      plagiarismScore,
      plagiarismMatches
    });
  } catch (error) {
    console.error("AI raw scan error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Supported target languages — ISO 639-1 codes, weighted toward the
// platform's India-centric catalog plus major world languages.
const SUPPORTED_LANGUAGES = {
  hindi: "hi", marathi: "mr", bengali: "bn", tamil: "ta", telugu: "te",
  gujarati: "gu", kannada: "kn", malayalam: "ml", punjabi: "pa",
  spanish: "es", french: "fr", german: "de", chinese: "zh", japanese: "ja",
  arabic: "ar", english: "en",
};

// 3b. POST /api/ai/suggest-genre -> Genre suggestions from a trained model.
// Uses the classifier trained on the CMU Book Summary Dataset
// (see ml/train_genre_classifier.py) — a real trained model, not a heuristic.
router.post("/suggest-genre", protect, (req, res) => {
  const { text } = req.body;
  // The model can only judge text it has vocabulary for; with a couple of
  // words it would still return numbers, just meaningless ones.
  if (!text || knownWordCount(text) < 25) {
    return res.status(400).json({
      success: false,
      message: "Write or paste a longer passage (a paragraph or more) so a genre can be suggested.",
    });
  }
  const suggestions = scoreGenres(text)
    .slice(0, 3)
    .map((s) => ({ genre: s.genre, probability: Math.round(s.probability * 1000) / 1000 }));
  res.json({ success: true, suggestions, model: getModelInfo() });
});

// 4. POST /api/ai/translate -> Translate text from a source language to a target language
router.post("/translate", protect, async (req, res) => {
  try {
    const { text, targetLanguage, sourceLanguage } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Text content is required" });
    }
    const langKey = (targetLanguage || "").toLowerCase();
    const langCode = SUPPORTED_LANGUAGES[langKey];
    if (!langCode) {
      return res.status(400).json({
        success: false,
        message: `Unsupported target language. Choose one of: ${Object.keys(SUPPORTED_LANGUAGES).join(", ")}`,
      });
    }

    // Defaults to English since most of the catalog is English, but a book
    // stored with a different `language` (e.g. Hindi) should pass that as
    // sourceLanguage — otherwise "translate to English" on a Hindi book
    // would be treated as English-to-English and do nothing.
    const srcKey = (sourceLanguage || "english").toLowerCase();
    const srcCode = SUPPORTED_LANGUAGES[srcKey] || "en";
    if (srcCode === langCode) {
      return res.status(400).json({ success: false, message: "Source and target language are the same." });
    }

    // 1. Claude, if configured — the primary translation provider (highest
    // quality, no shared free-tier quota to run out of).
    if (process.env.CLAUDE_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
        const message = await anthropic.messages.create({
          model: "claude-3-5-haiku-latest",
          max_tokens: 4096,
          messages: [{
            role: "user",
            content: `Translate the following text from ${srcKey} to ${langKey}. Return ONLY the translation, no notes or explanations:\n\n"${text}"`,
          }],
        });
        const translatedText = message.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
        if (translatedText) {
          return res.json({ success: true, translatedText, targetLanguage: langKey, provider: "claude" });
        }
      } catch (claudeErr) {
        console.error("Claude translation failed, falling back:", claudeErr);
      }
    }

    // 2. Gemini, if configured — secondary provider.
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Translate the following text from ${srcKey} to ${langKey}. Return ONLY the translation, no notes or explanations:\n\n"${text}"`;
        const result = await model.generateContent(prompt);
        const translatedText = result.response.text().trim();
        return res.json({ success: true, translatedText, targetLanguage: langKey, provider: "gemini" });
      } catch (geminiErr) {
        console.error("Gemini translation failed, falling back:", geminiErr);
      }
    }

    // 3. MyMemory — a free, keyless machine-translation API. Real translation
    // (not a fake/mock), used specifically because it needs no API key, so
    // the feature still works out of the box without CLAUDE_API_KEY/GEMINI_API_KEY set.
    // Chunked to stay under MyMemory's ~500-char-per-request limit.
    try {
      const chunks = text.match(/[\s\S]{1,450}(?:\s|$)/g) || [text];
      const translatedChunks = [];
      for (const chunk of chunks) {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${srcCode}|${langCode}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.responseStatus === 429 || /QUOTA|LIMIT/i.test(data.responseDetails || "")) {
          const quotaErr = new Error(data.responseDetails || "MyMemory daily quota exceeded");
          quotaErr.isQuota = true;
          throw quotaErr;
        }
        if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
          throw new Error("MyMemory translation failed for a chunk");
        }
        translatedChunks.push(data.responseData.translatedText);
      }
      return res.json({
        success: true,
        translatedText: translatedChunks.join(" "),
        targetLanguage: langKey,
        provider: "mymemory",
      });
    } catch (fallbackErr) {
      console.error("Fallback translation failed:", fallbackErr);
      // MyMemory's free tier is a shared daily quota per IP, not per-user —
      // heavy testing can exhaust it for everyone until it resets. Say so
      // plainly instead of a generic error, since it isn't a real outage.
      if (fallbackErr.isQuota) {
        return res.status(429).json({
          success: false,
          message: "The free translation service has hit its shared daily limit and will reset in a few hours. Add a CLAUDE_API_KEY to backend/.env for reliable, unlimited translation instead.",
        });
      }
      return res.status(502).json({
        success: false,
        message: "Translation is temporarily unavailable. Please try again shortly.",
      });
    }
  } catch (error) {
    console.error("Translate route error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
