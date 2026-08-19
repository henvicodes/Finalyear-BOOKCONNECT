/**
 * Wait up to 3 seconds for MetaMask to inject window.ethereum
 * (MetaMask injects asynchronously on page load)
 */
export const waitForEthereum = (timeoutMs = 3000) => {
  return new Promise((resolve) => {
    if (window.ethereum) {
      resolve(window.ethereum);
      return;
    }

    const interval = setInterval(() => {
      if (window.ethereum) {
        clearInterval(interval);
        resolve(window.ethereum);
      }
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, timeoutMs);
  });
};

export const isMetaMaskInstalled = () => {
  return typeof window !== "undefined" && Boolean(window.ethereum);
};

export const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

// A public, no-API-key Sepolia RPC — used only as a fallback so
// `wallet_addEthereumChain` has something to hand MetaMask if the user's
// wallet doesn't already know about Sepolia. This never touches our own
// Alchemy key (that's only used server-side, for deploying contracts).
const PUBLIC_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

/**
 * Makes sure the connected MetaMask wallet is on Sepolia, asking it to
 * switch. If Sepolia isn't in the wallet's network list yet (uncommon, but
 * happens on some setups), offers to add it via a public RPC first rather
 * than dead-ending with "please switch manually" — a user should never
 * need to hand-enter an RPC URL themselves to use this app.
 */
export const ensureSepoliaNetwork = async (ethereum) => {
  try {
    await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: SEPOLIA_CHAIN_ID }] });
    return;
  } catch (switchErr) {
    // 4902 = chain not added to this wallet yet.
    if (switchErr?.code === 4902) {
      try {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [PUBLIC_SEPOLIA_RPC],
            blockExplorerUrls: ["https://sepolia.etherscan.io"]
          }]
        });
        return;
      } catch {
        throw new Error("Please add the Sepolia test network to MetaMask and try again.");
      }
    }
    throw new Error("Please switch MetaMask to the Sepolia test network and try again.");
  }
};

export const connectMetaMask = async () => {
  // Wait for MetaMask to inject its provider
  const ethereum = await waitForEthereum();

  if (!ethereum) {
    throw new Error(
      "MetaMask not detected. Please install the MetaMask browser extension from https://metamask.io and refresh the page."
    );
  }

  // Check it is actually MetaMask (not another wallet)
  if (!ethereum.isMetaMask) {
    console.warn("window.ethereum exists but is not MetaMask — proceeding anyway.");
  }

  try {
    // This line triggers the MetaMask popup
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });

    if (accounts && accounts.length > 0) {
      // Listen for future account changes
      ethereum.on("accountsChanged", (newAccounts) => {
        if (newAccounts.length === 0) {
          console.log("MetaMask: user disconnected wallet.");
        }
      });
      return accounts[0];
    } else {
      throw new Error("MetaMask returned no accounts. Please unlock MetaMask and try again.");
    }
  } catch (error) {
    if (error.code === 4001) {
      // User rejected the connection request
      throw new Error("Connection rejected. Please accept the MetaMask connection request.");
    } else if (error.code === -32002) {
      // Request already pending (MetaMask popup already open)
      throw new Error("MetaMask is already open. Please check your browser's MetaMask extension popup.");
    }
    console.error("MetaMask connection error:", error);
    throw error;
  }
};

export const getConnectedAccount = async () => {
  const ethereum = await waitForEthereum(1000);
  if (!ethereum) return null;
  try {
    const accounts = await ethereum.request({ method: "eth_accounts" });
    return accounts.length > 0 ? accounts[0] : null;
  } catch (err) {
    console.error("Error getting MetaMask account:", err);
    return null;
  }
};

export const sendMetaMaskTransaction = async (toAddress, amountEth = "0.01") => {
  const ethereum = await waitForEthereum();
  if (!ethereum) {
    throw new Error("MetaMask not detected.");
  }

  const from = await getConnectedAccount();
  if (!from) {
    throw new Error("Please connect your MetaMask wallet first.");
  }

  const valueHex = "0x" + Math.round(parseFloat(amountEth) * 1e18).toString(16);

  const txParams = {
    from,
    to: toAddress || "0x0000000000000000000000000000000000000000",
    value: valueHex,
    gas: "0x5208", // 21000 gas limit for simple transfers
  };

  try {
    const txHash = await ethereum.request({
      method: "eth_sendTransaction",
      params: [txParams],
    });
    return txHash;
  } catch (error) {
    if (error.code === 4001) {
      throw new Error("Transaction rejected. Please confirm the transaction in MetaMask.");
    }
    console.error("MetaMask transaction failed:", error);
    throw error;
  }
};
