require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// SEPOLIA_RPC_URL / SEPOLIA_PRIVATE_KEY are read from a local .env (see
// .env.example) — never commit that file, and never share the private key
// with anyone, including in chat.
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const SEPOLIA_PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY || "";

/** @type {import("hardhat/config").HardhatUserConfig} */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // local, in-memory chain — used for tests and local development, no
      // real network or funds involved
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: SEPOLIA_PRIVATE_KEY ? [SEPOLIA_PRIVATE_KEY] : [],
      chainId: 11155111,
    },
  },
};
