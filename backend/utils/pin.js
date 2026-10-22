const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Wallet-PIN handling: the PIN is stored as a bcrypt hash (like a password)
// and wrong guesses are counted atomically, so 4 digits (10,000 combinations)
// can't simply be brute-forced.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

const isHash = (value) => typeof value === "string" && /^\$2[aby]\$/.test(value);

async function hashPin(pin) {
  return bcrypt.hash(String(pin), 10);
}

/**
 * Checks `pin` against the user's stored PIN.
 * Returns { ok, hasPin, locked, retryAfterSec, attemptsLeft }.
 * Plain-text PINs from older accounts are accepted once and upgraded to a hash.
 */
async function checkPin(userId, pin) {
  const user = await User.findById(userId).select("+walletPin");
  if (!user || !user.walletPin) return { ok: false, hasPin: false };

  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    return {
      ok: false, hasPin: true, locked: true,
      retryAfterSec: Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 1000),
    };
  }

  const candidate = String(pin || "");
  let match;
  if (isHash(user.walletPin)) {
    match = await bcrypt.compare(candidate, user.walletPin);
  } else {
    match = user.walletPin === candidate; // legacy plain-text PIN
  }

  if (match) {
    const update = { pinFailedAttempts: 0, pinLockedUntil: null };
    if (!isHash(user.walletPin)) update.walletPin = await hashPin(candidate);
    await User.updateOne({ _id: userId }, { $set: update });
    return { ok: true, hasPin: true };
  }

  // Count the failure atomically ($inc) so parallel guesses can't dodge the limit.
  const updated = await User.findByIdAndUpdate(userId, { $inc: { pinFailedAttempts: 1 } }, { new: true });
  if (updated.pinFailedAttempts >= MAX_ATTEMPTS) {
    await User.updateOne(
      { _id: userId },
      { $set: { pinFailedAttempts: 0, pinLockedUntil: new Date(Date.now() + LOCK_MINUTES * 60 * 1000) } }
    );
    return { ok: false, hasPin: true, locked: true, retryAfterSec: LOCK_MINUTES * 60 };
  }
  return { ok: false, hasPin: true, attemptsLeft: MAX_ATTEMPTS - updated.pinFailedAttempts };
}

async function setPin(userId, pin) {
  await User.updateOne(
    { _id: userId },
    { $set: { walletPin: await hashPin(pin), pinFailedAttempts: 0, pinLockedUntil: null } }
  );
}

// Shapes a failed checkPin() result into an HTTP response.
function pinFailureResponse(res, result) {
  if (!result.hasPin) {
    return res.status(400).json({ success: false, hasPin: false, message: "No PIN set yet. Please set your 4-digit Security PIN." });
  }
  if (result.locked) {
    const minutes = Math.ceil(result.retryAfterSec / 60);
    return res.status(429).json({
      success: false, hasPin: true, locked: true,
      message: `Too many wrong PIN attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }
  return res.status(400).json({
    success: false, hasPin: true,
    message: `Incorrect PIN code. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.`,
  });
}

module.exports = { checkPin, setPin, hashPin, pinFailureResponse, MAX_ATTEMPTS };
