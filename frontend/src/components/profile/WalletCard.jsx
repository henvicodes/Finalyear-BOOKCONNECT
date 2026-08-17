import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Wallet,
  CheckCircle,
  Eye,
  EyeOff,
  History,
  Send,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { connectMetaMask, getConnectedAccount, isMetaMaskInstalled, sendMetaMaskTransaction } from "../../services/web3";
import { useAuth } from "../../context/AuthContext";
import WalletPinModal from "../WalletPinModal";
import "../../styles/ProfilePage.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const WalletCard = ({ user }) => {
  const { updateUserFields } = useAuth();
  const [walletAddress, setWalletAddress] = useState(user?.blockchainWallet?.address || "");
  const [isLinked, setIsLinked] = useState(user?.blockchainWallet?.isLinked || false);
  const [connecting, setConnecting] = useState(false);
  const [showBalance, setShowBalance] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [txHistoryOpen, setTxHistoryOpen] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [loadingTxs, setLoadingTxs] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferData, setTransferData] = useState({ receiverId: "", amount: "", note: "" });
  const [transferring, setTransferring] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [pinAction, setPinAction] = useState("reveal"); // "reveal" or "transfer"

  const [connectError, setConnectError] = useState("");
  const [metamaskInstalled, setMetamaskInstalled] = useState(true);

  const token = user?.token || localStorage.getItem("token");

  // Auto-detect MetaMask on mount and restore connected account
  useEffect(() => {
    const autoDetect = async () => {
      if (user?.blockchainWallet?.address) {
        setWalletAddress(user.blockchainWallet.address);
        setIsLinked(user.blockchainWallet.isLinked);
      }

      // Check MetaMask installed
      if (!isMetaMaskInstalled()) {
        setMetamaskInstalled(false);
        return;
      }

      // Auto-reconnect if already authorized
      const existing = await getConnectedAccount();
      if (existing && !isLinked) {
        setWalletAddress(existing);
      }
    };
    autoDetect();
  }, [user]);

  // Handle MetaMask connection
  const handleConnectMetaMask = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      // connectMetaMask now waits for MetaMask injection and opens popup
      const address = await connectMetaMask();
      setWalletAddress(address);

      // Save address to backend
      const { data } = await axios.post(
        `${BASE_URL}/api/auth/link-wallet`,
        { walletAddress: address },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        setIsLinked(true);
        updateUserFields({
          blockchainWallet: { address, isLinked: true },
          walletAddress: address
        });
      }
    } catch (err) {
      console.error("Link wallet error:", err);
      setConnectError(err.message || "Failed to connect MetaMask. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleRevealBalanceClick = () => {
    if (showBalance) {
      setShowBalance(false);
    } else {
      setPinAction("reveal");
      setPinModalOpen(true);
    }
  };

  const handleSearchChange = async (query) => {
    setSearchQuery(query);
    if (!query) {
      setSearchResults([]);
      return;
    }
    try {
      const { data } = await axios.get(`${BASE_URL}/api/auth/search?q=${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setSearchResults(data.data.filter(u => u._id !== user?._id));
      }
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const handleInitiateTransfer = () => {
    const amt = parseFloat(transferData.amount);
    if (isNaN(amt) || amt <= 0) return alert("Please enter a valid amount.");
    if (amt > (user?.walletBalance || 0)) return alert("Insufficient balance.");
    setPinAction("transfer");
    setPinModalOpen(true);
  };

  const handlePinSuccess = async (pin) => {
    setPinModalOpen(false);
    if (pinAction === "reveal") {
      setShowBalance(true);
    } else if (pinAction === "transfer") {
      setTransferring(true);
      try {
        const recipientAddr = selectedRecipient.blockchainWallet?.address || selectedRecipient.walletAddress || "0x0000000000000000000000000000000000000000";
        const ethVal = (parseFloat(transferData.amount) * 0.0001).toFixed(5);
        
        let txHash = "";
        try {
          txHash = await sendMetaMaskTransaction(recipientAddr, ethVal);
        } catch (metamaskErr) {
          throw new Error("MetaMask transfer rejected/failed: " + metamaskErr.message);
        }

        const { data } = await axios.post(
          `${BASE_URL}/api/blockchain/transfer`,
          {
            receiverId: selectedRecipient._id,
            amount: transferData.amount,
            pin,
            note: transferData.note || "Web3 P2P Payment Transfer",
            txHash
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success) {
          alert(`Successfully sent $${transferData.amount} (tx: ${txHash.slice(0, 10)}...) to ${selectedRecipient.name}`);
          updateUserFields({ walletBalance: data.senderWalletBalance });
          setTransferModalOpen(false);
          setSelectedRecipient(null);
          setTransferData({ receiverId: "", amount: "", note: "" });
          fetchTransactions();
        }
      } catch (err) {
        alert(err.message || "Transfer failed.");
        console.error(err);
      } finally {
        setTransferring(false);
      }
    }
  };

  const fetchTransactions = async () => {
    setLoadingTxs(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/blockchain/transactions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setTransactions(data.data);
      }
    } catch (err) {
      console.error("Fetch transactions error:", err);
    } finally {
      setLoadingTxs(false);
    }
  };

  const handleOpenTxHistory = () => {
    setTxHistoryOpen(true);
    fetchTransactions();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {/* Wallet Card Main */}
      <div
        className={`wallet-card ${isLinked ? "wallet-card--linked" : ""}`}
        style={{
          background: isLinked ? "#ecfdf5" : "#faf8ff",
          border: isLinked ? "1px solid #a7f3d0" : "1px solid #ede9fe",
          borderRadius: 16,
          padding: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16
        }}
      >
        <div className="wallet-card-left" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: isLinked ? "#d1fae5" : "#f3f0ff",
            color: isLinked ? "#059669" : "#7c3aed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Wallet size={24} />
          </div>
          <div>
            <span className="wallet-label" style={{ fontSize: 15, fontWeight: "bold", color: "#1a1a2e", display: "block" }}>
              {isLinked ? "MetaMask Wallet Connected" : "No Crypto Wallet Linked"}
            </span>
            <span className="wallet-sub" style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>
              {isLinked ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}` : "Connect MetaMask for Web3 transactions"}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Hide/Show Balance Toggle */}
          <button
            onClick={handleRevealBalanceClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "#ffffff",
              border: "1px solid #ede9fe",
              borderRadius: 10,
              fontSize: 12,
              fontWeight: 600,
              color: "#1e293b",
              cursor: "pointer",
              fontFamily: "'Sora', sans-serif"
            }}
          >
            {showBalance ? <EyeOff size={14} color="#64748b" /> : <Eye size={14} color="#7c3aed" />}
            <span>{showBalance ? `$${(user?.walletBalance || 1000).toFixed(2)}` : "$ ••••••"}</span>
          </button>

          {/* Connect / Connected Status */}
          {isLinked ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#059669", fontSize: 12, fontWeight: "bold" }}>
              <CheckCircle size={18} />
              <span>Verified</span>
            </div>
          ) : !metamaskInstalled ? (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 14px",
                background: "#f6851b",
                color: "#fff",
                borderRadius: 10,
                fontWeight: "bold",
                fontSize: 12,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              🦊 Install MetaMask
            </a>
          ) : (
            <button
              onClick={handleConnectMetaMask}
              disabled={connecting}
              style={{
                padding: "8px 16px",
                background: connecting ? "#94a3b8" : "linear-gradient(135deg, #f6851b 0%, #e2761b 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: "bold",
                fontSize: 12,
                cursor: connecting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "'Sora', sans-serif"
              }}
            >
              {connecting ? (
                <><span>⏳</span><span>Opening MetaMask...</span></>
              ) : (
                <><span>🦊</span><span>Connect MetaMask</span></>
              )}
            </button>
          )}

          {/* Transaction History Button */}
          <button
            onClick={handleOpenTxHistory}
            style={{
              padding: "8px 12px",
              background: "#ffffff",
              border: "1px solid #ede9fe",
              borderRadius: 10,
              color: "#475569",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Sora', sans-serif"
            }}
          >
            <History size={14} />
            <span>History</span>
          </button>

          {/* P2P Send / Transfer Button */}
          <button
            onClick={() => {
              if (!isLinked) {
                alert("Please link your MetaMask wallet first to authorize Web3 P2P transactions.");
                return;
              }
              setTransferModalOpen(true);
            }}
            style={{
              padding: "8px 12px",
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
              border: "none",
              borderRadius: 10,
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "'Sora', sans-serif"
            }}
          >
            <Send size={14} />
            <span>Send</span>
          </button>
        </div>
      </div>

      {/* P2P Transfer Modal */}
      {transferModalOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 20,
            width: "100%",
            maxWidth: 420,
            padding: 28,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            position: "relative",
            color: "#f8fafc",
            fontFamily: "'Sora', sans-serif"
          }}>
            {/* Header */}
            <button
              onClick={() => {
                setTransferModalOpen(false);
                setSearchQuery("");
                setSearchResults([]);
                setSelectedRecipient(null);
                setTransferData({ receiverId: "", amount: "", note: "" });
              }}
              style={{
                position: "absolute",
                top: 18,
                right: 18,
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer"
              }}
            >
              <X size={20} />
            </button>

            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{
                width: 54,
                height: 54,
                borderRadius: "50%",
                background: "rgba(124, 58, 237, 0.15)",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 12px",
                color: "#a78bfa"
              }}>
                <Send size={24} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0" }}>Web3 P2P Balance Transfer</h3>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Transfer funds securely to another author, reader, or publisher.</p>
            </div>

            {/* Recipient Search or Display */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>Search Recipient</label>
              {!selectedRecipient ? (
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Enter name or email..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: 10,
                      color: "#f8fafc",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                  {searchResults.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#1e293b",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: 10,
                      marginTop: 6,
                      maxHeight: 180,
                      overflowY: "auto",
                      zIndex: 10
                    }}>
                      {searchResults.map((r) => (
                        <div
                          key={r._id}
                          onClick={() => {
                            setSelectedRecipient(r);
                            setTransferData(prev => ({ ...prev, receiverId: r._id }));
                            setSearchResults([]);
                            setSearchQuery("");
                          }}
                          style={{
                            padding: "10px 14px",
                            cursor: "pointer",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                            display: "flex",
                            alignItems: "center",
                            gap: 10
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                        >
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "#7c3aed",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: "bold",
                            color: "#fff"
                          }}>
                            {r.profilePicture && r.profilePicture !== "default-avatar.png" ? (
                              <img src={r.profilePicture} alt={r.name} style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
                            ) : (
                              r.name[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <span style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{r.name}</span>
                            <span style={{ display: "block", fontSize: 10, color: "#94a3b8" }}>{r.email} • {r.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  background: "rgba(124, 58, 237, 0.08)",
                  border: "1px solid rgba(124, 58, 237, 0.2)",
                  padding: "10px 14px",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: "bold",
                      color: "#fff"
                    }}>
                      {selectedRecipient.profilePicture && selectedRecipient.profilePicture !== "default-avatar.png" ? (
                        <img src={selectedRecipient.profilePicture} alt={selectedRecipient.name} style={{ width: "100%", height: "100%", borderRadius: "50%" }} />
                      ) : (
                        selectedRecipient.name[0].toUpperCase()
                      )}
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{selectedRecipient.name}</span>
                      <span style={{ display: "block", fontSize: 10, color: "#a78bfa" }}>{selectedRecipient.role}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedRecipient(null)}
                    style={{ background: "none", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Amount input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>Amount ($)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="Enter USD amount..."
                value={transferData.amount}
                onChange={(e) => setTransferData(prev => ({ ...prev, amount: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 10,
                  color: "#f8fafc",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>

            {/* Note input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#cbd5e1", marginBottom: 6 }}>Note (Optional)</label>
              <input
                type="text"
                placeholder="Add a memo..."
                value={transferData.note}
                onChange={(e) => setTransferData(prev => ({ ...prev, note: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: 10,
                  color: "#f8fafc",
                  fontSize: 14,
                  outline: "none"
                }}
              />
            </div>

            <button
              onClick={handleInitiateTransfer}
              disabled={transferring || !selectedRecipient || !transferData.amount}
              style={{
                width: "100%",
                padding: "12px",
                background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontWeight: "bold",
                fontSize: 14,
                cursor: transferring || !selectedRecipient || !transferData.amount ? "not-allowed" : "pointer",
                opacity: transferring || !selectedRecipient || !transferData.amount ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {transferring ? "Processing Transfer..." : "Send Transfer"}
            </button>
          </div>
        </div>
      )}

      {/* Connection Error Banner */}
      {connectError && (
        <div style={{
          background: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          color: "#ef4444",
          display: "flex",
          alignItems: "flex-start",
          gap: 8
        }}>
          <span>⚠️</span>
          <div>
            <strong>Connection Failed:</strong> {connectError}
            {connectError.includes("already open") && (
              <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                Look for the 🦊 MetaMask icon in your browser toolbar and click it to open the popup.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Wallet Linked Success Banner */}
      {isLinked && walletAddress && (
        <div style={{
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          color: "#10b981",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <CheckCircle size={16} />
          <span>
            🦊 MetaMask wallet connected: <strong style={{ fontFamily: "monospace" }}>{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</strong>
          </span>
        </div>
      )}

      {/* PIN Authorization Modal */}
      <WalletPinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSuccess={handlePinSuccess}
        token={token}
        title={pinAction === "reveal" ? "Enter Security PIN to Reveal Balance" : "Enter PIN to Authorize P2P Transfer"}
      />

      {/* Transaction History Modal */}
      {txHistoryOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.75)",
          backdropFilter: "blur(8px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        }}>
          <div style={{
            background: "#1e293b",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 20,
            width: "100%",
            maxWidth: 540,
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            position: "relative",
            color: "#f8fafc",
            fontFamily: "'Sora', sans-serif",
            overflow: "hidden"
          }}>
            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <History size={20} color="#a78bfa" />
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Web3 Transaction Ledger</h3>
              </div>
              <button onClick={() => setTxHistoryOpen(false)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Content List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {loadingTxs ? (
                <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "#64748b" }}>No Web3 transactions found yet.</div>
              ) : (
                transactions.map((tx) => {
                  const isSender = tx.sender?._id === user?._id;
                  const partner = isSender ? tx.receiver : tx.sender;

                  return (
                    <div
                      key={tx._id}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: isSender ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                          color: isSender ? "#ef4444" : "#10b981",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}>
                          {isSender ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                        </div>
                        <div>
                          <span style={{ display: "block", fontSize: 13, fontWeight: "bold", color: "#f8fafc" }}>
                            {isSender ? `Sent to ${partner?.name || "User"}` : `Received from ${partner?.name || "User"}`}
                          </span>
                          <span style={{ display: "block", fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
                            Tx: {tx.txHash ? `${tx.txHash.slice(0, 14)}...` : "0x..."}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "block", fontSize: 14, fontWeight: "bold", color: isSender ? "#ef4444" : "#10b981" }}>
                          {isSender ? `- $${tx.amount.toFixed(2)}` : `+ $${tx.amount.toFixed(2)}`}
                        </span>
                        <span style={{ display: "block", fontSize: 10, color: "#64748b" }}>
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletCard;
