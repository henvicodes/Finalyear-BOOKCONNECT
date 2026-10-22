"""
Train and evaluate a collaborative-filtering book recommender on Goodbooks-10k
(~6M ratings from 53,424 users on 10,000 books, scraped from Goodreads).
  https://github.com/zygmuntz/goodbooks-10k

Three models are compared on held-out ratings the models never saw:
  1. Popularity        - recommend the most-liked books to everyone (baseline)
  2. Item-based CF     - "readers who liked X also liked Y" from co-ratings
  3. Matrix factorisation (SVD) - learn latent taste factors for users & books

Metric: for each test user, hide 20% of their ratings; rank all books they
have NOT rated in training; check how many of the hidden books they LIKED
(rating >= 4) appear in the top 10.

Usage (from repo root):
    python ml/train_recommender.py
"""
import json
import os
import sys
import time

import numpy as np
import pandas as pd
import scipy.sparse as sp
from scipy.sparse.linalg import svds

sys.stdout.reconfigure(encoding="utf-8")  # book titles contain non-ASCII characters
ROOT = os.path.dirname(os.path.abspath(__file__))
SEED = 42
K = 10
LIKE = 4
FACTORS = 64
EVAL_USERS = 4000


def load():
    r = pd.read_csv(os.path.join(ROOT, "data", "ratings.csv"))
    books = pd.read_csv(os.path.join(ROOT, "data", "books.csv"))
    return r, books


def split(r, rng):
    """Hide a random 20% of every user's ratings (users with >=5 ratings)."""
    r = r.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
    counts = r.groupby("user_id")["book_id"].transform("size")
    r = r[counts >= 5].reset_index(drop=True)
    r["rank"] = r.groupby("user_id").cumcount()
    r["n"] = r.groupby("user_id")["book_id"].transform("size")
    test_mask = r["rank"] >= (r["n"] * 0.8).astype(int)
    return r[~test_mask][["user_id", "book_id", "rating"]], r[test_mask][["user_id", "book_id", "rating"]]


def to_matrix(df, n_users, n_books):
    return sp.csr_matrix(
        (df["rating"].values.astype(np.float32), (df["user_id"].values - 1, df["book_id"].values - 1)),
        shape=(n_users, n_books),
    )


def evaluate(score_fn, train_mat, test_df, users, name):
    """score_fn(user_idx_array) -> dense (len(users), n_books) score matrix."""
    liked = test_df[test_df["rating"] >= LIKE].groupby("user_id")["book_id"].apply(set)
    hits = prec = rec = ndcg = 0.0
    counted = 0
    BATCH = 500
    for s in range(0, len(users), BATCH):
        batch = users[s:s + BATCH]
        scores = np.asarray(score_fn(batch), dtype=np.float32)
        seen = train_mat[batch]
        scores[seen.nonzero()] = -np.inf          # never recommend what they already rated
        top = np.argpartition(-scores, K, axis=1)[:, :K]
        order = np.take_along_axis(scores, top, axis=1).argsort(axis=1)[:, ::-1]
        top = np.take_along_axis(top, order, axis=1)
        for row, u in zip(top, batch):
            truth = liked.get(u + 1)
            if not truth:
                continue
            rec_ids = row + 1
            gains = np.array([1.0 if b in truth else 0.0 for b in rec_ids])
            n_hit = gains.sum()
            hits += n_hit > 0
            prec += n_hit / K
            rec += n_hit / len(truth)
            dcg = (gains / np.log2(np.arange(2, K + 2))).sum()
            idcg = (1.0 / np.log2(np.arange(2, min(len(truth), K) + 2))).sum()
            ndcg += dcg / idcg
            counted += 1
    res = {
        "hit_rate@10": round(float(hits / counted), 4),
        "precision@10": round(float(prec / counted), 4),
        "recall@10": round(float(rec / counted), 4),
        "ndcg@10": round(float(ndcg / counted), 4),
        "users_evaluated": counted,
    }
    print(f"{name:28s} {res}")
    return res


def main():
    t0 = time.time()
    rng = np.random.default_rng(SEED)
    ratings, books = load()
    n_users, n_books = int(ratings.user_id.max()), int(ratings.book_id.max())
    train, test = split(ratings, rng)
    print(f"ratings: {len(ratings):,}  train: {len(train):,}  test: {len(test):,}  users: {n_users:,}  books: {n_books:,}")

    R = to_matrix(train, n_users, n_books)
    test_users = np.array(sorted(test[test.rating >= LIKE].user_id.unique()))
    test_users = rng.choice(test_users, size=min(EVAL_USERS, len(test_users)), replace=False) - 1

    results = {}

    # 1. Top-rated baseline: average rating shrunk toward the global mean so
    #    a book with three 5-star ratings doesn't beat a classic with 50,000.
    cnt = np.asarray((R > 0).sum(axis=0)).ravel()
    tot = np.asarray(R.sum(axis=0)).ravel()
    gmean = tot.sum() / cnt.sum()
    pop = (tot + 20 * gmean) / (cnt + 20)
    results["top_rated"] = evaluate(lambda b: np.tile(pop, (len(b), 1)), R, test, test_users, "Top-rated (baseline)")

    # 1b. The standard, stronger popularity baseline: books with the most
    #     "likes" (rating >= 4). Everyone gets the same list, minus what
    #     they've already rated.
    likes = np.asarray((R >= LIKE).sum(axis=0)).ravel().astype(np.float32)
    results["most_liked"] = evaluate(lambda b: np.tile(likes, (len(b), 1)), R, test, test_users, "Most-liked (baseline)")

    # 2. Item-based CF on mean-centred ratings (cosine similarity).
    user_mean = np.asarray(R.sum(axis=1)).ravel() / np.maximum(np.asarray((R > 0).sum(axis=1)).ravel(), 1)
    Rc = R.copy().astype(np.float32)
    Rc.data -= np.repeat(user_mean, np.diff(Rc.indptr)).astype(np.float32)
    norms = np.sqrt(np.asarray(Rc.multiply(Rc).sum(axis=0)).ravel()) + 1e-9
    Rn = Rc @ sp.diags(1.0 / norms)                      # unit-length item columns
    # Item-item similarity, computed 1,000 books at a time (the full 10k x 10k
    # product is nearly dense and would need gigabytes as a sparse matrix) and
    # pruned to each book's 50 strongest neighbours — standard kNN-CF.
    RnT = Rn.T.tocsr()
    rows = []
    for s in range(0, n_books, 1000):
        block = (RnT[s:s + 1000] @ Rn).toarray().astype(np.float32)
        for i in range(block.shape[0]):
            block[i, s + i] = 0                          # a book isn't its own neighbour
        kth = np.partition(block, -50, axis=1)[:, -50][:, None]
        block[block < kth] = 0
        rows.append(sp.csr_matrix(block))
    sim_sp = sp.vstack(rows).tocsr()
    # Score = how similar the book is to what the user LIKED (centred rating).
    results["item_cf"] = evaluate(lambda b: (Rc[b] @ sim_sp).toarray(), R, test, test_users, "Item-based CF (kNN=50)")

    # 3. Matrix factorisation: truncated SVD of the mean-centred matrix.
    U, S, Vt = svds(Rc.astype(np.float64), k=FACTORS)
    item_f = (Vt.T * S).astype(np.float32)               # books x FACTORS
    user_f = U.astype(np.float32)                        # users x FACTORS
    results["svd"] = evaluate(lambda b: user_f[b] @ item_f.T, R, test, test_users, f"SVD ({FACTORS} factors)")

    # Pick the winner by NDCG, and save the artefacts needed to use it.
    best = max(results, key=lambda k: results[k]["ndcg@10"])
    print(f"\nBest model: {best}")

    title = books.set_index("book_id")["title"].to_dict()
    out_dir = os.path.join(ROOT, "artifacts")
    os.makedirs(out_dir, exist_ok=True)

    # Save the WINNING model (item-based CF): each book's 50 nearest
    # neighbours and their similarity — ~2 MB, enough to recommend with.
    nbr_ids = np.zeros((n_books, 50), dtype=np.int16)
    nbr_sim = np.zeros((n_books, 50), dtype=np.float16)
    for i in range(n_books):
        row = sim_sp.getrow(i)
        order = np.argsort(-row.data)[:50]
        nbr_ids[i, :len(order)] = row.indices[order]
        nbr_sim[i, :len(order)] = row.data[order]
    np.savez_compressed(os.path.join(out_dir, "item_cf_neighbors.npz"), ids=nbr_ids, sim=nbr_sim)
    with open(os.path.join(out_dir, "book_titles.json"), "w", encoding="utf8") as f:
        json.dump({int(k): v for k, v in title.items()}, f)

    # A few "if you liked X" examples from the saved model.
    def similar(book_title_part, n=5):
        ids = [i for i, t in title.items() if book_title_part.lower() in str(t).lower()]
        if not ids:
            return None
        i = ids[0] - 1
        return {"book": title[ids[0]], "similar": [title[int(j) + 1] for j in nbr_ids[i][:n]]}

    examples = [similar(q) for q in ["Harry Potter and the Sorcerer", "The Hunger Games", "Pride and Prejudice", "The Da Vinci Code", "The Fault in Our Stars"]]
    examples = [e for e in examples if e]
    for e in examples:
        print(f"If you liked '{e['book']}': {e['similar']}")

    report = {
        "dataset": "Goodbooks-10k (5,976,479 ratings, 53,424 users, 10,000 books)",
        "protocol": "per-user random 80/20 split (not time-based, so absolute numbers are optimistic); rank unrated books; relevant = held-out rating >= 4",
        "eval_users_sampled": int(len(test_users)),
        "results": results,
        "best": best,
        "examples": examples,
        "trained_seconds": round(time.time() - t0, 1),
    }
    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True)
    with open(os.path.join(ROOT, "reports", "recommender_report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(f"Done in {report['trained_seconds']}s")


if __name__ == "__main__":
    main()
