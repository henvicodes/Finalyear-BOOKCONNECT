import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import {
  BookOpen, Upload, Star, Users, TrendingUp, Shield,
  Bell, Settings, LogOut, ChevronRight, Eye, EyeOff, Heart,
  MessageCircle, Award, Zap, Globe, PenTool, Search,
  BarChart2, Clock, CheckCircle, AlertCircle, Plus,
  BookMarked, Layers, DollarSign, UserCheck, FileText,
  Hash, Lock, Sparkles, ArrowUpRight, Menu, X
} from "lucide-react";
import SearchBar from "../components/SearchBar";
import WalletPinModal from "../components/WalletPinModal";
import { sendMetaMaskTransaction, getConnectedAccount } from "../services/web3";
import "./Dashboard.css";
import {
  AuthorOverview,
  AuthorMyBooks,
  AuthorUploadBook,
  AuthorEditBook,
  AuthorBlockchain,
  AuthorAnalytics,
  AuthorAIAssistant,
  AuthorSettings
} from "./AuthorDashboard";
import PublisherDashboard from "./PublisherDashboard";
import ReaderDashboard from "./ReaderDashboard";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DashSearchBar = SearchBar;

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({ role, active, setActive, onLogout, user, sidebarOpen, setSidebarOpen }) => {
  const authorLinks = [
    { id: "overview",   icon: <BarChart2 size={18} />,    label: "Overview" },
    { id: "mybooks",    icon: <BookOpen size={18} />,      label: "My Books" },
    { id: "upload",     icon: <Upload size={18} />,        label: "Upload Book" },
    { id: "aiassist",   icon: <Sparkles size={18} />,      label: "AI Assistant" },
    { id: "blockchain", icon: <Shield size={18} />,        label: "Blockchain" },
    { id: "messages",   icon: <MessageCircle size={18} />, label: "Messages" },
    { id: "analytics",  icon: <TrendingUp size={18} />,    label: "Analytics" },
    { id: "settings",   icon: <Settings size={18} />,      label: "Settings" },
  ];
  const readerLinks = [
    { id: "overview", icon: <BarChart2 size={18} />,  label: "Overview" },
    { id: "library",  icon: <BookMarked size={18} />, label: "My Library" },
    { id: "discover", icon: <Search size={18} />,     label: "Discover" },
    { id: "reading",  icon: <Clock size={18} />,      label: "Reading List" },
    { id: "reviews",  icon: <Star size={18} />,       label: "My Reviews" },
    { id: "settings", icon: <Settings size={18} />,   label: "Settings" },
  ];
  const publisherLinks = [
    { id: "overview",    icon: <BarChart2 size={18} />,     label: "Overview" },
    { id: "authors",     icon: <Users size={18} />,         label: "Authors" },
    { id: "submissions", icon: <FileText size={18} />,      label: "Submissions" },
    { id: "published",   icon: <BookOpen size={18} />,      label: "Published" },
    { id: "blockchain",  icon: <Shield size={18} />,        label: "Blockchain" },
    { id: "revenue",     icon: <DollarSign size={18} />,    label: "Revenue" },
    { id: "messages",    icon: <MessageCircle size={18} />, label: "Messages" },
    { id: "settings",    icon: <Settings size={18} />,      label: "Settings" },
  ];

  const links = role === "author" ? authorLinks : role === "publisher" ? publisherLinks : readerLinks;
  const roleColor = role === "author" ? "#7c3aed" : role === "publisher" ? "#0369a1" : "#059669";
  const roleLabel = role === "author" ? "Author" : role === "publisher" ? "Publisher" : "Reader";
  const [showBalance, setShowBalance] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><BookOpen size={22} /><span>BookConnect</span></div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: roleColor }}>
            {user?.profilePicture && user.profilePicture !== "default-avatar.png"
              ? <img src={user.profilePicture} alt={user.name} />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name || "User"}</span>
            <span className="sidebar-role-badge" style={{ background: roleColor + "22", color: roleColor }}>{roleLabel}</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {links.map(link => (
            <button
              key={link.id}
              className={`sidebar-link ${active === link.id ? "active" : ""}`}
              onClick={() => { setActive(link.id); setSidebarOpen(false); }}
              style={active === link.id ? { background: roleColor + "18", color: roleColor, borderColor: roleColor } : {}}
            >
              {link.icon}<span>{link.label}</span>
              {active === link.id && <ChevronRight size={14} className="link-arrow" />}
            </button>
          ))}
        </nav>
        {/* Wallet Balance widget with PIN protection */}
        <div style={{
          margin: "10px 16px",
          padding: "12px 14px",
          background: `rgba(${role === "author" ? "124, 58, 237" : "3, 105, 161"}, 0.04)`,
          border: `1px solid rgba(${role === "author" ? "124, 58, 237" : "3, 105, 161"}, 0.12)`,
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>Wallet Balance</span>
            <button
              onClick={() => showBalance ? setShowBalance(false) : setPinModalOpen(true)}
              style={{ background: "none", border: "none", color: roleColor, cursor: "pointer", padding: 0 }}
              title={showBalance ? "Hide balance" : "Reveal with PIN"}
            >
              {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DollarSign size={14} color={roleColor} />
            <strong style={{ fontSize: 15, color: "#1e293b", fontFamily: "sans-serif" }}>
              {showBalance
                ? `$${(user?.walletBalance !== undefined ? user.walletBalance : 1000).toFixed(2)}`
                : "$ ••••••"}
            </strong>
          </div>
        </div>

        <WalletPinModal
          isOpen={pinModalOpen}
          onClose={() => setPinModalOpen(false)}
          onSuccess={() => { setShowBalance(true); setPinModalOpen(false); }}
          token={user?.token}
          title="Enter PIN to View Wallet Balance"
        />

        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={16} /><span>Sign out</span>
        </button>
      </aside>
    </>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n || 0);

const Skel = () => (
  <div style={{ height: 52, background: "#f3f0ff", borderRadius: 8, marginBottom: 8, opacity: 0.5 }} />
);

import ChatInterface from "../components/ChatInterface";

const Dashboard = () => {
  const { user, logout, isAuthor, isPublisher, updateUserFields } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingBookId, setEditingBookId] = useState(null);

  const role  = isAuthor ? "author" : isPublisher ? "publisher" : "reader";
  const token = user?.token;
  const [payingBookId, setPayingBookId] = useState(null); // holds bookId awaiting PIN
  const [payCostPinOpen, setPayCostPinOpen] = useState(false);

  const fetchBooks = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/manuscripts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setBooks(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === "author" && token) {
      fetchBooks();
    }
  }, [role, token]);

  const handlePayCost = (bookId) => {
    setPayingBookId(bookId);
    setPayCostPinOpen(true);
  };

  const handlePayCostAfterPin = async () => {
    const bookId = payingBookId;
    setPayCostPinOpen(false);
    setPayingBookId(null);
    try {
      // Find publisher wallet address from book data if available
      const book = books.find(b => (b._id || b.id) === bookId);
      const publisherWalletAddr =
        book?.publisher?.blockchainWallet?.address ||
        book?.publisher?.walletAddress ||
        "0x0000000000000000000000000000000000000000";
      const publishingCost = book?.publishingCost || 0;

      // Attempt MetaMask transaction (proportional ETH: $1 = 0.0001 ETH)
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

      const { data } = await axios.post(
        `${BASE_URL}/api/manuscripts/${bookId}/pay-cost`,
        { txHash },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        alert(`Payment verified on Blockchain ledger${txHash ? " (Tx: " + txHash.slice(0, 12) + "...)" : ""}. Book published successfully!`);
        if (data.walletBalance !== undefined) {
          updateUserFields({ walletBalance: data.walletBalance });
        }
        fetchBooks();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error processing payment.");
      console.error(err);
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  // Direct delegation to specialized Publisher & Reader dashboards
  if (role === "publisher") {
    return <PublisherDashboard user={user} token={token} onLogout={handleLogout} />;
  }

  if (role === "reader") {
    return <ReaderDashboard user={user} token={token} onLogout={handleLogout} />;
  }

  // Author Sub-view Router
  const renderContent = () => {
    if (active === "overview") {
      return (
        <AuthorOverview
          user={user}
          setActive={setActive}
          books={books}
          loading={loading}
          setEditingBookId={setEditingBookId}
          onPayCost={handlePayCost}
        />
      );
    }
    if (active === "mybooks") {
      return (
        <AuthorMyBooks
          books={books}
          loading={loading}
          setActive={setActive}
          setEditingBookId={setEditingBookId}
          onPayCost={handlePayCost}
        />
      );
    }
    if (active === "upload") {
      return <AuthorUploadBook token={token} setActive={setActive} fetchBooks={fetchBooks} />;
    }
    if (active === "editbook") {
      return <AuthorEditBook token={token} bookId={editingBookId} setActive={setActive} fetchBooks={fetchBooks} />;
    }
    if (active === "blockchain") {
      return <AuthorBlockchain token={token} books={books} user={user} fetchBooks={fetchBooks} />;
    }
    if (active === "analytics") {
      return <AuthorAnalytics books={books} user={user} />;
    }
    if (active === "messages") {
      return (
        <div style={{ height: "calc(100vh - 120px)" }}>
          <ChatInterface user={user} currentRole="author" token={token} />
        </div>
      );
    }
    if (active === "aiassist") {
      return <AuthorAIAssistant token={token} />;
    }
    if (active === "settings") {
      return <AuthorSettings user={user} token={token} />;
    }
    return (
      <div className="dash-content coming-soon">
        <Layers size={48} color="#94a3b8" />
        <h2>{active}</h2>
        <p>This section is under construction. Check back soon!</p>
      </div>
    );
  };

  return (
    <div className="dashboard-wrapper">
      <Sidebar
        role={role} active={active} setActive={setActive}
        onLogout={handleLogout} user={user}
        sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}
      />
      <div className="dashboard-main">
        <header className="dash-topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>

          {/* Search bar in topbar */}
          <div style={{ flex: 1, maxWidth: 480, margin: "0 20px" }}>
            <DashSearchBar />
          </div>

          <div className="topbar-right">
            <button className="topbar-icon"><Bell size={18} /><span className="notif-dot" /></button>
            <Link to="/profile" className="topbar-avatar">
              {user?.profilePicture && user.profilePicture !== "default-avatar.png"
                ? <img src={user.profilePicture} alt={user.name} />
                : user?.name?.[0]?.toUpperCase()}
            </Link>
          </div>
        </header>
        <div className="dash-body">{renderContent()}</div>
      </div>

      {/* PIN Modal for Publishing Fee Payment */}
      <WalletPinModal
        isOpen={payCostPinOpen}
        onClose={() => { setPayCostPinOpen(false); setPayingBookId(null); }}
        onSuccess={handlePayCostAfterPin}
        token={token}
        title="Enter PIN to Authorize Publishing Fee Payment"
      />
    </div>
  );
};

export default Dashboard;