import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BookOpen, Eye, Star, Search, Clock, CheckCircle, Plus, BookMarked, Layers,
  DollarSign, UserCheck, Settings, Heart, AlertCircle, RefreshCw, ChevronRight, Sparkles, LogOut, BarChart2, MessageCircle
} from "lucide-react";
import RatingStars from "../components/RatingStars";
import ChatInterface from "../components/ChatInterface";
import { useAuth } from "../context/AuthContext";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Format helper
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n || 0);

// Stat Card
const StatCard = ({ icon, label, value, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "1a", color }}>{icon}</div>
    <div className="stat-info">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

const ReaderDashboard = ({ user, token, onLogout }) => {
  const { updateUserFields } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [library, setLibrary] = useState([]);
  const [loadingLib, setLoadingLib] = useState(false);

  // Discover Marketplace
  const [discoverBooks, setDiscoverBooks] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");

  // Reading Progress states (saved in localStorage)
  const [progresses, setProgresses] = useState(() => {
    const saved = localStorage.getItem("reader_progresses");
    return saved ? JSON.parse(saved) : {};
  });

  // Reading List (pinned)
  const [readingList, setReadingList] = useState(() => {
    const saved = localStorage.getItem("reader_reading_list");
    return saved ? JSON.parse(saved) : [];
  });

  // Detail Modal
  const [selectedBook, setSelectedBook] = useState(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState(null);

  // Reader display settings (Wattpad / Magazine style)
  const [readerTheme, setReaderTheme] = useState("sepia");
  const [readerFontSize, setReaderFontSize] = useState("medium");

  // Reviews CRUD states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Authors listing for Matchmaker
  const [authors, setAuthors] = useState([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  useEffect(() => {
    fetchLibrary();
    fetchDiscoverBooks();
    fetchAuthors();
  }, []);

  const fetchLibrary = async () => {
    setLoadingLib(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/reader/user/library`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setLibrary(data.data || []);
      }
    } catch (err) {
      console.error("Library fetch error:", err);
    } finally {
      setLoadingLib(false);
    }
  };

  const fetchDiscoverBooks = async (genre = "", search = "") => {
    setLoadingDiscover(true);
    try {
      const params = new URLSearchParams();
      params.set("status", "published");
      if (genre) params.set("genre", genre);
      if (search) params.set("search", search);

      const { data } = await axios.get(`${BASE_URL}/api/books?${params.toString()}`);
      if (data.success) {
        setDiscoverBooks(data.data || []);
      }
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
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setAuthors(data.data.filter(u => u.role === "author"));
      }
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

  // Purchase/Unlock a paid book
  const handlePurchaseBook = async (book) => {
    const isPaid = book.isPaid || book.price > 0;
    const confirmMsg = isPaid 
      ? `Confirm MetaMask transaction to purchase "${book.title}" for $${book.price}?`
      : `Unlock free book "${book.title}" and add to your library?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const { data } = await axios.post(`${BASE_URL}/api/reader/${book._id}/purchase`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        alert(data.message);
        if (data.walletBalance !== undefined) {
          updateUserFields({ walletBalance: data.walletBalance });
        }
        fetchLibrary();
        fetchDiscoverBooks(selectedGenre, searchQuery);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Purchase failed.");
    }
  };

  // Reading Progress update
  const handleProgressChange = (bookId, val) => {
    const updated = { ...progresses, [bookId]: parseInt(val) };
    setProgresses(updated);
    localStorage.setItem("reader_progresses", JSON.stringify(updated));
  };

  // Add to reading list
  const toggleReadingList = (book) => {
    const exists = readingList.some(item => item._id === book._id);
    let updated;
    if (exists) {
      updated = readingList.filter(item => item._id !== book._id);
    } else {
      updated = [...readingList, book];
    }
    setReadingList(updated);
    localStorage.setItem("reader_reading_list", JSON.stringify(updated));
  };

  // Add/Edit Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!selectedBook) return;
    setSubmittingReview(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/api/books/${selectedBook._id}/rate`, {
        rating: reviewRating,
        review: reviewText
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        alert("Review submitted successfully!");
        setReviewText("");
        // Reload discover book details
        const updatedBookRes = await axios.get(`${BASE_URL}/api/books/${selectedBook._id}`);
        if (updatedBookRes.data.success) {
          setSelectedBook(updatedBookRes.data.data);
        }
        fetchDiscoverBooks(selectedGenre, searchQuery);
      }
    } catch (err) {
      alert("Error submitting review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Delete review helper
  const handleDeleteReview = async () => {
    if (!window.confirm("Are you sure you want to delete your review?")) return;
    setSubmittingReview(true);
    try {
      // Rates with score 1 (standard resets) or we can clear
      await axios.post(`${BASE_URL}/api/books/${selectedBook._id}/rate`, {
        rating: 1,
        review: ""
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Review cleared.");
      setReviewText("");
      const updatedBookRes = await axios.get(`${BASE_URL}/api/books/${selectedBook._id}`);
      if (updatedBookRes.data.success) {
        setSelectedBook(updatedBookRes.data.data);
      }
      fetchDiscoverBooks(selectedGenre, searchQuery);
    } catch (err) {
      alert("Error clearing review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const isUnlocked = (bookId) => {
    return library.some(b => b._id === bookId);
  };

  // Calculate my average rating given reviews left
  const myReviews = discoverBooks.filter(b => b.ratings?.some(r => r.user === user?._id || r.user?._id === user?._id));

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><BookOpen size={22} /><span>BookConnect</span></div>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: "#059669" }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-role-badge" style={{ background: "rgba(5, 150, 105, 0.1)", color: "#059669" }}>
              Reader
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={`sidebar-link ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            <BarChart2 size={18} /><span>Overview</span>
          </button>
          <button className={`sidebar-link ${activeTab === "library" ? "active" : ""}`} onClick={() => setActiveTab("library")}>
            <BookMarked size={18} /><span>My Library ({library.length})</span>
          </button>
          <button className={`sidebar-link ${activeTab === "discover" ? "active" : ""}`} onClick={() => setActiveTab("discover")}>
            <Search size={18} /><span>Discover marketplace</span>
          </button>
          <button className={`sidebar-link ${activeTab === "readinglist" ? "active" : ""}`} onClick={() => setActiveTab("readinglist")}>
            <Heart size={18} /><span>Reading List ({readingList.length})</span>
          </button>
          <button className={`sidebar-link ${activeTab === "myreviews" ? "active" : ""}`} onClick={() => setActiveTab("myreviews")}>
            <Star size={18} /><span>My Reviews ({myReviews.length})</span>
          </button>
          <button className={`sidebar-link ${activeTab === "matchmaker" ? "active" : ""}`} onClick={() => setActiveTab("matchmaker")}>
            <UserCheck size={18} /><span>Matchmaker</span>
          </button>
          <button className={`sidebar-link ${activeTab === "messages" ? "active" : ""}`} onClick={() => setActiveTab("messages")}>
            <MessageCircle size={18} /><span>Messages</span>
          </button>
        </nav>

        {/* Wallet Balance widget */}
        <div style={{
          margin: "10px 16px",
          padding: "12px 14px",
          background: "rgba(5, 150, 105, 0.04)",
          border: "1px solid rgba(5, 150, 105, 0.12)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4
        }}>
          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>Wallet Balance</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DollarSign size={14} color="#059669" />
            <strong style={{ fontSize: 15, color: "#1e293b", fontFamily: "sans-serif" }}>
              ${user?.walletBalance !== undefined ? user.walletBalance.toFixed(2) : "1,000.00"}
            </strong>
          </div>
        </div>

        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={16} /><span>Sign out</span>
        </button>
      </aside>

      {/* Main Area */}
      <div className="dashboard-main">
        <div className="dash-body">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Welcome, {user?.name?.split(" ")[0]} 👋</h1>
                  <p>Read books, rate manuscripts, and explore personalized recommendations.</p>
                </div>
                <button onClick={() => setActiveTab("discover")} className="btn-primary-dash" style={{ background: "#059669" }}>
                  <Search size={16} /> Browse Marketplace
                </button>
              </div>

              <div className="stats-row">
                <StatCard icon={<BookOpen size={20} />} label="Library Books" value={library.length} color="#059669" />
                <StatCard icon={<Star size={20} />} label="My Rated Books" value={myReviews.length} color="#f59e0b" />
                <StatCard icon={<Heart size={20} />} label="Saved Books" value={readingList.length} color="#ef4444" />
                <StatCard icon={<Sparkles size={20} />} label="Interest Matches" value={authors.length} color="#7c3aed" />
              </div>

              <div className="dash-grid">
                {/* Current Reads / Library progress */}
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>My Reading Progress</h3>
                    <button className="panel-link" onClick={() => setActiveTab("library")}>Go to library</button>
                  </div>
                  {library.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#94a3b8", padding: "10px 0" }}>No books unlocked yet. Go to Discover to unlock!</p>
                  ) : (
                    library.slice(0, 3).map((b) => {
                      const pct = progresses[b._id] || 0;
                      return (
                        <div key={b._id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                          <div style={{ display: "flex", justify: "space-between", fontSize: 13, fontWeight: "bold" }}>
                            <span>{b.title}</span>
                            <span style={{ color: "#059669" }}>{pct}% read</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={e => handleProgressChange(b._id, e.target.value)}
                            style={{ width: "100%", accentColor: "#059669" }}
                          />
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Recommendations */}
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Personalized Recommendations</h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {discoverBooks.slice(0, 2).map((b) => (
                      <div key={b._id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, background: "rgba(5, 150, 105, 0.03)", borderRadius: 8, border: "1px solid rgba(5, 150, 105, 0.1)" }}>
                        <BookOpen size={24} color="#059669" />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{b.title}</span>
                          <span style={{ fontSize: 10, color: "#64748b" }}>Recommended based on your interest in: {b.genre}</span>
                        </div>
                        <button
                          onClick={() => { setSelectedBook(b); setActiveTab("discover"); }}
                          style={{ border: "none", background: "none", color: "#059669", cursor: "pointer" }}
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

          {/* MY LIBRARY TAB */}
          {activeTab === "library" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>My Library</h1>
                  <p>Read full books and adjust your progress levels.</p>
                </div>
              </div>

              {library.length === 0 ? (
                <div className="glass-panel" style={{ padding: 40, textAlign: "center" }}>
                  <BookMarked size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                  <p style={{ color: "#64748b" }}>Your library is empty. Go search the marketplace to unlock books!</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {library.map((b) => {
                    const pct = progresses[b._id] || 0;
                    return (
                      <div key={b._id} className="glass-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ width: 40, height: 50, background: "#ecfdf5", color: "#059669", borderRadius: 8, display: "flex", alignItems: "center", justify: "center" }}>
                            <span style={{ margin: "auto" }}><BookOpen size={18} /></span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</span>
                            <span style={{ display: "block", fontSize: 10, color: "#64748b" }}>by {b.author?.name}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justify: "space-between", fontSize: 11, marginBottom: 4 }}>
                            <span>Progress Tracker</span>
                            <strong style={{ color: "#059669" }}>{pct}%</strong>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={e => handleProgressChange(b._id, e.target.value)}
                            style={{ width: "100%", accentColor: "#059669" }}
                          />
                        </div>

                        <button
                          onClick={() => { setSelectedBook(b); setActiveChapterIdx(0); }}
                          style={{
                            width: "100%",
                            padding: "8px",
                            background: "#059669",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: "bold",
                            cursor: "pointer",
                            marginTop: 6
                          }}
                        >
                          Read Chapters
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Book Chapters Reader Panel */}
              {selectedBook && activeChapterIdx !== null && (
                <div 
                  className="glass-panel animate-fade-in" 
                  style={{ 
                    padding: 0, 
                    marginTop: 24, 
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid rgba(0,0,0,0.08)",
                    boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)"
                  }}
                >
                  {/* Top Bar */}
                  <div style={{ 
                    display: "flex", 
                    justify: "space-between", 
                    alignItems: "center", 
                    padding: "16px 24px",
                    background: "rgba(255,255,255,0.02)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)"
                  }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: "bold", margin: 0 }}>{selectedBook.title}</h3>
                      <span style={{ fontSize: 12, color: "#64748b" }}>by {selectedBook.author?.name}</span>
                    </div>
                    <button 
                      onClick={() => { setActiveChapterIdx(null); setSelectedBook(null); }} 
                      className="btn-secondary"
                      style={{ padding: "6px 12px", fontSize: 12, borderColor: "#ef4444", color: "#ef4444" }}
                    >
                      Close Reader
                    </button>
                  </div>

                  {/* Settings Control Panel */}
                  <div style={{ 
                    display: "flex", 
                    justify: "space-between", 
                    alignItems: "center", 
                    flexWrap: "wrap",
                    gap: 12,
                    padding: "12px 24px", 
                    background: "rgba(0,0,0,0.02)",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    fontSize: 12
                  }}>
                    {/* Theme selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#64748b", fontWeight: 500 }}>Theme:</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {[
                          { id: "light", label: "Light", bg: "#ffffff", color: "#1f2937", border: "#e2e8f0" },
                          { id: "sepia", label: "Sepia ☕", bg: "#fbf0e3", color: "#433422", border: "#f3e1cb" },
                          { id: "dark", label: "Dark 🌙", bg: "#151522", color: "#e2e8f0", border: "#27273a" }
                        ].map(t => (
                          <button
                            key={t.id}
                            onClick={() => setReaderTheme(t.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 6,
                              border: readerTheme === t.id ? `2px solid #059669` : `1px solid ${t.border}`,
                              background: t.bg,
                              color: t.color,
                              fontWeight: readerTheme === t.id ? "bold" : "normal",
                              cursor: "pointer",
                              fontSize: 11,
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                            }}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font size selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#64748b", fontWeight: 500 }}>Font Size:</span>
                      <div style={{ display: "flex", gap: 4 }}>
                        {[
                          { id: "small", label: "A-", val: "14px" },
                          { id: "medium", label: "A", val: "16px" },
                          { id: "large", label: "A+", val: "20px" },
                          { id: "xl", label: "A++", val: "24px" }
                        ].map(sz => (
                          <button
                            key={sz.id}
                            onClick={() => setReaderFontSize(sz.id)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid #d1d5db",
                              background: readerFontSize === sz.id ? "#059669" : "#ffffff",
                              color: readerFontSize === sz.id ? "#ffffff" : "#374151",
                              fontWeight: "bold",
                              cursor: "pointer",
                              fontSize: sz.id === "small" ? 10 : sz.id === "medium" ? 11 : sz.id === "large" ? 13 : 15
                            }}
                          >
                            {sz.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Main Book Reader Layout */}
                  <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", minHeight: "500px" }}>
                    {/* Sidebar Chapters navigation */}
                    <div style={{ 
                      background: "rgba(0,0,0,0.01)",
                      borderRight: "1px solid rgba(0,0,0,0.06)", 
                      padding: 16, 
                      display: "flex", 
                      flexDirection: "column", 
                      gap: 6,
                      maxHeight: "600px",
                      overflowY: "auto"
                    }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, paddingLeft: 8 }}>
                        Table of Contents
                      </div>
                      {selectedBook.chapters?.map((ch, idx) => (
                        <button
                          key={ch._id || idx}
                          onClick={() => setActiveChapterIdx(idx)}
                          style={{
                            padding: "10px 14px",
                            border: "none",
                            borderRadius: 8,
                            textAlign: "left",
                            fontSize: 12,
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            background: activeChapterIdx === idx ? "rgba(5, 150, 105, 0.1)" : "transparent",
                            color: activeChapterIdx === idx ? "#059669" : "#334155",
                            fontWeight: activeChapterIdx === idx ? "bold" : "normal"
                          }}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ 
                              width: 18, 
                              height: 18, 
                              borderRadius: "50%", 
                              background: activeChapterIdx === idx ? "#059669" : "rgba(0,0,0,0.05)",
                              color: activeChapterIdx === idx ? "#fff" : "#64748b",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 9,
                              fontWeight: "bold"
                            }}>
                              {idx + 1}
                            </span>
                            <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", flex: 1 }}>
                              {ch.title || `Chapter ${idx + 1}`}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Chapter Content area styled with themes */}
                    <div style={{
                      position: "relative",
                      padding: "40px 80px",
                      overflowY: "auto",
                      maxHeight: "600px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      background: readerTheme === "light" ? "#ffffff" : readerTheme === "sepia" ? "#fbf0e3" : "#151522",
                      color: readerTheme === "light" ? "#1f2937" : readerTheme === "sepia" ? "#433422" : "#e2e8f0",
                      transition: "all 0.3s ease"
                    }}>
                      {/* Left click navigation zone */}
                      {activeChapterIdx > 0 && (
                        <div
                          onClick={() => setActiveChapterIdx(prev => prev - 1)}
                          title="Previous Chapter"
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: "70px",
                            height: "100%",
                            cursor: "w-resize",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10,
                            background: "linear-gradient(to right, rgba(0,0,0,0.03), transparent)",
                            transition: "all 0.2s ease",
                            opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "linear-gradient(to right, rgba(0,0,0,0.06), transparent)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = "linear-gradient(to right, rgba(0,0,0,0.03), transparent)"; }}
                        >
                          <span style={{ fontSize: 32, opacity: 0.6, fontWeight: "300" }}>‹</span>
                        </div>
                      )}

                      {/* Right click navigation zone */}
                      {selectedBook.chapters && activeChapterIdx < selectedBook.chapters.length - 1 && (
                        <div
                          onClick={() => {
                            const nextIdx = activeChapterIdx + 1;
                            setActiveChapterIdx(nextIdx);
                            const newPct = Math.round((nextIdx / selectedBook.chapters.length) * 100);
                            handleProgressChange(selectedBook._id, newPct);
                          }}
                          title="Next Chapter"
                          style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: "70px",
                            height: "100%",
                            cursor: "e-resize",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 10,
                            background: "linear-gradient(to left, rgba(0,0,0,0.03), transparent)",
                            transition: "all 0.2s ease",
                            opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "linear-gradient(to left, rgba(0,0,0,0.06), transparent)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = "linear-gradient(to left, rgba(0,0,0,0.03), transparent)"; }}
                        >
                          <span style={{ fontSize: 32, opacity: 0.6, fontWeight: "300" }}>›</span>
                        </div>
                      )}

                      {selectedBook.chapters && selectedBook.chapters[activeChapterIdx] ? (
                        <div style={{ 
                          maxWidth: "680px", 
                          width: "100%",
                          fontFamily: "Georgia, serif"
                        }}>
                          {/* Chapter Title */}
                          <h2 style={{ 
                            fontSize: 26, 
                            fontWeight: "bold", 
                            marginBottom: 24, 
                            borderBottom: `1px solid ${readerTheme === "light" ? "rgba(0,0,0,0.08)" : readerTheme === "sepia" ? "rgba(67,52,34,0.1)" : "rgba(255,255,255,0.1)"}`,
                            paddingBottom: 16,
                            textAlign: "center",
                            color: "inherit"
                          }}>
                            {selectedBook.chapters[activeChapterIdx].title}
                          </h2>

                          {/* Chapter Body */}
                          <div style={{ 
                            fontSize: readerFontSize === "small" ? "14px" : readerFontSize === "medium" ? "17px" : readerFontSize === "large" ? "21px" : "25px",
                            lineHeight: 1.8, 
                            whiteSpace: "pre-wrap",
                            textAlign: "justify",
                            color: "inherit"
                          }}>
                            {selectedBook.chapters[activeChapterIdx].content}
                          </div>

                          {/* Bottom Metadata Info */}
                          <div style={{ 
                            display: "flex", 
                            justify: "center", 
                            alignItems: "center", 
                            marginTop: 48,
                            paddingTop: 24,
                            borderTop: `1px solid ${readerTheme === "light" ? "rgba(0,0,0,0.08)" : readerTheme === "sepia" ? "rgba(67,52,34,0.1)" : "rgba(255,255,255,0.1)"}`
                          }}>
                            <span style={{ fontSize: 12, color: "#64748b", fontFamily: "sans-serif" }}>
                              Chapter {activeChapterIdx + 1} of {selectedBook.chapters.length} • Click side edges to turn pages
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p style={{ color: "#94a3b8" }}>No chapter content loaded.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DISCOVER MARKETPLACE TAB */}
          {activeTab === "discover" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Discover Marketplace</h1>
                  <p>Browse books published on the ledger, unlock premium manuscripts, and leave reviews.</p>
                </div>
              </div>

              {/* Search & Genre row */}
              <div className="glass-panel" style={{ padding: 20 }}>
                <form onSubmit={handleSearch} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search titles, descriptions, authors..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn-primary" style={{ background: "#059669" }}>Search</button>
                </form>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["", "fiction", "non-fiction", "science", "technology", "poetry", "mystery", "romance"].map(g => (
                    <button
                      key={g}
                      onClick={() => handleGenreChange(g)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 20,
                        border: "1.5px solid #ede9fe",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        background: selectedGenre === g ? "#059669" : "#fff",
                        color: selectedGenre === g ? "#fff" : "#64748b"
                      }}
                    >
                      {g || "All Genres"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marketplace list */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {loadingDiscover ? (
                  <div style={{ gridColumn: "1/-1", display: "flex", justify: "center", padding: 40 }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : discoverBooks.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", color: "#94a3b8" }}>No published books found.</p>
                ) : (
                  discoverBooks.map(b => {
                    const unlocked = isUnlocked(b._id);
                    const pinned = readingList.some(item => item._id === b._id);

                    return (
                      <div key={b._id} className="glass-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", justify: "space-between" }}>
                            <span className="book-status new" style={{ textTransform: "capitalize", background: "rgba(5, 150, 105, 0.1)", color: "#059669" }}>{b.genre}</span>
                            <button onClick={() => toggleReadingList(b)} style={{ background: "none", border: "none", color: pinned ? "#ef4444" : "#94a3b8", cursor: "pointer" }}>
                              <Heart size={16} fill={pinned ? "currentColor" : "none"} />
                            </button>
                          </div>
                          <h3 style={{ fontSize: 14, fontWeight: "bold", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</h3>
                          <span style={{ fontSize: 11, color: "#64748b" }}>by {b.author?.name}</span>
                        </div>

                        <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", height: 50 }}>
                          {b.description}
                        </p>

                        <div style={{ display: "flex", justify: "space-between", alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: "bold", color: "#1a1a2e" }}>
                            {b.isPaid ? `$${b.price}` : "Free"}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#f59e0b" }}>
                            <Star size={12} fill="currentColor" /> {b.averageRating > 0 ? b.averageRating : "—"}
                          </span>
                        </div>

                        {unlocked ? (
                          <button
                            onClick={() => { setSelectedBook(b); }}
                            className="btn-secondary"
                            style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: 8, borderColor: "#059669", color: "#059669" }}
                          >
                            Read Details & Reviews
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchaseBook(b)}
                            className="btn-primary"
                            style={{ width: "100%", justify: "center", fontSize: 12, padding: 8, background: "#059669" }}
                          >
                            {b.isPaid ? `Purchase Book ($${b.price})` : "Unlock Free Book"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Book reviews detail panel overlay */}
              {selectedBook && !activeChapterIdx && (
                <div className="glass-panel" style={{ padding: 24, marginTop: 20 }}>
                  <div style={{ display: "flex", justify: "space-between", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 12, marginBottom: 16 }}>
                    <div>
                      <h2>{selectedBook.title} Reviews</h2>
                      <span style={{ fontSize: 12 }}>Average Rating: <strong style={{ color: "#f59e0b" }}>{selectedBook.averageRating} / 5</strong> ({selectedBook.ratings?.length || 0} reviews)</span>
                    </div>
                    <button onClick={() => setSelectedBook(null)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 12 }}>Close</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                    {/* Add/Edit Review form */}
                    <div>
                      <h4>Submit Rating & Review</h4>
                      <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                        <div>
                          <label className="form-label" style={{ fontSize: 12 }}>Choose Stars:</label>
                          <RatingStars rating={reviewRating} setRating={setReviewRating} size={22} />
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: 12 }}>Review Comments:</label>
                          <textarea
                            className="input-field"
                            required
                            placeholder="Write your review here..."
                            value={reviewText}
                            onChange={e => setReviewText(e.target.value)}
                            style={{ height: 80, fontSize: 12 }}
                          />
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button type="submit" disabled={submittingReview} className="btn-primary" style={{ background: "#059669", padding: "6px 16px", fontSize: 12 }}>
                            Submit Review
                          </button>
                          {selectedBook.ratings?.some(r => r.user === user?._id || r.user?._id === user?._id) && (
                            <button type="button" onClick={handleDeleteReview} className="btn-secondary" style={{ padding: "6px 16px", fontSize: 12, borderColor: "#ef4444", color: "#ef4444" }}>
                              Delete Review
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* Review Feed */}
                    <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                      <h4>Reader Reviews Feed</h4>
                      {selectedBook.ratings?.length === 0 ? (
                        <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 10 }}>No reviews left yet.</p>
                      ) : (
                        selectedBook.ratings?.map((r, idx) => (
                          <div key={idx} style={{ padding: 10, background: "rgba(0,0,0,0.01)", border: "1px solid rgba(0,0,0,0.03)", borderRadius: 8 }}>
                            <div style={{ display: "flex", justify: "space-between", alignItems: "center" }}>
                              <strong style={{ fontSize: 12 }}>Reader {r.user?.name || "Anonymous"}</strong>
                              <RatingStars rating={r.rating} readOnly size={12} />
                            </div>
                            <p style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>{r.review}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>Your reading list is empty.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {readingList.map(b => (
                      <div key={b._id} style={{ display: "flex", justify: "space-between", alignItems: "center", padding: 14, background: "rgba(0,0,0,0.01)", border: "1px solid rgba(0,0,0,0.03)", borderRadius: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <BookMarked size={18} color="#059669" />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{b.title}</span>
                            <span style={{ fontSize: 10, color: "#64748b" }}>by {b.author?.name}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedBook(b); setActiveTab("discover"); }}
                          style={{
                            padding: "5px 12px",
                            background: "rgba(5, 150, 105, 0.1)",
                            color: "#059669",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: "bold",
                            cursor: "pointer"
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
                  <p>Feedback ratings and commentary you have published for books.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                {myReviews.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>You have not left any ratings or reviews yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {myReviews.map(b => {
                      const userRating = b.ratings.find(r => r.user === user?._id || r.user?._id === user?._id);
                      return (
                        <div key={b._id} style={{ padding: 16, background: "rgba(0,0,0,0.01)", border: "1px solid rgba(0,0,0,0.03)", borderRadius: 10, display: "flex", justify: "space-between", alignItems: "center" }}>
                          <div>
                            <strong style={{ fontSize: 13, display: "block" }}>{b.title}</strong>
                            <p style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>"{userRating?.review || "Rated only"}"</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <RatingStars rating={userRating?.rating || 0} readOnly size={14} />
                            <button
                              onClick={() => { setSelectedBook(b); setActiveTab("discover"); }}
                              className="edit-btn"
                              style={{ background: "#ede9fe", color: "#7c3aed" }}
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

          {/* DYNAMIC MATCHMAKER TAB */}
          {activeTab === "matchmaker" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Reader-Writer Matching Engine</h1>
                  <p>Our NLP profile similarity matcher links you with authors sharing overlapping tag interests.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 20 }}>
                {loadingAuthors ? (
                  <div style={{ display: "flex", justify: "center", padding: 20 }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : authors.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#94a3b8" }}>No authors registered on the platform.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {authors.map((a, idx) => {
                      // Calculate overlap matches
                      const overlap = a.interests?.filter(tag => user?.interests?.includes(tag)) || [];
                      const matchPct = overlap.length > 0 ? Math.round((overlap.length / Math.max(user?.interests?.length || 1, 1)) * 100) : 10 + (idx % 3) * 10;

                      return (
                        <div key={a._id} style={{ padding: 18, background: "rgba(124, 58, 237, 0.02)", border: "1px solid rgba(124, 58, 237, 0.1)", borderRadius: 12, display: "flex", justify: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, fontWeight: "bold" }}>{a.name}</span>
                              <span style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed", padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: "bold" }}>
                                {matchPct}% Profile Match
                              </span>
                            </div>
                            <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 4 }}>{a.bio || "Bio not specified by writer."}</span>
                            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                              {a.interests?.map((tag) => (
                                <span key={tag} style={{ fontSize: 9, background: "rgba(0,0,0,0.03)", padding: "2px 6px", borderRadius: 4, textTransform: "capitalize" }}>{tag}</span>
                              ))}
                            </div>
                          </div>

                          <button
                            onClick={() => { alert("Matchmaker simulation: Author added to reading recommendations list!"); }}
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
                              gap: 4
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

          {/* MESSAGES / CHAT TAB */}
          {activeTab === "messages" && (
            <div className="dash-content animate-fade-in" style={{ height: "calc(100vh - 120px)" }}>
              <ChatInterface user={user} currentRole="reader" token={token} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ReaderDashboard;
