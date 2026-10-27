const rateLimit = require("express-rate-limit");

// Brute-force protection. Each limiter counts requests per IP.
// Skipped under Jest so the test suites can hit the same route many times.
const make = (windowMinutes, max, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    message: { success: false, message },
  });

// Whole API: generous, just stops floods.
const apiLimiter = make(1, 300, "Too many requests. Please slow down.");

// Login and the OTP e-mail routes: strict, these are the guessing/spam targets.
const authLimiter = make(15, 20, "Too many attempts. Please try again in a few minutes.");

// PIN set / verify and money movement.
const walletLimiter = make(15, 30, "Too many wallet requests. Please try again in a few minutes.");

module.exports = { apiLimiter, authLimiter, walletLimiter };
