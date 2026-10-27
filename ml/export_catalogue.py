"""Builds backend/data/catalogue.json: ~300 well-known books for BookConnect's
"summary edition" catalogue, from two datasets already used for the ML work.

  * Goodbooks-10k (books.csv)        -> which books are popular, real author, year
  * CMU Book Summary Corpus          -> plot summary + genres (Wikipedia, CC BY-SA 3.0)

These are mostly copyrighted books, so only the summary is included - never the
book's text. Run from the repo root:  python ml/export_catalogue.py
"""
import csv
import json
import os
import re

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
OUT = os.path.join(REPO, "backend", "data", "catalogue.json")
COUNT = 300

# Keep the catalogue suitable for a general audience.
BLOCK = re.compile(
    r"\b(rape[sd]?|raping|incest\w*|molest\w*|pedophil\w*|paedophil\w*|erotic\w*|sexually abus\w*|sex slave\w*|prostitut\w*|porn\w*)\b",
    re.I,
)

# CMU/Freebase genre name -> BookConnect genre (first match in this order wins)
GENRE_MAP = [
    ("fantasy", ["fantasy", "high fantasy", "urban fantasy", "epic fantasy"]),
    ("horror", ["horror", "gothic fiction", "ghost story"]),
    ("mystery", ["mystery", "crime fiction", "detective fiction", "whodunit"]),
    ("thriller", ["thriller", "suspense", "spy fiction", "techno-thriller", "political thriller"]),
    ("romance", ["romance novel", "chick lit", "historical romance"]),
    ("history", ["historical novel", "historical fiction", "alternate history", "history"]),
    ("biography", ["biography", "autobiography", "memoir"]),
    ("non-fiction", ["non-fiction", "essay", "philosophy", "self-help", "popular science"]),
    ("poetry", ["poetry"]),
    ("drama", ["play", "drama"]),
    ("children", ["children's literature", "young adult literature", "children's fiction"]),
]


def norm(title):
    t = re.sub(r"\(.*?\)", " ", title.lower())
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    t = re.sub(r"^(the|a|an) ", "", t.strip())
    return re.sub(r"\s+", " ", t).strip()


def genre_of(genres):
    names = [g.lower() for g in genres]
    for genre, keys in GENRE_MAP:
        if any(k in names for k in keys):
            return genre
    return "fiction"


def trim(text, limit):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    end = max(cut.rfind(". "), cut.rfind("! "), cut.rfind("? "))
    return (cut[: end + 1] if end > limit * 0.5 else cut.rstrip() + "...")


def main():
    gutenberg = json.load(open(os.path.join(REPO, "backend", "data", "libraryCatalog.json"), encoding="utf8"))
    skip_titles = [g["match"] for g in gutenberg]

    # CMU summaries keyed by normalised title
    cmu = {}
    path = os.path.join(ROOT, "data", "booksummaries", "booksummaries.txt")
    with open(path, encoding="utf8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 7:
                continue
            _, _, title, author, date, genres, summary = parts[:7]
            try:
                genre_names = list(json.loads(genres).values()) if genres else []
            except ValueError:
                genre_names = []
            cmu.setdefault(norm(title), []).append(
                {"title": title, "author": author, "date": date, "genres": genre_names, "summary": summary.strip()}
            )

    picked, seen = [], set()
    with open(os.path.join(ROOT, "data", "books.csv"), encoding="utf8", newline="") as f:
        rows = sorted(csv.DictReader(f), key=lambda r: -int(r["ratings_count"] or 0))

    for r in rows:
        if len(picked) >= COUNT:
            break
        lang = (r["language_code"] or "eng").lower()
        if lang and not lang.startswith("en"):
            continue
        author = r["authors"].split(",")[0].strip()
        surname = author.split()[-1].lower() if author else ""
        for candidate_title in {r["original_title"] or r["title"], re.sub(r"\s*\(.*$", "", r["title"])}:
            key = norm(candidate_title)
            if not key or key in seen:
                continue
            hit = next((m for m in cmu.get(key, []) if surname and surname in m["author"].lower()), None)
            if not hit:
                continue
            if any(key == s or key.startswith(s) or s.startswith(key) for s in skip_titles):
                continue
            summary = hit["summary"]
            if len(summary) < 400 or BLOCK.search(summary):
                continue
            seen.add(key)
            year = int(float(r["original_publication_year"])) if r["original_publication_year"] else None
            first = trim(summary, 330)
            picked.append(
                {
                    "title": hit["title"][:190],
                    "author": author,
                    "year": year,
                    "genre": genre_of(hit["genres"]),
                    "description": first,
                    "summary": trim(summary, 3000),
                    "goodreadsRating": float(r["average_rating"]),
                    "ratingsCount": int(r["ratings_count"]),
                }
            )
            break

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf8") as f:
        json.dump(picked, f, ensure_ascii=False, indent=1)

    by_genre = {}
    for p in picked:
        by_genre[p["genre"]] = by_genre.get(p["genre"], 0) + 1
    print(f"Wrote {len(picked)} books to {os.path.relpath(OUT, REPO)}  ({os.path.getsize(OUT) // 1024} KB)")
    print("By genre:", dict(sorted(by_genre.items(), key=lambda kv: -kv[1])))
    for p in picked[:8]:
        print(" -", p["title"], "|", p["author"], "|", p["genre"], "|", p["year"])


if __name__ == "__main__":
    main()
