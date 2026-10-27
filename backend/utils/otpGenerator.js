const crypto = require("crypto");

const MAX_OTP_ATTEMPTS = 5;

const generateOTP = () => {
  return crypto.randomInt(100000, 1000000).toString(); // 6 digits: 100000-999999
};

const generateOTPExpiry = (minutes = 10) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

// Only a SHA-256 hash of the code is stored, so a database leak doesn't hand
// out valid codes. (The code is short-lived and limited to a few attempts, so a
// fast hash is enough here — bcrypt is for long-lived secrets like passwords.)
const hashOTP = (code) => crypto.createHash("sha256").update(String(code)).digest("hex");

// Constant-time comparison, so response timing can't leak how much matched.
const otpMatches = (storedHash, candidate) => {
  if (!storedHash || !candidate) return false;
  const a = Buffer.from(storedHash, "hex");
  const b = Buffer.from(hashOTP(candidate), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = { generateOTP, generateOTPExpiry, hashOTP, otpMatches, MAX_OTP_ATTEMPTS };
