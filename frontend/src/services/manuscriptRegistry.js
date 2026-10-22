/**
 * Real on-chain manuscript registration — calls the ManuscriptRegistry
 * smart contract (deployed to Ethereum Sepolia testnet) directly through
 * the author's own connected MetaMask wallet. The author signs and pays
 * gas themselves; nothing here holds or touches a private key.
 *
 * This is genuinely different from the backend's `/api/blockchain/*`
 * routes, which just hash-fingerprint content into MongoDB — this writes
 * to an actual public blockchain, verifiable by anyone on Etherscan.
 */
import { BrowserProvider, Contract, keccak256, toUtf8Bytes } from "ethers";
import ManuscriptRegistryABI from "../contracts/ManuscriptRegistryABI.json";
import { waitForEthereum, ensureSepoliaNetwork } from "./web3";

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "";

/**
 * Derives a stable bytes32 id from a manuscript's MongoDB _id string, so
 * the same manuscript always maps to the same on-chain identifier.
 */
export function manuscriptIdToBytes32(mongoId) {
  return keccak256(toUtf8Bytes(String(mongoId)));
}

async function getContract(needsSigner = true) {
  if (!CONTRACT_ADDRESS) {
    throw new Error("Contract not deployed yet — VITE_CONTRACT_ADDRESS is not set.");
  }
  const ethereum = await waitForEthereum();
  if (!ethereum) {
    throw new Error("MetaMask not detected. Please install it and refresh the page.");
  }
  const provider = new BrowserProvider(ethereum);

  // Nudge the user onto Sepolia if they're on a different network — writing
  // to the wrong chain would silently fail to find the contract.
  const network = await provider.getNetwork();
  if (needsSigner && network.chainId !== 11155111n) {
    await ensureSepoliaNetwork(ethereum);
  }

  const signerOrProvider = needsSigner ? await provider.getSigner() : provider;
  return new Contract(CONTRACT_ADDRESS, ManuscriptRegistryABI, signerOrProvider);
}

/**
 * Registers a manuscript on-chain for the first time. Throws if it's
 * already registered — call updateManuscriptOnChain for subsequent edits.
 * Returns the transaction hash once the transaction is mined.
 */
export async function registerManuscriptOnChain(mongoId, contentHashHex) {
  const contract = await getContract(true);
  const manuscriptId = manuscriptIdToBytes32(mongoId);
  const tx = await contract.registerManuscript(manuscriptId, contentHashHex);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, manuscriptId };
}

/**
 * Records a new content-hash snapshot for a manuscript already registered
 * on-chain by this same wallet.
 */
export async function updateManuscriptOnChain(mongoId, contentHashHex) {
  const contract = await getContract(true);
  const manuscriptId = manuscriptIdToBytes32(mongoId);
  const tx = await contract.updateManuscript(manuscriptId, contentHashHex);
  const receipt = await tx.wait();
  return { txHash: receipt.hash, manuscriptId };
}

/** Read-only: is this manuscript registered on-chain at all? */
export async function getOnChainRegistration(mongoId) {
  const contract = await getContract(false);
  const manuscriptId = manuscriptIdToBytes32(mongoId);
  const reg = await contract.registrations(manuscriptId);
  if (!reg.exists) return null;
  return { author: reg.author, registeredAt: Number(reg.registeredAt) };
}

/** Read-only: does contentHashHex match what's currently registered on-chain? */
export async function verifyManuscriptOnChain(mongoId, contentHashHex) {
  const contract = await getContract(false);
  const manuscriptId = manuscriptIdToBytes32(mongoId);
  return contract.verifyManuscript(manuscriptId, contentHashHex);
}

/** Read-only: the full on-chain version history for a manuscript. */
export async function getOnChainHistory(mongoId) {
  const contract = await getContract(false);
  const manuscriptId = manuscriptIdToBytes32(mongoId);
  const versions = await contract.getHistory(manuscriptId);
  return versions.map((v) => ({ contentHash: v.contentHash, timestamp: Number(v.timestamp) }));
}
