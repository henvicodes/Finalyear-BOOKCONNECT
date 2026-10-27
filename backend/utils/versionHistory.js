const crypto = require("crypto");

// Same hashing approach as the blockchain "ledger" registration route, so a
// version snapshot's hash and a registered ownership hash are directly
// comparable — both are SHA-256 over the same title+content+author input.
// Falls back to description for books authored via the shorter-form book
// flow (no full manuscript `content` field), matching the same fallback
// used for plagiarism scanning and AI evaluation.
function computeContentHash(title, text, authorId) {
  return "0x" + crypto.createHash("sha256").update(`${title || ""}${text || ""}${authorId || ""}`).digest("hex");
}

/**
 * Appends a version snapshot to a book document's versionHistory (mutates
 * in place — caller is still responsible for book.save()). Skips the
 * snapshot if the content hash is unchanged from the most recent entry, so
 * saves that don't touch content don't spam the history.
 *
 * Includes chapter content in the hashed text, not just the single
 * `content`/`description` field — authors using the chapter-by-chapter
 * editor (ChapterManager) still get real, distinct snapshots per edit.
 */
function snapshotVersion(book, note = "Edited") {
  const chapterText = (book.chapters || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => `${c.title}${c.content}`)
    .join("");
  const text = (book.content || book.description || "") + chapterText;

  const hash = computeContentHash(book.title, text, book.author);
  const last = book.versionHistory[book.versionHistory.length - 1];
  if (last && last.contentHash === hash) return false;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  book.versionHistory.push({ contentHash: hash, wordCount, note, snapshotAt: new Date() });
  return true;
}

module.exports = { computeContentHash, snapshotVersion };
