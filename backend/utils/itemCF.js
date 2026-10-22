// Item-based collaborative filtering ("readers who liked this also liked...").
//
// This is the same method that won the offline comparison on Goodbooks-10k
// (ml/train_recommender.py: HR@10 0.82 vs 0.42 for "most liked"): ratings are
// mean-centred per user, books are compared with cosine similarity over those
// centred ratings, each book keeps only its K strongest neighbours, and a
// candidate's score is how similar it is to the books the reader liked.
//
// It runs on BookConnect's OWN ratings and purchases (the Goodbooks catalogue has
// different books, so a model trained there can't be applied directly). With a
// small platform there's little data, so callers should check `hasSignal`.

const DEFAULT_K = 50;
const IMPLICIT_PURCHASE_RATING = 4; // bought but not rated: treated as a "liked"
const NEUTRAL_RATING = 3; // midpoint of the 1-5 scale

/**
 * @param {{user:string,item:string,rating:number}[]} interactions
 * @param {{k?:number}} [opts]
 */
function buildItemCF(interactions, { k = DEFAULT_K } = {}) {
  // user -> Map(item -> rating)
  const byUser = new Map();
  for (const { user, item, rating } of interactions) {
    if (!byUser.has(user)) byUser.set(user, new Map());
    byUser.get(user).set(item, rating);
  }

  // mean-centre each user's ratings; build item -> Map(user -> centred rating)
  const userMean = new Map();
  const itemVec = new Map();
  for (const [user, items] of byUser) {
    let sum = 0;
    for (const r of items.values()) sum += r;
    const mean = sum / items.size;
    userMean.set(user, mean);
    for (const [item, r] of items) {
      if (!itemVec.has(item)) itemVec.set(item, new Map());
      itemVec.get(item).set(user, r - mean);
    }
  }

  const norm = new Map();
  for (const [item, vec] of itemVec) {
    let s = 0;
    for (const v of vec.values()) s += v * v;
    norm.set(item, Math.sqrt(s));
  }

  // cosine similarity, only between items that share at least one user
  const sims = new Map(); // item -> [{item, sim}] (top k, positive only)
  const itemIds = [...itemVec.keys()];
  for (const a of itemIds) {
    const va = itemVec.get(a);
    const na = norm.get(a);
    const row = [];
    if (na > 0) {
      for (const b of itemIds) {
        if (a === b) continue;
        const nb = norm.get(b);
        if (!nb) continue;
        const vb = itemVec.get(b);
        const [small, large] = va.size <= vb.size ? [va, vb] : [vb, va];
        let dot = 0;
        for (const [user, x] of small) {
          const y = large.get(user);
          if (y !== undefined) dot += x * y;
        }
        if (dot > 0) row.push({ item: b, sim: dot / (na * nb) });
      }
    }
    row.sort((x, y) => y.sim - x.sim);
    sims.set(a, row.slice(0, k));
  }

  // Total number of users who rated 2+ books: below this there is no "taste" signal.
  let usersWithOverlap = 0;
  for (const items of byUser.values()) if (items.size >= 2) usersWithOverlap++;

  /**
   * Scores `candidates` for one user. Returns [{item, score, because}] sorted high
   * to low, where `because` is the book the user already has that contributed
   * most. Books the user already has are skipped.
   */
  function recommend(user, candidates, limit = 12) {
    const mine = byUser.get(user);
    if (!mine) return [];
    // Normally a reader's ratings are centred on their own average. With very few
    // ratings (or all the same score) that average carries no information - one
    // 5-star rating would centre to zero - so use the neutral midpoint instead.
    const values = [...mine.values()];
    const informative = values.length >= 3 && new Set(values).size > 1;
    const mean = informative ? userMean.get(user) : NEUTRAL_RATING;
    const out = [];
    for (const cand of candidates) {
      if (mine.has(cand)) continue;
      const neighbours = sims.get(cand);
      if (!neighbours) continue;
      let score = 0;
      let best = { contribution: 0, item: null };
      for (const { item, sim } of neighbours) {
        const r = mine.get(item);
        if (r === undefined) continue;
        const contribution = (r - mean) * sim;
        score += contribution;
        if (contribution > best.contribution) best = { contribution, item };
      }
      if (score > 0) out.push({ item: cand, score, because: best.item });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  return {
    recommend,
    similarTo: (item) => sims.get(item) || [],
    hasSignal: usersWithOverlap >= 2,
    stats: { users: byUser.size, items: itemVec.size, usersWithOverlap },
  };
}

module.exports = { buildItemCF, IMPLICIT_PURCHASE_RATING, DEFAULT_K };
