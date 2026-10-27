const { JsonRpcProvider, Interface, getAddress, isAddress } = require("ethers");

// The server never signs or sends anything. It only READS the chain to check
// that a transaction hash the browser reports is real and says what it claims.
// Without this the browser could send any made-up 0x… hash and the app would
// show a "verified on-chain" badge for it.

const PAYMENT_ABI = [
  "event PaymentMade(uint256 indexed paymentId, address indexed sender, address indexed receiver, uint256 amount, string purpose, uint256 timestamp)",
];
const REGISTRY_ABI = [
  "event ManuscriptRegistered(bytes32 indexed manuscriptId, address indexed author, bytes32 contentHash, uint256 timestamp)",
  "event ManuscriptUpdated(bytes32 indexed manuscriptId, bytes32 contentHash, uint256 timestamp)",
];

let provider;
const getProvider = () => {
  if (!process.env.SEPOLIA_RPC_URL) return null;
  if (!provider) provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL, 11155111, { staticNetwork: true });
  return provider;
};

const same = (a, b) => isAddress(a || "") && isAddress(b || "") && getAddress(a) === getAddress(b);

// Fetches a mined, successful receipt, or explains why not.
async function getReceipt(txHash) {
  const rpc = getProvider();
  if (!rpc) return { error: "not_configured", reason: "Blockchain RPC is not configured on the server." };
  let receipt;
  try {
    receipt = await rpc.getTransactionReceipt(txHash);
  } catch (err) {
    return { error: "rpc_failed", reason: "Could not reach the blockchain network." };
  }
  if (!receipt) return { error: "not_found", reason: "Transaction not found or not mined yet." };
  if (receipt.status !== 1) return { error: "reverted", reason: "Transaction failed on-chain." };
  return { receipt };
}

/**
 * Checks a PaymentLedger payment: right contract, right sender wallet, right
 * receiver wallet, and an amount that is not zero.
 * Resolves { verified, reason }.
 */
async function verifyPayment({ txHash, senderAddress, receiverAddress }) {
  const contract = process.env.PAYMENT_LEDGER_ADDRESS;
  if (!contract) return { verified: false, reason: "Payment contract address is not configured." };

  const { receipt, reason } = await getReceipt(txHash);
  if (!receipt) return { verified: false, reason };

  const iface = new Interface(PAYMENT_ABI);
  for (const log of receipt.logs) {
    if (!same(log.address, contract)) continue;
    let parsed;
    try { parsed = iface.parseLog(log); } catch { continue; }
    if (!parsed || parsed.name !== "PaymentMade") continue;
    if (same(parsed.args.sender, senderAddress) && same(parsed.args.receiver, receiverAddress) && parsed.args.amount > 0n) {
      return { verified: true, amountWei: parsed.args.amount.toString() };
    }
  }
  return { verified: false, reason: "Transaction does not match this payment (wrong contract, sender or receiver)." };
}

/**
 * Checks that `txHash` registered/updated a manuscript in OUR registry
 * contract, signed by the author's linked wallet.
 */
async function verifyRegistration({ txHash, authorAddress }) {
  const contract = process.env.MANUSCRIPT_REGISTRY_ADDRESS;
  if (!contract) return { verified: false, reason: "Registry contract address is not configured." };

  const { receipt, reason } = await getReceipt(txHash);
  if (!receipt) return { verified: false, reason };

  const iface = new Interface(REGISTRY_ABI);
  const fromAuthor = same(receipt.from, authorAddress);
  for (const log of receipt.logs) {
    if (!same(log.address, contract)) continue;
    let parsed;
    try { parsed = iface.parseLog(log); } catch { continue; }
    if (!parsed) continue;
    if (parsed.name === "ManuscriptRegistered" && same(parsed.args.author, authorAddress)) return { verified: true };
    if (parsed.name === "ManuscriptUpdated" && fromAuthor) return { verified: true };
  }
  return { verified: false, reason: "Transaction is not a registration of this manuscript by your wallet." };
}

module.exports = { verifyPayment, verifyRegistration };
