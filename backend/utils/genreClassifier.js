const path = require("path");

// Scores text with the genre classifier trained by ml/train_genre_classifier.py
// (TF-IDF + one-vs-rest logistic regression on the CMU Book Summary Dataset).
// The model is just vocabulary + idf + weights in a JSON file, so no Python or
// ML runtime is needed here — this reproduces sklearn's math exactly:
//   tokens -> 1+ln(count) -> * idf -> L2-normalise -> w·x + b -> sigmoid

let model = null;

function loadModel() {
  if (!model) {
    model = require(path.join(__dirname, "..", "ml", "genre_classifier.json"));
  }
  return model;
}

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

// Returns every genre with its probability (0-1), highest first.
function scoreGenres(text) {
  const m = loadModel();

  const counts = new Map();
  for (const token of (text || "").toLowerCase().match(/[a-z]{2,}/g) || []) {
    const idx = m.vocab[token];
    if (idx !== undefined) counts.set(idx, (counts.get(idx) || 0) + 1);
  }

  // Sparse tf-idf vector, L2-normalised.
  const weights = new Map();
  let normSq = 0;
  for (const [idx, count] of counts) {
    const w = (1 + Math.log(count)) * m.idf[idx];
    weights.set(idx, w);
    normSq += w * w;
  }
  const norm = Math.sqrt(normSq) || 1;

  return m.genres
    .map((genre, g) => {
      let z = m.intercept[g];
      for (const [idx, w] of weights) z += (w / norm) * m.coef[g][idx];
      return { genre, probability: sigmoid(z) };
    })
    .sort((a, b) => b.probability - a.probability);
}

// Number of in-vocabulary words — a cheap signal for "was there enough text
// for the prediction to mean anything?".
function knownWordCount(text) {
  const m = loadModel();
  return ((text || "").toLowerCase().match(/[a-z]{2,}/g) || []).filter((t) => m.vocab[t] !== undefined).length;
}

function getModelInfo() {
  const m = loadModel();
  return { genres: m.genres, metrics: m.metrics, dataset: m.dataset };
}

module.exports = { scoreGenres, knownWordCount, getModelInfo };
