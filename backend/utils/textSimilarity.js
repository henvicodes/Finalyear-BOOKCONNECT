/**
 * Shared TF-IDF + cosine similarity utilities — plain JS, no external ML
 * dependencies. Used by the recommendation engine, reader/writer matching,
 * and plagiarism detection, so the same well-understood algorithm backs
 * every "AI-powered" similarity feature instead of three different
 * ad-hoc heuristics.
 */

// A small, standard English stopword list — common words that carry
// little topical signal and would otherwise dominate term frequency.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has",
  "he", "in", "is", "it", "its", "of", "on", "that", "the", "to", "was",
  "were", "will", "with", "this", "but", "or", "not", "have", "had",
  "his", "her", "she", "they", "them", "their", "you", "your", "we",
  "our", "i", "my", "me", "so", "if", "than", "then", "there", "here",
  "who", "what", "when", "where", "why", "how", "all", "each", "into",
  "about", "up", "out", "over", "under", "again", "can", "just", "also",
]);

/**
 * Lowercase, strip punctuation, split into words, drop stopwords/short tokens.
 */
function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Term frequency for one document's tokens, normalized by document length
 * so long and short documents are comparable.
 */
function computeTF(tokens) {
  const tf = {};
  if (tokens.length === 0) return tf;
  for (const term of tokens) {
    tf[term] = (tf[term] || 0) + 1;
  }
  for (const term in tf) {
    tf[term] = tf[term] / tokens.length;
  }
  return tf;
}

/**
 * Inverse document frequency across a corpus of tokenized documents.
 * Smoothed (+1) so terms appearing in every document still get a small
 * non-zero weight instead of being zeroed out.
 */
function computeIDF(tokenizedDocs) {
  const df = {};
  const n = tokenizedDocs.length;
  for (const tokens of tokenizedDocs) {
    const seen = new Set(tokens);
    for (const term of seen) {
      df[term] = (df[term] || 0) + 1;
    }
  }
  const idf = {};
  for (const term in df) {
    idf[term] = Math.log(n / df[term]) + 1;
  }
  return idf;
}

/**
 * Build a sparse TF-IDF vector (term -> weight) for one document's tokens
 * against a precomputed IDF table.
 */
function tfidfVector(tokens, idf) {
  const tf = computeTF(tokens);
  const vector = {};
  for (const term in tf) {
    if (idf[term]) {
      vector[term] = tf[term] * idf[term];
    }
  }
  return vector;
}

/**
 * Cosine similarity between two sparse vectors (plain objects of term -> weight).
 * Returns a value in [0, 1] (both inputs are non-negative TF-IDF weights).
 */
function cosineSimilarity(vecA, vecB) {
  const keysA = Object.keys(vecA);
  const keysB = Object.keys(vecB);
  if (keysA.length === 0 || keysB.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const key of keysA) normA += vecA[key] * vecA[key];
  for (const key of keysB) normB += vecB[key] * vecB[key];

  const shorter = keysA.length < keysB.length ? keysA : keysB;
  const other = shorter === keysA ? vecB : vecA;
  for (const key of shorter) {
    if (other[key]) dot += (shorter === keysA ? vecA : vecB)[key] * other[key];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Convenience: given a list of raw text documents, build TF-IDF vectors for
 * all of them against their own shared corpus (used when comparing many
 * documents against each other, e.g. plagiarism scanning or book similarity).
 */
function buildCorpusVectors(texts) {
  const tokenizedDocs = texts.map(tokenize);
  const idf = computeIDF(tokenizedDocs);
  return tokenizedDocs.map((tokens) => tfidfVector(tokens, idf));
}

module.exports = {
  tokenize,
  computeTF,
  computeIDF,
  tfidfVector,
  cosineSimilarity,
  buildCorpusVectors,
};
