const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Book = require("../models/Book");
const { parseGutenberg, displayAuthor } = require("../utils/gutenberg");
const { connectTestDB, disconnectTestDB } = require("./setup");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

const para = (n, word) => `${word} `.repeat(n).trim() + ".";
const chapter = (title, body) => `${title}\n\n${body}\n\n`;

// A tiny stand-in for a Project Gutenberg file: licence header, contents list,
// three real chapters, licence footer.
const SAMPLE = [
  "The Project Gutenberg eBook of Test Tale",
  "",
  "Title: Test Tale; or, A Longer Name",
  "Author: Doe, Jane",
  "Language: English",
  "",
  "*** START OF THE PROJECT GUTENBERG EBOOK TEST TALE ***",
  "",
  "CONTENTS",
  "",
  "CHAPTER I.",
  "CHAPTER II.",
  "CHAPTER III.",
  "",
  chapter("CHAPTER I.", para(400, "alpha")),
  chapter("CHAPTER II.", para(400, "beta")),
  chapter("CHAPTER III.", para(400, "gamma")),
  "*** END OF THE PROJECT GUTENBERG EBOOK TEST TALE ***",
  "Licence text that must not appear in the book.",
].join("\n");

describe("Project Gutenberg parser (utils/gutenberg.js)", () => {
  const parsed = parseGutenberg(SAMPLE);

  it("reads the title, author and language from the header", () => {
    expect(parsed.title).toBe("Test Tale; or, A Longer Name");
    expect(parsed.author).toBe("Jane Doe");
    expect(parsed.language).toBe("english");
  });

  it("splits on chapter headings, ignoring the table of contents", () => {
    expect(parsed.chapters.map((c) => c.title)).toEqual(["CHAPTER I", "CHAPTER II", "CHAPTER III"]);
    expect(parsed.chapters[0].content).toMatch(/^alpha/);
    expect(parsed.chapters[2].content).toMatch(/^gamma/);
  });

  it("drops the licence header and footer", () => {
    const all = parsed.chapters.map((c) => c.content).join(" ");
    expect(all).not.toMatch(/Licence text|START OF THE PROJECT|CONTENTS/);
  });

  it("falls back to evenly sized parts when there are no chapter headings", () => {
    const text = `Title: Plain\nAuthor: Anon\n\n*** START OF THE PROJECT GUTENBERG EBOOK PLAIN ***\n\n` +
      Array.from({ length: 200 }, () => para(120, "word")).join("\n\n");
    const p = parseGutenberg(text);
    expect(p.chapters.length).toBeGreaterThan(2);
    expect(p.chapters[0].title).toBe("Part 1");
    expect(p.chapters.every((c) => c.content.length > 0)).toBe(true);
  });

  it("formats author names", () => {
    expect(displayAuthor("Austen, Jane")).toBe("Jane Austen");
    expect(displayAuthor("Homer")).toBe("Homer");
    expect(displayAuthor("Marcus Aurelius, Emperor of Rome, 121-180")).toBe("Emperor of Rome Marcus Aurelius");
  });
});

describe("Library books in the public catalogue", () => {
  beforeAll(async () => {
    const lib = await User.create({ name: "BookConnect Library", email: "lib-test@example.com", password: "password123", role: "author", isEmailVerified: true });
    await Book.create({
      title: "Emma Test", originalAuthor: "Jane Austen", author: lib._id, description: "A comedy of matchmaking.", genre: "romance",
      status: "published", source: { name: "Project Gutenberg", url: "https://www.gutenberg.org/ebooks/158", license: "Public domain" },
      chapters: [{ title: "Chapter 1", content: "Emma Woodhouse, handsome, clever, and rich...", order: 1 }],
    });
  });

  it("can be found by the original author's name, which the owner account doesn't carry", async () => {
    const res = await request(app).get("/api/books?search=austen");
    expect(res.body.data.map((b) => b.title)).toContain("Emma Test");
    expect(res.body.data[0].originalAuthor).toBe("Jane Austen");
    expect(res.body.data[0].source.license).toBe("Public domain");
  });

  it("treats search text literally, not as a regular expression", async () => {
    const evil = await request(app).get("/api/books?search=" + encodeURIComponent("(a+)+$"));
    expect(evil.status).toBe(200);
    expect(evil.body.data).toHaveLength(0);
    const dot = await request(app).get("/api/books?search=" + encodeURIComponent("E.ma"));
    expect(dot.body.data).toHaveLength(0); // "." is not a wildcard
  });

  it("never sends chapter text in the list", async () => {
    const res = await request(app).get("/api/books?search=emma");
    expect(JSON.stringify(res.body)).not.toMatch(/handsome, clever/);
  });
});
