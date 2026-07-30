import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, Clock, Shield, CheckCircle, RefreshCw, AlertCircle, DollarSign } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const ChatInterface = ({ user, currentRole, token }) => {
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [proposeCostOpen, setProposeCostOpen] = useState(false);
  const [proposedCost, setProposedCost] = useState("");
  const [currentBook, setCurrentBook] = useState(null);

  const messagesEndRef = useRef(null);

  // Keep a ref of the current messages to compare in polling and prevent scroll resetting/jumping
  const messagesRef = useRef([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // 1. Fetch contacts on mount
  useEffect(() => {
    fetchContacts();
  }, []);

  // 2. Fetch messages when contact changes + set up real-time polling (like WhatsApp)
  useEffect(() => {
    if (selectedContact) {
      // First load shows spinner
      fetchMessages(selectedContact._id, false);

      // Poll every 3 seconds silently in the background
      const interval = setInterval(() => {
        fetchMessages(selectedContact._id, true);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [selectedContact]);

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/auth/search?q=@`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        let filtered = [];
        if (currentRole === "author") {
          // Authors can chat with both Publishers and Readers
          filtered = data.data.filter(u => u.role === "publisher" || u.role === "reader");
        } else if (currentRole === "publisher") {
          // Publishers chat with Authors
          filtered = data.data.filter(u => u.role === "author");
        } else if (currentRole === "reader") {
          // Readers chat with Authors
          filtered = data.data.filter(u => u.role === "author");
        }
        setContacts(filtered);
        if (filtered.length > 0) {
          setSelectedContact(filtered[0]);
        }
      }
    } catch (err) {
      console.error("Fetch contacts error:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchMessages = async (contactId, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/messages/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        // Only update state if new messages arrived to prevent unnecessary re-renders and scroll-jumping
        const isDifferent = JSON.stringify(data.data) !== JSON.stringify(messagesRef.current);
        if (isDifferent) {
          setMessages(data.data);
          // Find if there's an associated book in the chat
          const systemMsg = data.data.find(m => m.book);
          if (systemMsg) {
            setCurrentBook(systemMsg.book);
          } else {
            setCurrentBook(null);
          }
        }
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedContact) return;

    setSending(true);
    try {
      const payload = {
        receiverId: selectedContact._id,
        content: inputValue.trim(),
        bookId: currentBook?._id || null
      };

      const { data } = await axios.post(`${BASE_URL}/api/messages`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (data.success) {
        setMessages(prev => [...prev, data.data]);
        setInputValue("");
      }
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  // Publisher Proposes Cost
  const handleProposeCostSubmit = async (e) => {
    e.preventDefault();
    if (!proposedCost || !selectedContact || !currentBook) return;

    try {
      // 1. Propose cost on backend
      const res = await axios.post(
        `${BASE_URL}/api/manuscripts/${currentBook._id}/propose-cost`,
        { cost: parseFloat(proposedCost) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        alert(`Proposed publishing fee of $${proposedCost} sent!`);
        setProposedCost("");
        setProposeCostOpen(false);
        fetchMessages(selectedContact._id);
      }
    } catch (err) {
      alert("Error proposing cost. Make sure the manuscript status is eligible.");
      console.error(err);
    }
  };

  // Author Pays Cost
  const handlePayCost = async (bookId) => {
    if (!window.confirm("Confirm Web3 escrow payout transaction of proposed cost?")) return;
    try {
      const res = await axios.post(
        `${BASE_URL}/api/manuscripts/${bookId}/pay-cost`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert("Payment verified on Blockchain ledger. Book published successfully!");
        fetchMessages(selectedContact._id);
      }
    } catch (err) {
      alert("Error processing payment.");
      console.error(err);
    }
  };

  return (
    <div className="messages-layout" style={{ display: "flex", gap: 20, height: "100%" }}>
      {/* Contact List Sidepane */}
      <div className="glass-panel" style={{ width: 280, display: "flex", flexDirection: "column", padding: 0 }}>
        <div style={{ padding: 20, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 style={{ fontSize: 16 }}>Negotiations Chat</h3>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loadingContacts ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
              <RefreshCw className="animate-spin" size={16} />
            </div>
          ) : contacts.length === 0 ? (
            <p style={{ fontSize: 12, color: "#94a3b8", padding: 20 }}>No chat contacts found.</p>
          ) : (
            contacts.map((c) => (
              <div
                key={c._id}
                onClick={() => setSelectedContact(c)}
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  background: selectedContact?._id === c._id ? "rgba(255,255,255,0.03)" : "transparent",
                  borderLeft: selectedContact?._id === c._id ? `3px solid ${currentRole === "author" ? "#7c3aed" : currentRole === "reader" ? "#059669" : "#0369a1"}` : "3px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: 12
                }}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: c.role === "publisher" ? "#0369a1" : c.role === "author" ? "#7c3aed" : "#059669",
                  display: "flex",
                  alignItems: "center",
                  justify: "center",
                  fontSize: 14,
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  <span style={{ margin: "auto" }}>{c.name[0]?.toUpperCase()}</span>
                </div>
                <div style={{ overflow: "hidden" }}>
                  <span style={{ display: "block", fontSize: 13, fontWeight: "bold", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{c.name}</span>
                  <span style={{ display: "block", fontSize: 10, color: "#94a3b8", textTransform: "capitalize" }}>{c.role}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Thread */}
      <div className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0 }}>
        {selectedContact ? (
          <>
            {/* Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justify: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: selectedContact.role === "publisher" ? "#0369a1" : selectedContact.role === "author" ? "#7c3aed" : "#059669",
                  display: "flex",
                  alignItems: "center",
                  color: "#fff",
                  fontWeight: "bold"
                }}>
                  <span style={{ margin: "auto" }}>{selectedContact.name[0]?.toUpperCase()}</span>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: 14, fontWeight: "bold" }}>{selectedContact.name}</span>
                  <span style={{ display: "block", fontSize: 10, color: "#10b981" }}>Negotiation Open</span>
                </div>
              </div>

              {/* Publisher: Propose Cost Action */}
              {currentRole === "publisher" && currentBook && currentBook.status !== "published" && (
                <button
                  onClick={() => setProposeCostOpen(!proposeCostOpen)}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(3, 105, 161, 0.1)",
                    color: "#0369a1",
                    border: "1px solid rgba(3, 105, 161, 0.2)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <DollarSign size={14} /> Propose Cost
                </button>
              )}
            </div>

            {/* Cost Proposal Form modal panel */}
            {proposeCostOpen && (
              <div style={{ padding: 16, background: "rgba(3, 105, 161, 0.08)", borderBottom: "1px solid rgba(3, 105, 161, 0.15)" }}>
                <form onSubmit={handleProposeCostSubmit} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#0369a1" }}>Proposed Publishing Fee ($):</span>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 499"
                    value={proposedCost}
                    onChange={e => setProposedCost(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      color: "#fff",
                      width: 120
                    }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: "6px 16px", fontSize: 12 }}>Propose</button>
                  <button type="button" onClick={() => setProposeCostOpen(false)} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </form>
              </div>
            )}

            {/* Messages Body */}
            <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, background: "rgba(0,0,0,0.03)" }}>
              {loadingMessages ? (
                <div style={{ display: "flex", justify: "center", padding: 20 }}>
                  <RefreshCw className="animate-spin" size={24} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#64748b", padding: 40, fontSize: 13 }}>
                  No messages yet. Send a message to start negotiating the manuscript publication!
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender._id === user?._id;

                  // Render System/Alert Message
                  if (msg.isSystem) {
                    const isProposal = msg.content.includes("PROPOSAL");
                    const isPayment = msg.content.includes("PAYMENT");

                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                        <div style={{
                          background: isProposal ? "rgba(245, 158, 11, 0.08)" : isPayment ? "rgba(16, 185, 129, 0.08)" : "rgba(255,255,255,0.02)",
                          border: isProposal ? "1px solid rgba(245, 158, 11, 0.2)" : isPayment ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(255,255,255,0.05)",
                          padding: "12px 18px",
                          borderRadius: 12,
                          maxWidth: "80%",
                          textAlign: "center",
                          fontSize: "0.82rem",
                          color: "#cbd5e1"
                        }}>
                          {isProposal ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                              <Clock size={16} color="#f59e0b" />
                              <strong>{msg.content}</strong>
                              {currentRole === "author" && msg.book && msg.book.status === "cost_proposed" && (
                                <button
                                  onClick={() => handlePayCost(msg.book._id)}
                                  style={{
                                    marginTop: 4,
                                    padding: "6px 16px",
                                    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    fontWeight: "bold",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6
                                  }}
                                >
                                  <Shield size={12} /> Pay Publishing Cost
                                </button>
                              )}
                            </div>
                          ) : isPayment ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                              <CheckCircle size={16} color="#10b981" />
                              <strong>{msg.content}</strong>
                            </div>
                          ) : (
                            <span>{msg.content}</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Render Normal Bubble
                  return (
                    <div key={i} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                      <div
                        style={{
                          background: isMe
                            ? `linear-gradient(135deg, ${currentRole === "author" ? "#7c3aed" : currentRole === "reader" ? "#059669" : "#0369a1"} 0%, ${currentRole === "author" ? "#6d28d9" : currentRole === "reader" ? "#047857" : "#0284c7"} 100%)`
                            : "#f1f5f9",
                          color: isMe ? "white" : "#0f172a",
                          padding: "12px 16px",
                          borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                          maxWidth: "70%",
                          fontSize: "0.85rem",
                          lineHeight: 1.5,
                          border: isMe ? "none" : "1px solid #e2e8f0"
                        }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} style={{ padding: 20, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 12, background: "#fff" }}>
              <input
                type="text"
                className="input-field"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                placeholder="Type your message..."
                disabled={sending}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #ede9fe",
                  outline: "none"
                }}
              />
              <button
                type="submit"
                disabled={sending || !inputValue.trim()}
                className="btn-primary"
                style={{
                  padding: "0 18px",
                  background: currentRole === "author" ? "#7c3aed" : "#0369a1",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <Send size={14} /> Send
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justify: "center", color: "#64748b", padding: 40, textAlign: "center" }}>
            <AlertCircle size={28} style={{ marginBottom: 12, display: "block" }} />
            No chat threads started. Submit a book to a publisher or browse the directory to start a thread!
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
