import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  BookOpen,
  Eye,
  EyeOff,
  Star,
  Search,
  Clock,
  CheckCircle,
  Plus,
  BookMarked,
  Layers,
  DollarSign,
  UserCheck,
  Settings,
  Heart,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Sparkles,
  LogOut,
  BarChart2,
  MessageCircle,
  Menu,
  X,
  Bell,
} from "lucide-react";
import RatingStars from "../components/RatingStars";
import ChatInterface from "../components/ChatInterface";
import WalletPinModal from "../components/WalletPinModal";
import SearchBar from "../components/SearchBar";
import { useAuth } from "../context/AuthContext";
import { sendMetaMaskTransaction } from "../services/web3";
import "../styles/Dashboard.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n || 0));

const StatCard = ({ icon, label, value, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "1a", color }}>
      {icon}
    </div>
    <div className="stat-info">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

const ReaderDashboard = ({ user, token, onLogout }) => {
  const { updateUserFields } = useAuth();
  const navigate = useNavigate(); // Added for navigation

  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [library, setLibrary] = useState([]);
  const [showBalance, setShowBalance] = useState(false);
  const [balancePinOpen, setBalancePinOpen] = useState(false);
  const [purchasePinOpen, setPurchasePinOpen] = useState(false);
  const [pendingPurchaseBook, setPendingPurchaseBook] = useState(null);

  const [discoverBooks, setDiscoverBooks] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");

  const [progresses, setProgresses] = useState(() => {
    const saved = localStorage.getItem("reader_progresses");
    return saved ? JSON.parse(saved) : {};
  });

  const [readingList, setReadingList] = useState(() => {
    const saved = localStorage.getItem("reader_reading_list");
    return saved ? JSON.parse(saved) : [];
  });

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const [authors, setAuthors] = useState([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  useEffect(() => {
    fetchLibrary();
    fetchDiscoverBooks();
    fetchAuthors();
  }, []);

  const fetchLibrary = async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/reader/user/library`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success) setLibrary(data.data || []);
    } catch (err) {
      console.error("Library fetch error:", err);
    }
  };

  const fetchDiscoverBooks = async (genre = "", search = "") => {
    setLoadingDiscover(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "published");
      if (genre) params.set("genre", genre);
      if (search) params.set("search", search);

      const { data } = await axios.get(
        `${BASE_URL}/api/books?${params.toString()}`,
      );
      if (data.success) setDiscoverBooks(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDiscover(false);
    }
  };

  const fetchAuthors = async () => {
    setLoadingAuthors(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/auth/search?q=@`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data.success)
        setAuthors(data.data.filter((u) => u.role === "author"));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAuthors(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDiscoverBooks(selectedGenre, searchQuery);
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    fetchDiscoverBooks(genre, searchQuery);
  };

  const handlePurchaseBook = (book) => {
    const isPaid = book.isPaid || book.price > 0;
    if (!isPaid) {
      executePurchase(book, "");
      return;
    }
    setPendingPurchaseBook(book);
    setPurchasePinOpen(true);
  };

  const executePurchase = async (book, txHash) => {
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/reader/${book._id}/purchase`,
        { txHash },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        alert(data.message + (txHash ? `\nTx: ${txHash.slice(0, 14)}...` : ""));
        if (data.walletBalance !== undefined)
          updateUserFields({ walletBalance: data.walletBalance });
        fetchLibrary();
        fetchDiscoverBooks(selectedGenre, searchQuery);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Purchase failed.");
    }
  };

  const handlePurchaseAfterPin = async () => {
    const book = pendingPurchaseBook;
    setPurchasePinOpen(false);
    setPendingPurchaseBook(null);
    if (!book) return;

    const authorWalletAddr =
      book.author?.blockchainWallet?.address ||
      book.author?.walletAddress ||
      "0x0000000000000000000000000000000000000000";
    const price = book.price || 0;
    let txHash = "";
    if (price > 0) {
      const ethVal = (price * 0.0001).toFixed(5);
      try {
        txHash = await sendMetaMaskTransaction(authorWalletAddr, ethVal);
      } catch (metamaskErr) {
        alert("MetaMask transaction failed: " + metamaskErr.message);
        return;
      }
    }
    await executePurchase(book, txHash);
  };

  const handleProgressChange = (bookId, val) => {
    const updated = { ...progresses, [bookId]: parseInt(val) };
    setProgresses(updated);
    localStorage.setItem("reader_progresses", JSON.stringify(updated));
  };

  const toggleReadingList = (book) => {
    const exists = readingList.some((item) => item._id === book._id);
    const updated = exists
      ? readingList.filter((item) => item._id !== book._id)
      : [...readingList, book];
    setReadingList(updated);
    localStorage.setItem("reader_reading_list", JSON.stringify(updated));
  };

  const isUnlocked = (bookId) => library.some((b) => b._id === bookId);
  const myReviews = discoverBooks.filter((b) =>
    b.ratings?.some((r) => r.user === user?._id || r.user?._id === user?._id),
  );

  const navLinks = [
    { id: "overview", icon: <BarChart2 size={18} />, label: "Overview" },
    {
      id: "library",
      icon: <BookMarked size={18} />,
      label: `My Library (${library.length})`,
    },
    { id: "discover", icon: <Search size={18} />, label: "Discover" },
    {
      id: "readinglist",
      icon: <Heart size={18} />,
      label: `Reading List (${readingList.length})`,
    },
    {
      id: "myreviews",
      icon: <Star size={18} />,
      label: `My Reviews (${myReviews.length})`,
    },
    { id: "matchmaker", icon: <UserCheck size={18} />, label: "Matchmaker" },
    { id: "messages", icon: <MessageCircle size={18} />, label: "Messages" },
  ];

  return (
    <div className="dashboard-wrapper">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <Link
            to="/"
            className="sidebar-logo"
            style={{ textDecoration: "none" }}
          >
            <BookOpen size={22} color="#7c3aed" />
            <span>BookConnect</span>
          </Link>
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: "#059669" }}>
            {user?.profilePicture &&
            user.profilePicture !== "default-avatar.png" ? (
              <img src={user.profilePicture} alt={user.name} />
            ) : (
              user?.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span
              className="sidebar-role-badge"
              style={{ background: "rgba(5, 150, 105, 0.1)", color: "#059669" }}
            >
              Reader
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Workspace</div>
          {navLinks.map((link) => (
            <button
              key={link.id}
              className={`sidebar-link ${
                activeTab === link.id ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(link.id);
                setSidebarOpen(false);
              }}
              style={activeTab === link.id ? { color: "#059669" } : {}}
            >
              {link.icon}
              <span>{link.label}</span>
              {activeTab === link.id && (
                <ChevronRight size={14} className="link-arrow" />
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-wallet">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 700,
              }}
            >
              Wallet Balance
            </span>
            <button
              onClick={() =>
                showBalance ? setShowBalance(false) : setBalancePinOpen(true)
              }
              style={{
                background: "none",
                border: "none",
                color: "#059669",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <DollarSign size={16} color="#059669" />
            <strong
              style={{
                fontSize: 18,
                color: "#0f172a",
                fontFamily: "'Sora', sans-serif",
              }}
            >
              {showBalance
                ? `$${(user?.walletBalance !== undefined
                    ? user.walletBalance
                    : 1000
                  ).toFixed(2)}`
                : "••••••"}
            </strong>
          </div>
        </div>

        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </aside>

      <WalletPinModal
        isOpen={balancePinOpen}
        onClose={() => setBalancePinOpen(false)}
        onSuccess={() => {
          setShowBalance(true);
          setBalancePinOpen(false);
        }}
        token={token}
        title="Enter PIN to View Wallet Balance"
      />
      <WalletPinModal
        isOpen={purchasePinOpen}
        onClose={() => {
          setPurchasePinOpen(false);
          setPendingPurchaseBook(null);
        }}
        onSuccess={handlePurchaseAfterPin}
        token={token}
        title={`Enter PIN to Purchase "${
          pendingPurchaseBook?.title || "Book"
        }"`}
      />

      {/* Main Area */}
      <div className="dashboard-main">
        <header className="dash-topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          <div style={{ flex: 1, maxWidth: 480, margin: "0 20px" }}>
            <SearchBar />
          </div>

          <div className="topbar-right">
            <Link to="/profile" className="topbar-avatar">
              {user?.profilePicture &&
              user.profilePicture !== "default-avatar.png" ? (
                <img src={user.profilePicture} alt={user.name} />
              ) : (
                user?.name?.[0]?.toUpperCase()
              )}
            </Link>
          </div>
        </header>

        <div className="dash-body">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Welcome, {user?.name?.split(" ")[0]} 👋</h1>
                  <p>
                    Read books, rate manuscripts, and explore personalized
                    recommendations.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("discover")}
                  className="btn-primary-dash"
                  style={{ background: "#059669" }}
                >
                  <Search size={16} /> Browse Marketplace
                </button>
              </div>

              <div className="stats-row">
                <StatCard
                  icon={<BookOpen size={20} />}
                  label="Library Books"
                  value={library.length}
                  color="#059669"
                />
                <StatCard
                  icon={<Star size={20} />}
                  label="My Rated Books"
                  value={myReviews.length}
                  color="#f59e0b"
                />
                <StatCard
                  icon={<Heart size={20} />}
                  label="Saved Books"
                  value={readingList.length}
                  color="#ef4444"
                />
                <StatCard
                  icon={<Sparkles size={20} />}
                  label="Interest Matches"
                  value={authors.length}
                  color="#7c3aed"
                />
              </div>

              <div className="dash-grid">
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>My Reading Progress</h3>
                    <button
                      className="panel-link"
                      onClick={() => setActiveTab("library")}
                      style={{ color: "#059669" }}
                    >
                      Go to library
                    </button>
                  </div>
                  {library.length === 0 ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#94a3b8",
                        padding: "10px 0",
                      }}
                    >
                      No books unlocked yet. Go to Discover to unlock!
                    </p>
                  ) : (
                    library.slice(0, 3).map((b) => {
                      const pct = progresses[b._id] || 0;
                      return (
                        <div
                          key={b._id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            padding: "12px 0",
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#0f172a",
                              alignItems: "center",
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                marginRight: 16,
                              }}
                            >
                              {b.title}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                              }}
                            >
                              <span style={{ color: "#059669", fontSize: 12 }}>
                                {pct}% read
                              </span>
                              <button
                                onClick={() => navigate(`/books/${b._id}`)}
                                className="edit-btn"
                                style={{
                                  background: "#ecfdf5",
                                  color: "#059669",
                                  padding: "4px 8px",
                                }}
                              >
                                Continue
                              </button>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={(e) =>
                              handleProgressChange(b._id, e.target.value)
                            }
                            style={{ width: "100%", accentColor: "#059669" }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Personalized Recommendations</h3>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {discoverBooks.slice(0, 2).map((b) => (
                      <div
                        key={b._id}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "center",
                          padding: 12,
                          background: "#f0fdf4",
                          borderRadius: 10,
                          border: "1px solid #dcfce7",
                        }}
                      >
                        <BookOpen size={24} color="#059669" />
                        <div style={{ flex: 1 }}>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              display: "block",
                              color: "#0f172a",
                            }}
                          >
                            {b.title}
                          </span>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            Interest: {b.genre}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setActiveTab("discover");
                          }}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#059669",
                            cursor: "pointer",
                          }}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MY LIBRARY TAB (Redesigned) */}
          {activeTab === "library" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>My Library</h1>
                  <p>Read full books and adjust your progress levels.</p>
                </div>
              </div>

              {library.length === 0 ? (
                <div
                  className="glass-panel"
                  style={{ padding: 40, textAlign: "center" }}
                >
                  <BookMarked
                    size={48}
                    color="#94a3b8"
                    style={{ marginBottom: 12 }}
                  />
                  <p style={{ color: "#64748b" }}>
                    Your library is empty. Go search the marketplace to unlock
                    books!
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 24,
                  }}
                >
                  {library.map((b) => {
                    const pct = progresses[b._id] || 0;
                    return (
                      <div
                        key={b._id}
                        className="glass-panel library-card"
                        style={{
                          padding: 0,
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {/* Cover / Header */}
                        <div
                          style={{
                            display: "flex",
                            gap: 16,
                            padding: 20,
                            borderBottom: "1px solid #f1f5f9",
                          }}
                        >
                          <div
                            style={{
                              width: 64,
                              height: 90,
                              background: "#f3f0ff",
                              color: "#7c3aed",
                              borderRadius: 8,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              overflow: "hidden",
                              boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
                            }}
                          >
                            {b.coverImage &&
                            b.coverImage !== "default-cover.jpg" ? (
                              <img
                                src={b.coverImage}
                                alt={b.title}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  objectFit: "cover",
                                }}
                              />
                            ) : (
                              <BookOpen size={28} />
                            )}
                          </div>
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "center",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                fontSize: 16,
                                fontWeight: 700,
                                color: "#0f172a",
                                marginBottom: 4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {b.title}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 13,
                                color: "#64748b",
                                marginBottom: 8,
                              }}
                            >
                              by {b.author?.name}
                            </span>
                            <span
                              className="book-status new"
                              style={{
                                textTransform: "capitalize",
                                background: "rgba(5, 150, 105, 0.1)",
                                color: "#059669",
                                width: "fit-content",
                              }}
                            >
                              {b.genre}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div style={{ padding: "20px 20px 16px" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: 12,
                              fontWeight: 600,
                              marginBottom: 8,
                            }}
                          >
                            <span style={{ color: "#64748b" }}>
                              Reading Progress
                            </span>
                            <strong style={{ color: "#059669" }}>{pct}%</strong>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={(e) =>
                              handleProgressChange(b._id, e.target.value)
                            }
                            style={{ width: "100%", accentColor: "#059669" }}
                          />
                        </div>

                        {/* Actions */}
                        <div
                          style={{ padding: "0 20px 20px", marginTop: "auto" }}
                        >
                          <button
                            onClick={() => navigate(`/books/${b._id}`)}
                            className="btn-primary"
                            style={{
                              width: "100%",
                              background: "#059669",
                              justifyContent: "center",
                              padding: "10px",
                            }}
                          >
                            Continue Reading
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* DISCOVER TAB */}
          {activeTab === "discover" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Discover Marketplace</h1>
                  <p>
                    Browse books published on the ledger, unlock premium
                    manuscripts, and leave reviews.
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                <form
                  onSubmit={handleSearch}
                  style={{ display: "flex", gap: 12, marginBottom: 20 }}
                >
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search titles, descriptions, authors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ background: "#059669", padding: "0 24px" }}
                  >
                    Search
                  </button>
                </form>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    "",
                    "fiction",
                    "non-fiction",
                    "science",
                    "technology",
                    "poetry",
                    "mystery",
                    "romance",
                  ].map((g) => (
                    <button
                      key={g}
                      onClick={() => handleGenreChange(g)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: "1.5px solid #e2e8f0",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        background: selectedGenre === g ? "#059669" : "#fff",
                        color: selectedGenre === g ? "#fff" : "#475569",
                      }}
                    >
                      {g || "All Genres"}
                    </button>
                  ))}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 20,
                }}
              >
                {loadingDiscover ? (
                  <div
                    style={{
                      gridColumn: "1/-1",
                      display: "flex",
                      justifyContent: "center",
                      padding: 40,
                    }}
                  >
                    <RefreshCw
                      className="animate-spin"
                      size={24}
                      color="#059669"
                    />
                  </div>
                ) : discoverBooks.length === 0 ? (
                  <p
                    style={{
                      gridColumn: "1/-1",
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    No published books found.
                  </p>
                ) : (
                  discoverBooks.map((b) => {
                    const unlocked = isUnlocked(b._id);
                    const pinned = readingList.some(
                      (item) => item._id === b._id,
                    );
                    return (
                      <div
                        key={b._id}
                        className="glass-panel"
                        style={{
                          padding: 20,
                          display: "flex",
                          flexDirection: "column",
                          gap: 16,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 12,
                            }}
                          >
                            <span
                              className="book-status new"
                              style={{
                                textTransform: "capitalize",
                                background: "rgba(5, 150, 105, 0.1)",
                                color: "#059669",
                              }}
                            >
                              {b.genre}
                            </span>
                            <button
                              onClick={() => toggleReadingList(b)}
                              style={{
                                background: "none",
                                border: "none",
                                color: pinned ? "#ef4444" : "#94a3b8",
                                cursor: "pointer",
                              }}
                            >
                              <Heart
                                size={18}
                                fill={pinned ? "currentColor" : "none"}
                              />
                            </button>
                          </div>
                          <h3
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: "#0f172a",
                              marginBottom: 4,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {b.title}
                          </h3>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            by {b.author?.name}
                          </span>
                        </div>
                        <p
                          style={{
                            fontSize: 13,
                            color: "#64748b",
                            lineHeight: 1.5,
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            minHeight: 58,
                          }}
                        >
                          {b.description}
                        </p>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: "auto",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#0f172a",
                            }}
                          >
                            {b.isPaid ? `$${b.price}` : "Free"}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              fontSize: 12,
                              color: "#f59e0b",
                              fontWeight: 600,
                            }}
                          >
                            <Star size={14} fill="currentColor" />{" "}
                            {b.averageRating > 0 ? b.averageRating : "—"}
                          </span>
                        </div>
                        {unlocked ? (
                          <button
                            onClick={() => navigate(`/books/${b._id}`)}
                            className="btn-secondary"
                            style={{
                              width: "100%",
                              justifyContent: "center",
                              borderColor: "#059669",
                              color: "#059669",
                            }}
                          >
                            Read Book
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchaseBook(b)}
                            className="btn-primary"
                            style={{
                              width: "100%",
                              justifyContent: "center",
                              background: "#059669",
                            }}
                          >
                            {b.isPaid
                              ? `Purchase Book ($${b.price})`
                              : "Unlock Free Book"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* READING LIST TAB */}
          {activeTab === "readinglist" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>My Reading List</h1>
                  <p>Manuscripts pinned for reading later.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                {readingList.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: 20,
                    }}
                  >
                    Your reading list is empty.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {readingList.map((b) => (
                      <div
                        key={b._id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: 16,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "center",
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 8,
                              background: "#ecfdf5",
                              color: "#059669",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <BookMarked size={18} />
                          </div>
                          <div>
                            <span
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#0f172a",
                                display: "block",
                              }}
                            >
                              {b.title}
                            </span>
                            <span style={{ fontSize: 12, color: "#64748b" }}>
                              by {b.author?.name}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/books/${b._id}`)}
                          className="btn-secondary"
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            borderColor: "#059669",
                            color: "#059669",
                          }}
                        >
                          View Book
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MY REVIEWS LIST TAB */}
          {activeTab === "myreviews" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>My Reviews</h1>
                  <p>
                    Feedback ratings and commentary you have published for
                    books.
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                {myReviews.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: 20,
                    }}
                  >
                    You have not left any ratings or reviews yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {myReviews.map((b) => {
                      const userRating = b.ratings.find(
                        (r) =>
                          r.user === user?._id || r.user?._id === user?._id,
                      );
                      return (
                        <div
                          key={b._id}
                          style={{
                            padding: 16,
                            background: "rgba(0,0,0,0.01)",
                            border: "1px solid rgba(0,0,0,0.03)",
                            borderRadius: 10,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <strong style={{ fontSize: 13, display: "block" }}>
                              {b.title}
                            </strong>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                                marginTop: 4,
                              }}
                            >
                              "{userRating?.review || "Rated only"}"
                            </p>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 12,
                            }}
                          >
                            <RatingStars
                              rating={userRating?.rating || 0}
                              readOnly
                              size={14}
                            />
                            <button
                              onClick={() => navigate(`/books/${b._id}`)}
                              className="edit-btn"
                              style={{
                                background: "#ede9fe",
                                color: "#7c3aed",
                              }}
                            >
                              Edit Review
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MATCHMAKER TAB */}
          {activeTab === "matchmaker" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Reader-Writer Matching Engine</h1>
                  <p>
                    Our NLP profile similarity matcher links you with authors
                    sharing overlapping tag interests.
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 20 }}>
                {loadingAuthors ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 20,
                    }}
                  >
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : authors.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#94a3b8" }}>
                    No authors registered on the platform.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    {authors.map((a, idx) => {
                      const overlap =
                        a.interests?.filter((tag) =>
                          user?.interests?.includes(tag),
                        ) || [];
                      const matchPct =
                        overlap.length > 0
                          ? Math.round(
                              (overlap.length /
                                Math.max(user?.interests?.length || 1, 1)) *
                                100,
                            )
                          : 10 + (idx % 3) * 10;

                      return (
                        <div
                          key={a._id}
                          style={{
                            padding: 18,
                            background: "rgba(124, 58, 237, 0.02)",
                            border: "1px solid rgba(124, 58, 237, 0.1)",
                            borderRadius: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <span
                                style={{ fontSize: 14, fontWeight: "bold" }}
                              >
                                {a.name}
                              </span>
                              <span
                                style={{
                                  background: "rgba(124, 58, 237, 0.1)",
                                  color: "#7c3aed",
                                  padding: "1px 6px",
                                  borderRadius: 10,
                                  fontSize: 10,
                                  fontWeight: "bold",
                                }}
                              >
                                {matchPct}% Profile Match
                              </span>
                            </div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                color: "#64748b",
                                marginTop: 4,
                              }}
                            >
                              {a.bio || "Bio not specified by writer."}
                            </span>
                            <div
                              style={{ display: "flex", gap: 6, marginTop: 8 }}
                            >
                              {a.interests?.map((tag) => (
                                <span
                                  key={tag}
                                  style={{
                                    fontSize: 9,
                                    background: "rgba(0,0,0,0.03)",
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    textTransform: "capitalize",
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              alert(
                                "Matchmaker simulation: Author added to reading recommendations list!",
                              )
                            }
                            style={{
                              padding: "6px 14px",
                              background: "#7c3aed",
                              color: "#fff",
                              border: "none",
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: "bold",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Sparkles size={12} /> Follow Author
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === "messages" && (
            <div
              className="dash-content animate-fade-in"
              style={{ height: "calc(100vh - 120px)" }}
            >
              <ChatInterface user={user} currentRole="reader" token={token} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReaderDashboard;
