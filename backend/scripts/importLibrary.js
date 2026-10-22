// Fills BookConnect with real books, all owned by one "BookConnect Library" account
// (real authors have no accounts here, so each book credits its original author by
// name in `originalAuthor` and says where the text came from in `source`).
//
//   node scripts/downloadLibrary.js          # once: fetch the public-domain texts
//   node scripts/importLibrary.js --dry-run  # show what would happen
//   node scripts/importLibrary.js --refresh  # also re-write books already imported (keeps ids, ratings, purchases)
//   node scripts/importLibrary.js            # do it
//   node scripts/importLibrary.js --only=gutenberg|catalogue
//
// 1. Public-domain classics (Project Gutenberg): full text, split into chapters.
// 2. A catalogue of well-known books as "summary editions": a plot summary only
//    (Wikipedia text, CC BY-SA 3.0), never the book itself, because those books are
//    still in copyright. Genres come from BookConnect's own trained classifier.
//
// Safe to re-run: books that already exist (same title + original author) are skipped.
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const Book = require("../models/Book");
const { parseGutenberg } = require("../utils/gutenberg");
const { scoreGenres } = require("../utils/genreClassifier");
const { snapshotVersion } = require("../utils/versionHistory");

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const REFRESH = args.includes("--refresh");
const only = (args.find((a) => a.startsWith("--only=")) || "").split("=")[1];

const GENRES = new Set(Book.schema.path("genre").enumValues);
const LIBRARY_EMAIL = "library@example.com";
const SMALL = new Set(["a", "an", "the", "of", "and", "in", "on", "to", "or", "for", "at", "by", "with"]);

// "The call of the wild" -> "The Call of the Wild" (only when the source title isn't already capitalised)
function tidyTitle(raw) {
  let t = raw.split(/;|:\s/)[0].replace(/,\s*Complete$/i, "").replace(/\s+/g, " ").trim();
  const needsCase = t.split(" ").some((w, i) => i > 0 && w.length > 3 && /^[a-z]/.test(w));
  if (needsCase) {
    t = t.split(" ").map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(" ");
  }
  return t.slice(0, 200);
}

// the classifier's top label if it is confident enough, otherwise plain "fiction"
function classify(text) {
  const [top] = scoreGenres(text);
  return top && top.probability >= 0.5 && GENRES.has(top.genre) ? top.genre : "fiction";
}

async function libraryUser() {
  let user = await User.findOne({ email: LIBRARY_EMAIL });
  if (user || DRY) return user;
  // nobody knows this password: the account owns books but cannot be logged into
  const password = crypto.randomBytes(32).toString("hex");
  user = await User.create({
    name: "BookConnect Library",
    email: LIBRARY_EMAIL,
    password: await bcrypt.hash(password, 10),
    role: "author",
    isEmailVerified: true,
    bio: "Public-domain classics and summary editions curated by BookConnect.",
  });
  return user;
}

async function coverOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok && (res.headers.get("content-type") || "").startsWith("image/");
  } catch {
    return false;
  }
}

const exists = (authorId, title, originalAuthor) => Book.exists({ author: authorId, title, originalAuthor });

async function create(doc, authorId, stats, label) {
  if (authorId && (await exists(authorId, doc.title, doc.originalAuthor))) {
    if (REFRESH && !DRY) {
      // update in place so the book keeps its id, ratings and any purchases
      await Book.updateOne({ author: authorId, title: doc.title, originalAuthor: doc.originalAuthor }, { $set: doc });
      stats.refreshed = (stats.refreshed || 0) + 1;
      if (label) console.log(`  ~ ${label}`);
    } else {
      stats.skipped++;
    }
    return;
  }
  if (DRY) {
    stats.created++;
    return;
  }
  const book = new Book({ ...doc, author: authorId, status: "published", language: "english" });
  snapshotVersion(book, "Imported");
  await book.save();
  stats.created++;
  if (label) console.log(`  + ${label}`);
}

async function importGutenberg(authorId) {
  const catalog = require("../data/libraryCatalog.json");
  const dir = path.join(__dirname, "..", "data", "gutenberg");
  const stats = { created: 0, skipped: 0, failed: 0, chapters: 0, genres: {} };

  for (const entry of catalog) {
    const file = path.join(dir, `pg${entry.id}.txt`);
    if (!fs.existsSync(file)) {
      console.log(`  ! ${entry.match}: file missing (run scripts/downloadLibrary.js)`);
      stats.failed++;
      continue;
    }
    const parsed = parseGutenberg(fs.readFileSync(file, "utf8"));
    if (!parsed.title.toLowerCase().includes(entry.match)) {
      console.log(`  ! pg${entry.id} is "${parsed.title}", expected "${entry.match}" - skipped`);
      stats.failed++;
      continue;
    }
    const title = tidyTitle(parsed.title);
    const cover = `https://www.gutenberg.org/cache/epub/${entry.id}/pg${entry.id}.cover.medium.jpg`;
    const doc = {
      title,
      originalAuthor: parsed.author,
      description: entry.description,
      genre: GENRES.has(entry.genre) ? entry.genre : "fiction",
      tags: entry.tags || [],
      isPaid: entry.price > 0,
      price: entry.price || 0,
      coverImage: !DRY && (await coverOk(cover)) ? cover : "default-cover.jpg",
      chapters: parsed.chapters.map((c, i) => ({ title: c.title, content: c.content, order: i + 1 })),
      source: {
        name: "Project Gutenberg",
        url: `https://www.gutenberg.org/ebooks/${entry.id}`,
        license: "Public domain",
        note: entry.year ? `First published ${entry.year < 0 ? `${-entry.year} BCE` : entry.year}.` : undefined,
      },
    };
    stats.chapters += doc.chapters.length;
    stats.genres[doc.genre] = (stats.genres[doc.genre] || 0) + 1;
    await create(doc, authorId, stats, `${title} (${parsed.author}) - ${doc.chapters.length} chapters${doc.isPaid ? `, $${doc.price}` : ""}`);
  }
  return stats;
}

async function importCatalogue(authorId) {
  const entries = require("../data/catalogue.json");
  const stats = { created: 0, skipped: 0, failed: 0, chapters: 0, genres: {} };
  const note =
    "This is a summary edition: a plot summary taken from Wikipedia (CC BY-SA 3.0) through the CMU Book Summary Corpus. " +
    "It is not the book itself, and the full text is not available on BookConnect.\n\n";

  for (const e of entries) {
    const genre = classify(e.summary);
    const doc = {
      title: e.title,
      originalAuthor: e.author,
      description: e.description.slice(0, 1990),
      genre,
      tags: ["summary edition"],
      isPaid: false,
      price: 0,
      chapters: [{ title: "Summary", content: note + e.summary, order: 1 }],
      source: {
        name: "CMU Book Summary Corpus (Wikipedia)",
        url: "https://www.cs.cmu.edu/~dbamman/booksummaries.html",
        license: "CC BY-SA 3.0",
        note: e.year ? `First published ${e.year}.` : undefined,
      },
    };
    stats.chapters += 1;
    stats.genres[genre] = (stats.genres[genre] || 0) + 1;
    await create(doc, authorId, stats);
  }
  return stats;
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name}${DRY ? "  (dry run - nothing will be written)" : ""}`);
  try {
    const user = await libraryUser();
    const authorId = user ? user._id : null;
    if (!only || only === "gutenberg") {
      console.log("\nPublic-domain classics (Project Gutenberg):");
      const s = await importGutenberg(authorId);
      console.log(`  -> ${s.created} ${DRY ? "would be " : ""}added, ${s.refreshed || 0} refreshed, ${s.skipped} already there, ${s.failed} problems, ${s.chapters} chapters`);
      console.log("  genres:", JSON.stringify(s.genres));
    }
    if (!only || only === "catalogue") {
      console.log("\nSummary-edition catalogue:");
      const s = await importCatalogue(authorId);
      console.log(`  -> ${s.created} ${DRY ? "would be " : ""}added, ${s.skipped} already there`);
      console.log("  genres:", JSON.stringify(s.genres));
    }
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});
