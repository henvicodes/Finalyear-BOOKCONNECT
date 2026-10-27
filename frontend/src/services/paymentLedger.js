/**
 * Real on-chain P2P payments — calls the PaymentLedger smart contract
 * (deployed to Ethereum Sepolia testnet) directly through the sender's own
 * connected MetaMask wallet. In a single atomic transaction the contract
 * both forwards the real ETH to the receiver AND records the payment
 * (sender, receiver, amount, purpose, timestamp) on-chain — if the fund
 * transfer fails, the whole transaction reverts, so the money movement and
 * the ledger entry can never go out of sync. Nothing here holds or touches
 * a private key; the sender signs and pays gas themselves.
 */
import { BrowserProvider, Contract, parseEther } from "ethers";
import PaymentLedgerABI from "../contracts/PaymentLedgerABI.json";
import { waitForEthereum, ensureSepoliaNetwork } from "./web3";

export const PAYMENT_LEDGER_ADDRESS = import.meta.env.VITE_PAYMENT_LEDGER_ADDRESS || "";

async function getContract() {
  if (!PAYMENT_LEDGER_ADDRESS) {
    throw new Error("Payment contract not deployed yet — VITE_PAYMENT_LEDGER_ADDRESS is not set.");
  }
  const ethereum = await waitForEthereum();
  if (!ethereum) {
    throw new Error("MetaMask not detected. Please install it and refresh the page.");
  }
  const provider = new BrowserProvider(ethereum);

  // Nudge the user onto Sepolia if they're on a different network — sending
  // to the wrong chain would silently fail to find the contract.
  const network = await provider.getNetwork();
  if (network.chainId !== 11155111n) {
    await ensureSepoliaNetwork(ethereum);
  }

  const signer = await provider.getSigner();
  return new Contract(PAYMENT_LEDGER_ADDRESS, PaymentLedgerABI, signer);
}

/**
 * Sends real Sepolia ETH to `receiverAddress` AND records the payment
 * on-chain in one atomic transaction. Throws (and forwards no funds) if
 * the receiver is the zero address, the amount is zero, or the sender is
 * paying themselves — enforced by the contract itself, not just the UI.
 * Returns the mined transaction hash.
 */
export async function makePaymentOnChain(receiverAddress, ethAmount, purpose = "p2p_transfer", expectedSender = "") {
  const contract = await getContract();
  // The server only accepts a payment sent from the wallet linked to the user's
  // profile, so stop early (before MetaMask asks to confirm) if the selected
  // MetaMask account is a different one.
  if (expectedSender) {
    const actual = await contract.runner.getAddress();
    if (actual.toLowerCase() !== expectedSender.toLowerCase()) {
      const short = `${expectedSender.slice(0, 6)}...${expectedSender.slice(-4)}`;
      throw new Error(`MetaMask is on a different account than the one linked to your profile. Switch MetaMask to ${short} and try again.`);
    }
  }
  const value = parseEther(String(ethAmount));
  const tx = await contract.makePayment(receiverAddress, purpose, { value });
  const receipt = await tx.wait();
  return { txHash: receipt.hash };
}
