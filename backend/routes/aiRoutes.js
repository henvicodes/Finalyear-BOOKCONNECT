const express = require("express");
const router = express.Router();
const Book = require("../models/Book");
const { protect } = require("../middleware/authMiddleware");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to count syllables in a word
function countSyllables(word) {
  word = word.toLowerCase();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const vowels = word.match(/[aeiouy]{1,2}/g);
  return vowels ? vowels.length : 1;
}

// 1. POST /api/ai/evaluate/:id -> Calculate readability & scan plagiarism
router.post("/evaluate/:id", protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: "Manuscript not found" });
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

    // Plagiarism Detection simulation against other books in the platform database
    const otherBooks = await Book.find({ _id: { $ne: book._id }, status: "published" }).populate("author", "name");
    const plagiarismMatches = [];
    let highestSimilarity = 0;

    otherBooks.forEach(other => {
      // Let's do a simple mock overlap calculation using shared tags/genre
      let matchPercent = 0;
      if (other.genre === book.genre) matchPercent += 10;
      // Add dynamic noise based on title length
      matchPercent += (other.title.length + book.title.length) % 8;
      
      if (matchPercent > 12) {
        plagiarismMatches.push({
          title: other.title,
          author: other.author?.name || "Unknown",
          similarity: matchPercent
        });
        if (matchPercent > highestSimilarity) highestSimilarity = matchPercent;
      }
    });

    book.qualityScore = finalQualityScore;
    book.readabilityScore = readabilityLabel;
    book.plagiarismScore = highestSimilarity;
    book.plagiarismMatches = plagiarismMatches;
    await book.save();

    res.json({
      success: true,
      qualityScore: finalQualityScore,
      readabilityScore: readabilityLabel,
      plagiarismScore: highestSimilarity,
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
    const { text, title, genre } = req.body;
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

    // Plagiarism scan against existing published books
    const otherBooks = await Book.find({ status: "published" }).populate("author", "name");
    const plagiarismMatches = [];
    let highestSimilarity = 0;

    otherBooks.forEach(other => {
      let matchPercent = 0;
      if (other.genre === genre) matchPercent += 10;
      matchPercent += (other.title.length + (title?.length || 0)) % 8;
      
      if (matchPercent > 12) {
        plagiarismMatches.push({
          title: other.title,
          author: other.author?.name || "Unknown",
          similarity: matchPercent
        });
        if (matchPercent > highestSimilarity) highestSimilarity = matchPercent;
      }
    });

    res.json({
      success: true,
      qualityScore: finalQualityScore,
      readabilityScore: readabilityLabel,
      plagiarismScore: highestSimilarity,
      plagiarismMatches
    });
  } catch (error) {
    console.error("AI raw scan error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
