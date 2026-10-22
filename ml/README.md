# Machine learning in BookConnect

Two models are trained here on public datasets, evaluated on data they never saw,
and (for the genre model) used live by the app.

## 1. Genre classifier — used in the app

| | |
|---|---|
| Dataset | [CMU Book Summary Dataset](http://www.cs.cmu.edu/~dbamman/booksummaries.html) — 16,559 Wikipedia plot summaries with Freebase genres. CC BY-SA 3.0 (credit Bamman & Smith, 2013). |
| Model | TF-IDF (unigrams, sublinear tf) → one-vs-rest logistic regression |
| Labels | 10 of the app's own genres: fantasy, science (= science *fiction*), mystery, thriller, horror, romance, history, biography, children, non-fiction. Mapping is in `train_genre_classifier.py`. |
| Training data | 9,334 usable books (the rest had no mapped genre) — 80% train / 20% test |
| Script | `python ml/train_genre_classifier.py` |
| Output | `backend/ml/genre_classifier.json` (2 MB, loaded by `backend/utils/genreClassifier.js`) and `ml/reports/genre_classifier_report.json` |
| In the app | `POST /api/ai/suggest-genre`, and the **Suggest genre** button when an author uploads or edits a book |

**Results on 1,867 held-out books**

| Metric | Value |
|---|---|
| Top-1 hit rate (best guess is one of the book's real genres) | **78.7%** |
| Top-3 hit rate | **93.7%** |
| Baseline: always guess the most common genre | 30.5% |
| Micro / macro F1 | 0.70 / 0.63 |

Strongest: science (F1 0.81), fantasy (0.76), mystery (0.75). Weakest: romance (0.43)
and biography (0.50) — they have few training examples.

**Limits, stated plainly**
- It was trained on plot *summaries*, so it works best on a paragraph describing a story, not on arbitrary prose.
- It cannot suggest drama, poetry or technology — the dataset has no usable examples of them.
- "science" means science fiction; there is no science non-fiction class.
- It is a suggestion, not a verdict; the author always chooses the genre.

## 2. Collaborative-filtering recommender — trained and evaluated

| | |
|---|---|
| Dataset | [Goodbooks-10k](https://github.com/zygmuntz/goodbooks-10k) — 5,976,479 ratings, 53,424 users, 10,000 books (scraped from Goodreads; the repo declares no licence, so check before redistributing). |
| Script | `python ml/train_recommender.py` |
| Protocol | Hide a random 20% of every user's ratings. Rank the books the user has *not* rated. A hit = a held-out book the user rated ≥ 4 appears in the top 10. 4,000 sampled users. |

| Model | Hit rate@10 | Precision@10 | NDCG@10 |
|---|---|---|---|
| Top-rated books (baseline) | 0.023 | 0.003 | 0.003 |
| Most-liked books (baseline) | 0.422 | 0.075 | 0.092 |
| **Item-based CF (kNN = 50)** | **0.820** | **0.224** | **0.276** |
| Matrix factorisation (SVD, 64 factors) | 0.581 | 0.103 | 0.133 |

Item-based CF is the winner (about 3× the ranking quality of "most-liked"). Its output
looks sensible — e.g. *Pride and Prejudice* → *Sense and Sensibility*, *Jane Eyre*,
*Persuasion*, *Emma*.

**Limits, stated plainly**
- The split is random per user, not by time, so absolute numbers are optimistic versus real deployment; the *ordering* of models is what to trust.
- **It is not wired into the live app.** Goodbooks-10k contains famous published books; BookConnect's catalogue is its own handful of books, so there is nothing to join them on. The platform's own recommender (`backend/routes/recommendationRoutes.js`) stays content-based (TF-IDF). To use this method live, retrain it on the platform's own ratings once enough readers have rated books.

## What is *not* machine learning

- The **"AI quality score"** (`backend/routes/aiRoutes.js`) is a readability formula (Flesch) plus a fixed offset. It is a heuristic and should be described as one — no public dataset labels manuscript quality, so there was nothing honest to train it on.
- **Plagiarism checking and "reader matching"** use TF-IDF cosine similarity — classical information retrieval, no training.
- **Translation** calls an external model (Claude / Gemini / MyMemory).

## Reproduce

```
pip install -r ml/requirements.txt
# download the datasets into ml/data/ (kept out of git):
#   booksummaries.tar.gz  -> https://www.cs.cmu.edu/~dbamman/data/booksummaries.tar.gz  (extract here)
#   ratings.csv, books.csv -> https://github.com/zygmuntz/goodbooks-10k/releases/tag/v1.0 (unzip)
python ml/train_genre_classifier.py
python ml/train_recommender.py
```

Both take well under a minute on a normal laptop. Seeds are fixed, so results repeat.
