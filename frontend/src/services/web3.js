/**
 * Wait up to 3 seconds for MetaMask to inject window.ethereum
 * (MetaMask injects asynchronously on page load)
 */
const waitForEthereum = (timeoutMs = 3000) => {
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
