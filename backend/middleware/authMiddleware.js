const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { COOKIE_NAME, CSRF_HEADER, CSRF_VALUE } = require("../utils/authCookie");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// The browser app authenticates with an httpOnly cookie; scripts, tests and
// other API clients may still send "Authorization: Bearer <jwt>".
// Returns { token, fromCookie } or null.
const readToken = (req) => {
  const cookieToken = req.cookies && req.cookies[COOKIE_NAME];
  if (cookieToken) return { token: cookieToken, fromCookie: true };
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer")) {
    const token = header.split(" ")[1];
    if (token) return { token, fromCookie: false };
  }
  return null;
};

// A request that is authorised only by a cookie (which the browser adds on its
// own, even for requests started by another website) must prove it came from our
// app on anything that changes data.
const failsCsrf = (req, fromCookie) =>
  fromCookie && !SAFE_METHODS.has(req.method) && req.headers[CSRF_HEADER] !== CSRF_VALUE;

const protect = async (req, res, next) => {
  const found = readToken(req);
  if (!found) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, no token",
    });
  }

  if (failsCsrf(req, found.fromCookie)) {
    return res.status(403).json({ success: false, message: "Blocked: missing request header." });
  }

  try {
    const decoded = jwt.verify(found.token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password");

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized",
    });
  }
};

// Like `protect`, but never rejects the request for a missing/invalid
// token — it just leaves req.user unset. For routes that are public for
// some content (e.g. free books) but need to know who's asking in order
// to gate other content (e.g. paid books) without forcing a login wall.
const optionalAuth = async (req, res, next) => {
  const found = readToken(req);
  if (found) {
    try {
      const decoded = jwt.verify(found.token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
    } catch {
      // Invalid/expired token — proceed as anonymous instead of failing.
    }
  }
  next();
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized to access this route`,
      });
    }
    next();
  };
};

module.exports = { protect, authorize, optionalAuth, readToken };
