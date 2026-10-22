// Turns a Project Gutenberg plain-text file into { title, author, chapters[] }.
// Pure functions (no database) so they can be tested on their own.

const START_RE = /\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i;
const END_RE = /\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i;

const ROMAN = "[IVXLCDM]+";
// "CHAPTER I.", "Chapter 12", "BOOK THE FIRST", "STAVE ONE", "PART II", a bare "XIV." ...
const HEADING_RES = [
  new RegExp(`^\\s*(?:CHAPTER|Chapter)\\s+(?:${ROMAN}|\\d+|[A-Z][A-Za-z-]+)\\b.*$`),
  new RegExp(`^\\s*(?:STAVE|Stave|LETTER|Letter|ADVENTURE|Adventure)\\s+(?:${ROMAN}|\\d+|[A-Z][A-Za-z-]+)\\b.*$`),
  new RegExp(`^\\s*(?:PART|Part|BOOK|Book|ACT|Act)\\s+(?:${ROMAN}|\\d+|THE\\s+[A-Z]+|the\\s+[a-z]+|[A-Z][a-z]+)\\b.*$`),
  new RegExp(`^\\s*${ROMAN}\\.?\\s*$`),
  /^\s*[IVXLCDM]+\.\s+[A-Z][^\n]{2,60}$/,
];

const MIN_CHAPTER_CHARS = 1500; // shorter "chapters" are table-of-contents lines
const FALLBACK_PART_CHARS = 22000;

function header(raw) {
  const field = (name) => {
    const m = raw.match(new RegExp(`^${name}:\\s*(.+)$`, "mi"));
    return m ? m[1].trim() : "";
  };
  return { title: field("Title"), author: field("Author"), language: field("Language") };
}

// The book text between Gutenberg's START and END markers, tidied.
function body(raw) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const start = text.match(START_RE);
  const from = start ? start.index + start[0].length : 0;
  const end = text.search(END_RE);
  return text.slice(from, end > from ? end : undefined).trim();
}

// "CHAPTER I. Down the Rabbit-Hole" and "Chapter I" are the same heading
const headKey = (title) => title.split(/\s+/).slice(0, 2).join(" ").toLowerCase().replace(/[.:,]/g, "");

const isHeading = (line) => line.length < 90 && HEADING_RES.some((re) => re.test(line));

function splitByParagraphs(text, size) {
  const parts = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length > size) {
      parts.push(current.trim());
      current = "";
    }
    current += para + "\n\n";
  }
  if (current.trim()) parts.push(current.trim());
  if (parts.length === 1) return [{ title: "Full text", content: parts[0] }];
  return parts.map((content, i) => ({ title: `Part ${i + 1}`, content }));
}

function splitChapters(text) {
  const lines = text.split("\n");
  const marks = [];
  let offset = 0;
  lines.forEach((line, i) => {
    if (isHeading(line)) {
      // a title on the next non-empty line ("CHAPTER I." / "Down the Rabbit-Hole") belongs to the heading
      let title = line.trim();
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const next = (lines[j] || "").trim();
      if (j - i <= 3 && next && next.length < 70 && !isHeading(lines[j]) && next === next.toUpperCase() === (title === title.toUpperCase())) {
        title = `${title} ${next}`;
      }
      marks.push({ at: offset, bodyAt: offset + line.length, title: title.replace(/\s+/g, " ").replace(/\.$/, "") });
    }
    offset += line.length + 1;
  });

  // How much text follows each heading before the next one starts.
  const seg = marks.map((m, i) => (i + 1 < marks.length ? marks[i + 1].at : text.length) - m.bodyAt);

  // A table of contents is a run of 2+ headings with almost no text between them.
  // The entry right after that run is the contents' last line (its "segment" runs
  // on into the opening prose), so it is dropped too.
  const toc = new Set();
  let tocEnd = 0;
  for (let i = 0; i < marks.length; ) {
    let j = i;
    while (j < marks.length && seg[j] < MIN_CHAPTER_CHARS) j++;
    if (j - i >= 2) {
      for (let k = i; k < j; k++) toc.add(k);
      // The entry after the run is the contents' last line, unless it repeats a title
      // already in the run, which means the contents ended and the first real chapter began.
      const seen = new Set(marks.slice(i, j).map((m) => headKey(m.title)));
      if (j < marks.length && !seen.has(headKey(marks[j].title))) {
        toc.add(j);
        tocEnd = marks[j].bodyAt;
      } else {
        tocEnd = marks[j - 1].bodyAt;
      }
    }
    i = Math.max(j, i) + 1;
  }

  const kept = marks
    .map((m, i) => ({ ...m, end: i + 1 < marks.length ? marks[i + 1].at : text.length, i }))
    .filter((k) => !toc.has(k.i) && k.end - k.bodyAt >= MIN_CHAPTER_CHARS);
  if (kept.length < 3) return splitByParagraphs(text, FALLBACK_PART_CHARS);

  const chapters = kept.map((k) => ({ title: k.title.slice(0, 120), content: text.slice(k.bodyAt, k.end).trim() }));
  // whatever sits between the contents list and chapter 1 (preface, dedication) stays readable
  const front = text.slice(Math.min(tocEnd, kept[0].at), kept[0].at).trim();
  if (front.length >= MIN_CHAPTER_CHARS) chapters.unshift({ title: "Before you begin", content: front });
  return chapters.filter((c) => c.content.length > 0);
}

// "Doyle, Arthur Conan" -> "Arthur Conan Doyle" (Gutenberg is inconsistent, so only flip a single comma)
const displayAuthor = (a) => {
  const m = a.match(/^([^,]+),\s*([^,(]+)/);
  return m ? `${m[2].trim()} ${m[1].trim()}` : a.replace(/\s*\(.*?\)\s*/g, "").trim();
};

function parseGutenberg(raw) {
  const meta = header(raw);
  const text = body(raw);
  return {
    title: meta.title,
    author: displayAuthor(meta.author),
    language: (meta.language || "English").toLowerCase(),
    chapters: splitChapters(text),
    words: (text.match(/\S+/g) || []).length,
  };
}

module.exports = { parseGutenberg, splitChapters, body, header, displayAuthor };
