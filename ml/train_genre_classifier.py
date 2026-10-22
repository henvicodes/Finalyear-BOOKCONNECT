"""
Train a multi-label genre classifier on the CMU Book Summary Dataset and
export it as plain JSON, so the Node backend can score text without Python.

Dataset: CMU Book Summary Dataset (Bamman & Smith, 2013) — 16,559 books with
Wikipedia plot summaries and Freebase genres, CC BY-SA.
  http://www.cs.cmu.edu/~dbamman/booksummaries.html

Model: TF-IDF (unigrams, sublinear tf, L2-normalised) + one-vs-rest logistic
regression. Plain linear model on purpose: it can be exported as
vocabulary + idf + weights and reproduced exactly in JavaScript.

Usage (from repo root):
    python ml/train_genre_classifier.py
"""
import json
import os
import random
import time

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import f1_score, precision_score, recall_score

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data", "booksummaries", "booksummaries.txt")
MODEL_OUT = os.path.join(ROOT, "..", "backend", "ml", "genre_classifier.json")
REPORT_OUT = os.path.join(ROOT, "reports", "genre_classifier_report.json")

SEED = 42
MAX_FEATURES = 20000

# CMU's Freebase genres are very fine-grained. These are the app's own genre
# names, each fed by the CMU genres that mean the same thing. "science" here is
# science FICTION — the dataset has no science non-fiction. Generic labels
# ("Fiction", "Novel", "Speculative fiction") are deliberately not classes:
# nearly every book carries them, so they carry no information.
GENRE_MAP = {
    "fantasy": ["Fantasy", "High fantasy"],
    "science": ["Science Fiction", "Dystopia", "Utopian and dystopian fiction",
                "Apocalyptic and post-apocalyptic fiction", "Steampunk"],
    "mystery": ["Mystery", "Detective fiction", "Crime Fiction"],
    "thriller": ["Thriller", "Suspense", "Spy fiction", "Techno-thriller"],
    "horror": ["Horror", "Gothic fiction"],
    "romance": ["Romance novel", "Paranormal romance"],
    "history": ["Historical novel", "Historical fiction", "History"],
    "biography": ["Biography", "Autobiography", "Memoir", "Autobiographical novel"],
    "children": ["Children's literature", "Picture book"],
    "non-fiction": ["Non-fiction", "Philosophy"],
}
CMU_TO_APP = {cmu: app for app, cmus in GENRE_MAP.items() for cmu in cmus}
GENRES = list(GENRE_MAP)


def load():
    texts, labels = [], []
    skipped = 0
    with open(DATA, encoding="utf8") as f:
        for line in f:
            p = line.rstrip("\n").split("\t")
            if len(p) < 7 or not p[5].strip():
                skipped += 1
                continue
            mapped = {CMU_TO_APP[g] for g in json.loads(p[5]).values() if g in CMU_TO_APP}
            if not mapped or len(p[6].split()) < 30:
                skipped += 1
                continue
            texts.append(p[6])
            labels.append([1 if g in mapped else 0 for g in GENRES])
    return texts, np.array(labels), skipped


def main():
    t0 = time.time()
    texts, Y, skipped = load()
    n = len(texts)
    print(f"Usable books: {n}  (skipped {skipped}: no mapped genre or too short)")

    idx = list(range(n))
    random.Random(SEED).shuffle(idx)
    cut = int(n * 0.8)
    tr, te = idx[:cut], idx[cut:]
    Xtxt_tr = [texts[i] for i in tr]
    Xtxt_te = [texts[i] for i in te]
    Ytr, Yte = Y[tr], Y[te]

    vec = TfidfVectorizer(
        lowercase=True,
        token_pattern=r"[a-z]{2,}",   # JS side reproduces this with /[a-z]{2,}/g
        stop_words="english",
        min_df=3,
        max_df=0.5,
        sublinear_tf=True,
        max_features=MAX_FEATURES,
        dtype=np.float64,
    )
    Xtr = vec.fit_transform(Xtxt_tr)
    Xte = vec.transform(Xtxt_te)
    print(f"Vocabulary: {len(vec.vocabulary_)} terms, train {Xtr.shape[0]}, test {Xte.shape[0]}")

    coefs, intercepts = [], []
    prob_te = np.zeros(Yte.shape)
    for j, g in enumerate(GENRES):
        clf = LogisticRegression(C=8.0, class_weight="balanced", max_iter=2000)
        clf.fit(Xtr, Ytr[:, j])
        coefs.append(clf.coef_[0])
        intercepts.append(float(clf.intercept_[0]))
        prob_te[:, j] = clf.predict_proba(Xte)[:, 1]

    # ---- Evaluation on the held-out 20% (never seen in training) ----
    pred = (prob_te >= 0.5).astype(int)
    per_class = {}
    for j, g in enumerate(GENRES):
        per_class[g] = {
            "support": int(Yte[:, j].sum()),
            "precision": round(float(precision_score(Yte[:, j], pred[:, j], zero_division=0)), 3),
            "recall": round(float(recall_score(Yte[:, j], pred[:, j], zero_division=0)), 3),
            "f1": round(float(f1_score(Yte[:, j], pred[:, j], zero_division=0)), 3),
        }
    micro_f1 = float(f1_score(Yte, pred, average="micro", zero_division=0))
    macro_f1 = float(f1_score(Yte, pred, average="macro", zero_division=0))

    # "Does the model's #1 guess match one of the book's real genres?"
    top1 = prob_te.argmax(axis=1)
    top1_hit = float(np.mean([Yte[i, top1[i]] == 1 for i in range(len(te))]))
    # "Is at least one real genre inside the model's top 3?"
    top3 = np.argsort(-prob_te, axis=1)[:, :3]
    top3_hit = float(np.mean([Yte[i, top3[i]].sum() > 0 for i in range(len(te))]))

    # Baseline: always guess the most common genre.
    majority = int(Ytr.sum(axis=0).argmax())
    baseline_top1 = float(np.mean(Yte[:, majority] == 1))

    report = {
        "dataset": "CMU Book Summary Dataset (16,559 books, CC BY-SA)",
        "usable_books": n,
        "train_books": len(tr),
        "test_books": len(te),
        "genres": GENRES,
        "vocabulary_size": len(vec.vocabulary_),
        "metrics": {
            "top1_hit_rate": round(top1_hit, 3),
            "top3_hit_rate": round(top3_hit, 3),
            "baseline_always_predict_" + GENRES[majority] + "_top1": round(baseline_top1, 3),
            "micro_f1": round(micro_f1, 3),
            "macro_f1": round(macro_f1, 3),
        },
        "per_genre": per_class,
        "trained_seconds": round(time.time() - t0, 1),
    }
    os.makedirs(os.path.dirname(REPORT_OUT), exist_ok=True)
    with open(REPORT_OUT, "w") as f:
        json.dump(report, f, indent=2)

    # ---- Export for the Node backend ----
    vocab = {w: int(i) for w, i in vec.vocabulary_.items()}
    model = {
        "type": "tfidf-logreg-ovr",
        "tokenPattern": "[a-z]{2,}",
        "genres": GENRES,
        "vocab": vocab,
        "idf": [round(float(x), 5) for x in vec.idf_],
        "coef": [[round(float(w), 4) for w in row] for row in coefs],
        "intercept": [round(b, 4) for b in intercepts],
        "metrics": report["metrics"],
        "dataset": report["dataset"],
    }
    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    with open(MODEL_OUT, "w") as f:
        json.dump(model, f, separators=(",", ":"))

    # A few fixed samples so the JS implementation can be checked for parity.
    parity = []
    for i in te[:8]:
        row = vec.transform([texts[i]])
        p = [float(1 / (1 + np.exp(-(float((row @ c)[0]) + b)))) for c, b in zip(coefs, intercepts)]
        parity.append({"text": texts[i], "probs": [round(x, 6) for x in p]})
    with open(os.path.join(ROOT, "reports", "genre_parity_samples.json"), "w") as f:
        json.dump(parity, f)

    print(json.dumps(report["metrics"], indent=2))
    print(f"Model written to {os.path.abspath(MODEL_OUT)} "
          f"({os.path.getsize(MODEL_OUT) / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
