// Removes MongoDB operator keys ("$where", "$ne"...) and dotted keys from request
// bodies, queries and params, so a client can't smuggle a query operator in where
// a plain value is expected (NoSQL injection, e.g. {"email": {"$ne": null}}).
// Written inline (rather than a package) because Express 5 makes req.query read-only.
const clean = (value) => {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".")) continue;
      out[key] = clean(val);
    }
    return out;
  }
  return value;
};

const sanitizeBody = (req, res, next) => {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params);
  next();
};

// Query strings: Express 5 exposes req.query as a getter, so check instead of rewrite.
const rejectBadQuery = (req, res, next) => {
  const bad = (value) =>
    value && typeof value === "object" &&
    Object.entries(value).some(([k, v]) => k.startsWith("$") || k.includes(".") || bad(v));
  if (bad(req.query)) {
    return res.status(400).json({ success: false, message: "Invalid query." });
  }
  next();
};

module.exports = { sanitizeBody, rejectBadQuery, clean };
