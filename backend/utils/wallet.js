const User = require("../models/User");
const Transaction = require("../models/Transaction");
// Module object (not destructured) so tests can replace the verifier.
const chainVerifier = require("../services/chainVerifier");

// Wallet balances live in MongoDB. A standalone mongod has no multi-document
// transactions, so every money move is built from single-document atomic
// updates: the debit only succeeds if the balance is still enough at that exact
// moment (so two parallel requests can't both spend the same money), and if a
// later step fails the earlier one is undone ("compensation").

const round = (n) => Math.round(n * 100) / 100;

// New accounts start with this balance (see the User model). Older accounts created
// before the field existed have NO stored balance at all, and the raw atomic updates
// below don't apply the model's default - so a missing balance is filled in first.
const STARTING_BALANCE = 1000;
const ensureBalance = (userId) =>
  User.updateOne({ _id: userId, walletBalance: { $exists: false } }, { $set: { walletBalance: STARTING_BALANCE } });

// Validates a money amount from a request. Returns a number, or null if invalid.
function parseAmount(raw, { max = 1_000_000 } = {}) {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0 || n > max) return null;
  return round(n);
}

// Takes `amount` from the user only if they can afford it right now.
// extraFilter / extraUpdate let a caller make another change in the same atomic step.
async function debit(userId, amount, extraFilter = {}, extraUpdate = {}) {
  await ensureBalance(userId);
  return User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: amount }, ...extraFilter },
    { $inc: { walletBalance: -amount }, ...extraUpdate },
    { new: true }
  );
}

async function credit(userId, amount, { earned = true } = {}) {
  await ensureBalance(userId); // otherwise the credit would become the whole balance
  const inc = { walletBalance: amount };
  if (earned) inc.earnings = amount;
  return User.findByIdAndUpdate(userId, { $inc: inc }, { new: true });
}

// Gives money back after a failed later step (best effort, but logged loudly).
async function refund(userId, amount, undoUpdate = {}) {
  try {
    await ensureBalance(userId);
    await User.updateOne({ _id: userId }, { $inc: { walletBalance: amount }, ...undoUpdate });
  } catch (err) {
    console.error(`CRITICAL: refund of ${amount} to ${userId} failed`, err);
  }
}

// An on-chain tx hash may back exactly one transaction record.
async function txHashAlreadyUsed(txHash) {
  return !!(await Transaction.exists({ txHash }));
}

/**
 * Decides whether a tx hash sent by the browser may be stored as an on-chain
 * proof for a payment from `senderId` to `receiverId`.
 *   { onChain: true, txHash }          - verified on Sepolia
 *   { onChain: false }                 - no hash given (off-chain, in-app only)
 *   { onChain: false, warning }        - hash given but could not be verified
 *   { rejected: "..." }                - malformed or already used -> refuse the request
 */
async function resolveChainProof(txHash, senderId, receiverId) {
  if (!txHash) return { onChain: false };
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return { rejected: "Invalid transaction hash." };
  }
  if (await txHashAlreadyUsed(txHash)) {
    return { rejected: "This transaction hash was already used for another payment." };
  }
  const [sender, receiver] = await Promise.all([
    User.findById(senderId).select("walletAddress"),
    User.findById(receiverId).select("walletAddress"),
  ]);
  const result = await chainVerifier.verifyPayment({
    txHash,
    senderAddress: sender && sender.walletAddress,
    receiverAddress: receiver && receiver.walletAddress,
  });
  if (result.verified) return { onChain: true, txHash };
  return { onChain: false, warning: `On-chain proof not accepted: ${result.reason}` };
}

module.exports = { resolveChainProof, parseAmount, debit, credit, refund, txHashAlreadyUsed, round };
