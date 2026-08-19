import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Send,
  Clock,
  Shield,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  DollarSign,
  Trash2,
  MoreVertical,
  Search,
  Bot,
  User as UserIcon,
  Sparkles,
  Check,
  CheckCheck,
  X
} from "lucide-react";
import { initSocket, getSocket } from "../services/socket";
import WalletPinModal from "./WalletPinModal";
import { sendMetaMaskTransaction } from "../services/web3";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const AI_BOT_ID = "0000000000000000000000aa";

const AI_BOT_USER = {
  _id: AI_BOT_ID,
  name: "BookConnect AI Assistant",
  email: "ai@bookconnect.com",
  role: "ai_bot",
  isAi: true
};

const ChatInterface = ({ user, currentRole, token, initialContact }) => {
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [deleteMenuMsgId, setDeleteMenuMsgId] = useState(null);
  const [proposeCostOpen, setProposeCostOpen] = useState(false);
  const [proposedCost, setProposedCost] = useState("");
  const [currentBook, setCurrentBook] = useState(null);
  const [payCostPinOpen, setPayCostPinOpen] = useState(false);
  const [payingBookId, setPayingBookId] = useState(null);
  const [payingBook, setPayingBook] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const selectedContactRef = useRef(null);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  // 1. Initialize Socket.io connection & fetch conversations on mount
  useEffect(() => {
    if (user?._id) {
      const socket = initSocket(user._id);

      socket.on("connect", () => {
        socket.emit("join_room", user._id);
      });

      socket.on("online_users", (users) => {
        setOnlineUsers(users);
      });

      // Handle real-time incoming messages
      socket.on("new_message", (newMsg) => {
        const activePartner = selectedContactRef.current;
        if (
          activePartner &&
          (newMsg.sender._id === activePartner._id || newMsg.sender === activePartner._id)
        ) {
          setMessages(prev => {
            if (prev.some(m => m._id === newMsg._id)) return prev;
            return [...prev, newMsg];
          });
          // Mark as read immediately
          axios.put(`${BASE_URL}/api/messages/read/${activePartner._id}`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => {});
        }
        fetchConversations();
      });

      // Handle message sent acknowledgment
      socket.on("message_sent", (sentMsg) => {
        const activePartner = selectedContactRef.current;
        if (activePartner && sentMsg.receiver === activePartner._id) {
          setMessages(prev => {
            if (prev.some(m => m._id === sentMsg._id)) return prev;
            return [...prev, sentMsg];
          });
        }
        fetchConversations();
      });

      // Handle real-time message deletion
      socket.on("message_deleted", ({ messageId, deleteType }) => {
        if (deleteType === "everyone") {
          setMessages(prev =>
            prev.map(m => (m._id === messageId ? { ...m, content: "This message was deleted", deletedForEveryone: true } : m))
          );
        } else {
          setMessages(prev => prev.filter(m => m._id !== messageId));
        }
        fetchConversations();
      });

      // Handle typing indicator
      socket.on("user_typing", ({ senderId, isTyping }) => {
        if (selectedContactRef.current && selectedContactRef.current._id === senderId) {
          setPartnerTyping(isTyping);
        }
      });

      return () => {
        socket.off("new_message");
        socket.off("message_sent");
        socket.off("message_deleted");
        socket.off("user_typing");
        socket.off("online_users");
      };
    }
  }, [user?._id]);

  // Initial fetch of active conversations
  useEffect(() => {
    fetchConversations();
  }, []);

  // If opened with a specific contact in mind (e.g. "Message" from the
  // matching page), select them once conversations have loaded, overriding
  // fetchConversations' own default-to-first-contact behavior.
  useEffect(() => {
    if (initialContact) {
      setSelectedContact(initialContact);
    }
  }, [initialContact]);

  // Fetch messages when contact changes
  useEffect(() => {
    if (selectedContact) {
      setHeaderMenuOpen(false);
      setPartnerTyping(false);
      fetchMessages(selectedContact._id);
      if (selectedContact._id !== AI_BOT_ID) {
        markAsRead(selectedContact._id);
      }
    }
  }, [selectedContact]);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // Handle user search input
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      searchUsers(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchConversations = async () => {
    setLoadingContacts(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setConversations(data.data);
        // Use the ref, not the `selectedContact` state, here: this function is called from
        // Socket.io listeners registered once on mount, so their closure over `selectedContact`
        // is permanently stale (always null) and would otherwise force-reset the open
        // conversation back to whatever's first in the list every time a message is sent/received.
        if (!selectedContactRef.current && data.data.length > 0) {
          setSelectedContact(data.data[0].partner);
        }
      }
    } catch (err) {
      console.error("Fetch conversations error:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const searchUsers = async (query) => {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/auth/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        // Filter out logged in user
        let users = data.data.filter(u => u._id !== user?._id);

        // Include AI Bot if search term matches
        if ("ai assistant chatbot gemini".includes(query.toLowerCase())) {
          users = [AI_BOT_USER, ...users];
        }
        setSearchResults(users);
      }
    } catch (err) {
      console.error("Search users error:", err);
    }
  };

  const fetchMessages = async (contactId) => {
    setLoadingMessages(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/messages/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setMessages(data.data);
        // Find associated book for negotiation if any
        const systemMsg = data.data.find(m => m.book);
        if (systemMsg) {
          setCurrentBook(systemMsg.book);
        } else {
          setCurrentBook(null);
        }
      }
    } catch (err) {
      console.error("Fetch messages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const markAsRead = async (contactId) => {
    try {
      await axios.put(`${BASE_URL}/api/messages/read/${contactId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setConversations(prev =>
        prev.map(c => (c.partner._id === contactId ? { ...c, unreadCount: 0 } : c))
      );
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);

    // Broadcast typing signal via Socket.io
    const socket = getSocket();
    if (socket && selectedContact && selectedContact._id !== AI_BOT_ID) {
      socket.emit("typing", {
        senderId: user?._id,
        receiverId: selectedContact._id,
        isTyping: true
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", {
          senderId: user?._id,
          receiverId: selectedContact._id,
          isTyping: false
        });
      }, 2000);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedContact) return;

    const contentText = inputValue.trim();
    setInputValue("");
    setSending(true);

    const socket = getSocket();
    if (socket && selectedContact._id !== AI_BOT_ID) {
      socket.emit("typing", { senderId: user?._id, receiverId: selectedContact._id, isTyping: false });
    }

    try {
      if (selectedContact._id === AI_BOT_ID || selectedContact.isAi) {
        // AI Chatbot Interaction
        const tempUserMsg = {
          _id: `temp-${Date.now()}`,
          sender: { _id: user?._id, name: user?.name, role: user?.role },
          receiver: AI_BOT_USER,
          content: contentText,
          createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempUserMsg]);

        const { data } = await axios.post(
          `${BASE_URL}/api/messages/ai`,
          { content: contentText },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success) {
          setMessages(prev => [
            ...prev.filter(m => m._id !== tempUserMsg._id),
            data.data,
            data.aiResponse
          ]);
          fetchConversations();
        }
      } else {
        // Real User Message
        const payload = {
          receiverId: selectedContact._id,
          content: contentText,
          bookId: currentBook?._id || null
        };

        const { data } = await axios.post(`${BASE_URL}/api/messages`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (data.success) {
          setMessages(prev => [...prev, data.data]);
          fetchConversations();
        }
      }
    } catch (err) {
      console.error("Send message error:", err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId, deleteType = "me") => {
    setDeleteMenuMsgId(null);
    try {
      const { data } = await axios.delete(`${BASE_URL}/api/messages/${messageId}`, {
        data: { deleteType },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        if (deleteType === "everyone") {
          setMessages(prev =>
            prev.map(m => (m._id === messageId ? { ...m, content: "This message was deleted", deletedForEveryone: true } : m))
          );
        } else {
          setMessages(prev => prev.filter(m => m._id !== messageId));
        }
        fetchConversations();
      }
    } catch (err) {
      console.error("Delete message error:", err);
    }
  };

  const handleClearConversation = async () => {
    if (!selectedContact) return;
    if (!window.confirm(`Clear chat history with ${selectedContact.name}? This will hide old conversations for you.`)) return;

    try {
      const { data } = await axios.delete(`${BASE_URL}/api/messages/conversation/${selectedContact._id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setMessages([]);
        setHeaderMenuOpen(false);
        fetchConversations();
      }
    } catch (err) {
      console.error("Clear conversation error:", err);
    }
  };

  const handleProposeCostSubmit = async (e) => {
    e.preventDefault();
    if (!proposedCost || !selectedContact || !currentBook) return;

    try {
      const res = await axios.post(
        `${BASE_URL}/api/manuscripts/${currentBook._id}/propose-cost`,
        { cost: parseFloat(proposedCost) },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        setProposedCost("");
        setProposeCostOpen(false);
        fetchMessages(selectedContact._id);
      }
    } catch (err) {
      alert("Error proposing cost.");
      console.error(err);
    }
  };

  const handlePayCost = (bookId, book) => {
    setPayingBookId(bookId);
    setPayingBook(book || null);
    setPayCostPinOpen(true);
  };

  const handlePayCostAfterPin = async () => {
    const bookId = payingBookId;
    setPayCostPinOpen(false);
    setPayingBookId(null);
    try {
      const publisherWalletAddr =
        payingBook?.publisher?.blockchainWallet?.address ||
        payingBook?.publisher?.walletAddress ||
        "0x0000000000000000000000000000000000000000";
      const publishingCost = payingBook?.publishingCost || 0;

      let txHash = "";
      if (publishingCost > 0) {
        const ethVal = (publishingCost * 0.0001).toFixed(5);
        try {
          txHash = await sendMetaMaskTransaction(publisherWalletAddr, ethVal);
        } catch (metamaskErr) {
          alert("MetaMask transaction failed: " + metamaskErr.message);
          return;
        }
      }

      const res = await axios.post(
        `${BASE_URL}/api/manuscripts/${bookId}/pay-cost`,
        { txHash },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert(`Payment verified on Blockchain ledger${txHash ? " (Tx: " + txHash.slice(0, 12) + "...)" : ""}. Book published successfully!`);
        fetchMessages(selectedContact._id);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error processing payment.");
      console.error(err);
    }
  };

  const selectUserToChat = (partnerUser) => {
    setSelectedContact(partnerUser);
    setSearchQuery("");
    setSearchResults([]);
  };

  const getRoleColor = (role) => {
    if (role === "publisher") return "var(--info)";
    if (role === "author") return "var(--accent-600)";
    if (role === "ai_bot") return "#ec4899";
    return "var(--success)";
  };

  return (
    <>
    <div className="messages-layout" style={{ display: "flex", gap: 20, height: "100%", position: "relative" }}>
      {/* Contact List Sidepane */}
      <div className="glass-panel" style={{ width: 320, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        
        {/* Header & Search Bar */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", background: "var(--gray-100)" }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px 0", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
            <span>Messages & AI Assistant</span>
          </h3>

          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search people or AI Assistant..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 34px",
                background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
                outline: "none"
              }}
            />
            {searchQuery && (
              <X size={14} onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", cursor: "pointer", color: "var(--text-muted)" }} />
            )}
          </div>
        </div>

        {/* Search Results overlay or Conversations List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {searchQuery ? (
            <div style={{ padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", padding: "8px 12px" }}>
                Search Results
              </div>
              {searchResults.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: 12, textAlign: "center" }}>No users found matching "{searchQuery}"</div>
              ) : (
                searchResults.map(u => (
                  <div
                    key={u._id}
                    onClick={() => selectUserToChat(u)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "color-mix(in srgb, var(--text-primary) 2%, transparent)",
                      marginBottom: 6
                    }}
                  >
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: getRoleColor(u.role),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: "bold",
                      fontSize: 14
                    }}>
                      {u.isAi ? <Bot size={18} /> : u.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-primary)" }}>{u.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>{u.role === "ai_bot" ? "AI Assistant" : u.role}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div>
              {loadingContacts ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
                  <RefreshCw className="animate-spin" size={18} color="var(--text-muted)" />
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 20, textAlign: "center" }}>
                  No active conversations yet. Search users above to start messaging!
                </div>
              ) : (
                conversations.map((c) => {
                  const partner = c.partner;
                  const isSelected = selectedContact?._id === partner._id;
                  const isOnline = onlineUsers.includes(partner._id);

                  return (
                    <div
                      key={partner._id}
                      onClick={() => selectUserToChat(partner)}
                      style={{
                        padding: "14px 18px",
                        borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)",
                        cursor: "pointer",
                        background: isSelected ? "color-mix(in srgb, var(--text-primary) 6%, transparent)" : "transparent",
                        borderLeft: isSelected ? `4px solid ${getRoleColor(partner.role)}` : "4px solid transparent",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "all 0.15s ease"
                      }}
                    >
                      <div style={{ position: "relative" }}>
                        <div style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: getRoleColor(partner.role),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: "bold",
                          color: "#fff"
                        }}>
                          {partner.isAi ? <Bot size={20} /> : partner.name[0]?.toUpperCase()}
                        </div>
                        {isOnline && !partner.isAi && (
                          <span style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "var(--success)",
                            border: "2px solid var(--bg-primary)"
                          }} />
                        )}
                      </div>

                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {partner.name}
                          </span>
                          {c.unreadCount > 0 && (
                            <span style={{
                              background: "var(--danger)",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: "bold",
                              borderRadius: "10px",
                              padding: "2px 6px"
                            }}>
                              {c.unreadCount}
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                            {c.lastMessage?.content || "No messages yet"}
                          </span>
                          <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>
                            {partner.isAi ? "AI" : partner.role}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Thread */}
      <div className="glass-panel" style={{ flex: 1, display: "flex", flexDirection: "column", padding: 0, overflow: "hidden" }}>
        {selectedContact ? (
          <>
            {/* Header */}
            <div style={{ padding: "14px 24px", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--gray-50)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: "50%",
                    background: getRoleColor(selectedContact.role),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: "bold"
                  }}>
                    {selectedContact.isAi ? <Bot size={20} /> : selectedContact.name[0]?.toUpperCase()}
                  </div>
                  {onlineUsers.includes(selectedContact._id) && !selectedContact.isAi && (
                    <span style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "var(--success)",
                      border: "2px solid var(--bg-primary)"
                    }} />
                  )}
                </div>

                <div>
                  <span style={{ display: "block", fontSize: 14, fontWeight: "bold", color: "var(--text-primary)" }}>{selectedContact.name}</span>
                  <span style={{ display: "block", fontSize: 11, color: partnerTyping ? "var(--success)" : onlineUsers.includes(selectedContact._id) ? "var(--success)" : "var(--text-muted)" }}>
                    {partnerTyping ? "typing..." : selectedContact.isAi ? "AI Assistant (Always Online)" : onlineUsers.includes(selectedContact._id) ? "Online" : "Offline"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
                {/* Publisher Propose Cost button */}
                {currentRole === "publisher" && currentBook && currentBook.status !== "published" && !selectedContact.isAi && (
                  <button
                    onClick={() => setProposeCostOpen(!proposeCostOpen)}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(8, 145, 178, 0.15)",
                      color: "var(--info)",
                      border: "1px solid rgba(8, 145, 178, 0.3)",
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

                {/* Options Dropdown Menu */}
                <button
                  onClick={() => setHeaderMenuOpen(!headerMenuOpen)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 6 }}
                >
                  <MoreVertical size={18} />
                </button>

                {headerMenuOpen && (
                  <div style={{
                    position: "absolute",
                    right: 0,
                    top: 40,
                    background: "var(--bg-primary)",
                    border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
                    borderRadius: 8,
                    boxShadow: "0 10px 25px rgba(0,0,0,0.16)",
                    zIndex: 50,
                    minWidth: 180,
                    overflow: "hidden"
                  }}>
                    <button
                      onClick={handleClearConversation}
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        background: "none",
                        border: "none",
                        color: "var(--danger)",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8
                      }}
                    >
                      <Trash2 size={14} /> Clear Chat History
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Propose Cost Form Panel */}
            {proposeCostOpen && (
              <div style={{ padding: 16, background: "rgba(8, 145, 178, 0.12)", borderBottom: "1px solid rgba(8, 145, 178, 0.2)" }}>
                <form onSubmit={handleProposeCostSubmit} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: "bold", color: "var(--info)" }}>Proposed Fee ($):</span>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 499"
                    value={proposedCost}
                    onChange={e => setProposedCost(e.target.value)}
                    style={{
                      padding: "6px 12px",
                      background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
                      borderRadius: 6,
                      color: "var(--text-primary)",
                      width: 120
                    }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: "6px 16px", fontSize: 12 }}>Send Proposal</button>
                  <button type="button" onClick={() => setProposeCostOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </form>
              </div>
            )}

            {/* Messages Content */}
            <div style={{ flex: 1, padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, background: "var(--gray-50)" }}>
              {loadingMessages ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 30 }}>
                  <RefreshCw className="animate-spin" size={24} color="var(--text-muted)" />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", padding: 40, fontSize: 13 }}>
                  {selectedContact.isAi
                    ? "Ask BookConnect AI Assistant anything about book writing, summaries, or publishing!"
                    : "No messages yet. Send a message to start the conversation!"}
                </div>
              ) : (
                messages.map((msg, i) => {
                  const senderId = msg.sender?._id || msg.sender;
                  const isMe = senderId === user?._id;

                  if (msg.isSystem) {
                    const isProposal = msg.content.includes("PROPOSAL");
                    const isPayment = msg.content.includes("PAYMENT");

                    return (
                      <div key={msg._id || i} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
                        <div style={{
                          background: isProposal ? "rgba(217, 119, 6, 0.1)" : isPayment ? "rgba(22, 163, 74, 0.1)" : "color-mix(in srgb, var(--text-primary) 2%, transparent)",
                          border: isProposal ? "1px solid rgba(217, 119, 6, 0.25)" : isPayment ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)",
                          padding: "12px 18px",
                          borderRadius: 12,
                          maxWidth: "80%",
                          textAlign: "center",
                          fontSize: "0.82rem",
                          color: "var(--text-secondary)"
                        }}>
                          {isProposal ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                              <Clock size={16} color="var(--warning)" />
                              <strong>{msg.content}</strong>
                              {currentRole === "author" && msg.book && msg.book.status === "cost_proposed" && (
                                <button
                                  onClick={() => handlePayCost(msg.book._id)}
                                  style={{
                                    marginTop: 6,
                                    padding: "6px 16px",
                                    background: "linear-gradient(135deg, var(--success) 0%, var(--success) 100%)",
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
                              <CheckCircle size={16} color="var(--success)" />
                              <strong>{msg.content}</strong>
                            </div>
                          ) : (
                            <span>{msg.content}</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  const isDeleted = msg.deletedForEveryone;

                  return (
                    <div
                      key={msg._id || i}
                      style={{
                        display: "flex",
                        justifyContent: isMe ? "flex-end" : "flex-start",
                        position: "relative",
                        group: "msg-bubble"
                      }}
                    >
                      <div
                        onMouseEnter={() => setDeleteMenuMsgId(msg._id)}
                        onMouseLeave={() => setDeleteMenuMsgId(null)}
                        style={{
                          position: "relative",
                          maxWidth: "75%"
                        }}
                      >
                        {/* Hover Action Menu for Message Deletion */}
                        {deleteMenuMsgId === msg._id && !isDeleted && (
                          <div style={{
                            position: "absolute",
                            top: -12,
                            right: isMe ? 0 : "auto",
                            left: isMe ? "auto" : 0,
                            background: "var(--bg-primary)",
                            border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
                            borderRadius: 6,
                            padding: "2px 4px",
                            display: "flex",
                            gap: 4,
                            zIndex: 10,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.14)"
                          }}>
                            <button
                              title="Delete for me"
                              onClick={() => handleDeleteMessage(msg._id, "me")}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px 4px" }}
                            >
                              <Trash2 size={12} />
                            </button>
                            {isMe && (
                              <button
                                title="Delete for everyone"
                                onClick={() => handleDeleteMessage(msg._id, "everyone")}
                                style={{ background: "none", border: "none", color: "var(--danger)", cursor: "pointer", padding: "2px 4px", fontSize: 10, fontWeight: "bold" }}
                              >
                                Everyone
                              </button>
                            )}
                          </div>
                        )}

                        <div
                          style={{
                            background: isDeleted
                              ? "color-mix(in srgb, var(--text-primary) 3%, transparent)"
                              : isMe
                              ? `linear-gradient(135deg, ${getRoleColor(currentRole)} 0%, var(--accent-700) 100%)`
                              : selectedContact.isAi
                              ? "rgba(236, 72, 153, 0.12)"
                              : "var(--gray-100)",
                            // own-message bubble keeps a colored gradient bg regardless of page theme, so it needs light text; other bubbles are now light and need dark text
                            color: isDeleted ? "var(--text-muted)" : isMe ? "#fff" : "var(--text-primary)",
                            padding: "12px 16px",
                            borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                            fontSize: "0.88rem",
                            lineHeight: 1.5,
                            fontStyle: isDeleted ? "italic" : "normal",
                            border: isDeleted
                              ? "1px dashed color-mix(in srgb, var(--text-primary) 10%, transparent)"
                              : isMe
                              ? "none"
                              : selectedContact.isAi
                              ? "1px solid rgba(236, 72, 153, 0.3)"
                              : "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)"
                          }}
                        >
                          {msg.isAi && !isMe && (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, color: "#ec4899", fontSize: 10, fontWeight: "bold" }}>
                              <Sparkles size={12} /> AI Assistant Response
                            </div>
                          )}

                          {msg.content}

                          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10, color: isMe ? "rgba(255,255,255,0.7)" : "var(--text-secondary)" }}>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && !isDeleted && (
                              msg.read ? <CheckCheck size={12} color="var(--info)" /> : <Check size={12} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing Indicator */}
              {partnerTyping && (
                <div style={{ display: "flex", gap: 4, alignItems: "center", color: "var(--text-muted)", fontSize: 12, fontStyle: "italic" }}>
                  <span>{selectedContact.name} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSend} style={{ padding: "16px 20px", borderTop: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", display: "flex", gap: 12, background: "var(--gray-100)" }}>
              <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                placeholder={selectedContact.isAi ? "Ask AI Assistant anything..." : "Type your message..."}
                disabled={sending}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
                  color: "var(--text-primary)",
                  outline: "none",
                  fontSize: 13
                }}
              />
              <button
                type="submit"
                disabled={sending || !inputValue.trim()}
                style={{
                  padding: "0 20px",
                  background: getRoleColor(selectedContact.role),
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontWeight: "bold",
                  cursor: sending || !inputValue.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  opacity: sending || !inputValue.trim() ? 0.6 : 1
                }}
              >
                {sending ? <RefreshCw className="animate-spin" size={14} /> : <Send size={14} />}
                <span>Send</span>
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justify: "center", color: "var(--text-secondary)", padding: 40, textAlign: "center" }}>
            <AlertCircle size={32} style={{ marginBottom: 12, opacity: 0.7 }} />
            <h4 style={{ color: "var(--text-muted)", margin: "0 0 6px 0" }}>No Chat Selected</h4>
            <p style={{ fontSize: 13, maxWidth: 320 }}>Select a contact from the list or use the search bar above to start a conversation!</p>
          </div>
        )}
      </div>
    </div>

    {/* PIN Modal for Chat Pay-Cost */}
    <WalletPinModal
      isOpen={payCostPinOpen}
      onClose={() => { setPayCostPinOpen(false); setPayingBookId(null); setPayingBook(null); }}
      onSuccess={handlePayCostAfterPin}
      token={token}
      title="Enter PIN to Authorize Publishing Fee Payment"
    />
  </>
  );
};

export default ChatInterface;
