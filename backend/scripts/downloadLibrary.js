// Downloads the public-domain books listed in data/libraryCatalog.json from
// Project Gutenberg into backend/data/gutenberg/ (git-ignored). Plain text only.
//
//   node scripts/downloadLibrary.js
//
// Polite by design: one request at a time, a short pause between them, and files
// already on disk are skipped, so it is safe to re-run.
const fs = require("fs");
const path = require("path");

const catalog = require("../data/libraryCatalog.json");
const outDir = path.join(__dirname, "..", "data", "gutenberg");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_BYTES = 6 * 1024 * 1024; // refuse anything unexpectedly large

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  let got = 0, skipped = 0, failed = 0, bytes = 0;

  for (const book of catalog) {
    const file = path.join(outDir, `pg${book.id}.txt`);
    if (fs.existsSync(file)) { skipped++; continue; }
    const url = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "BookConnect-library-import (student project)" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = res.headers.get("content-type") || "";
      if (!type.startsWith("text/")) throw new Error(`unexpected type ${type}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error(`too large (${buf.length} bytes)`);
      fs.writeFileSync(file, buf);
      got++;
      bytes += buf.length;
      console.log(`ok   ${book.id}  ${(buf.length / 1024).toFixed(0)} KB  ${book.match}`);
    } catch (err) {
      failed++;
      console.log(`FAIL ${book.id}  ${book.match}: ${err.message}`);
    }
    await sleep(1200);
  }
  console.log(`\nDownloaded ${got} (${(bytes / 1048576).toFixed(1)} MB), already had ${skipped}, failed ${failed}.`);
})();
