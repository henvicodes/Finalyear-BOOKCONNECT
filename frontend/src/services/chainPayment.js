import { isAddress } from "ethers";
import { makePaymentOnChain, PAYMENT_LEDGER_ADDRESS } from "./paymentLedger";

// $1 of in-app balance = 0.0001 test ETH on Sepolia.
export const USD_TO_ETH = 0.0001;

export const walletOf = (person) => person?.blockchainWallet?.address || person?.walletAddress || "";

/**
 * Pays through the PaymentLedger smart contract, but only when it can be done
 * properly: the contract is deployed AND both people have linked a real wallet.
 * Otherwise it returns no hash and the payment stays in-app (off-chain) —
 * it never sends money to a placeholder / burn address.
 * Throws if the user rejects or fails the MetaMask transaction.
 */
export async function payOnChainIfLinked({ payer, receiver, amountUsd, purpose }) {
  const from = walletOf(payer);
  const to = walletOf(receiver);
  if (!PAYMENT_LEDGER_ADDRESS || !(amountUsd > 0) || !isAddress(from) || !isAddress(to)) {
    return { txHash: "", onChain: false };
  }
  // Same wallet on both sides (one MetaMask account linked to two accounts): the
  // contract rejects paying yourself, so skip the chain and keep it in-app.
  if (from.toLowerCase() === to.toLowerCase()) {
    return { txHash: "", onChain: false, reason: "same-wallet" };
  }
  const { txHash } = await makePaymentOnChain(to, (amountUsd * USD_TO_ETH).toFixed(5), purpose, from);
  return { txHash, onChain: true };
}
