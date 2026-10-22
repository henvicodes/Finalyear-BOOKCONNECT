import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BookOpen, Eye, EyeOff, Star, Search, Clock, CheckCircle, Plus, BookMarked, Layers,
  DollarSign, UserCheck, Settings, Heart, AlertCircle, RefreshCw, ChevronRight, Sparkles, LogOut, BarChart2, MessageCircle,
  Languages, Highlighter, Lock, HelpCircle, UserCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DashboardTopBar from "../components/DashboardTopBar";

// Same language list BookDetail.jsx offers — "english" included so books
// written in another language can be translated back to English too.
const TRANSLATE_LANGUAGES = [
  "english", "hindi", "marathi", "bengali", "tamil", "telugu", "gujarati",
  "kannada", "malayalam", "punjabi", "spanish", "french", "german", "chinese", "japanese", "arabic",
];
import RatingStars from "../components/RatingStars";
import ChatInterface from "../components/ChatInterface";
import WalletPinModal from "../components/WalletPinModal";
import ThemeToggle from "../components/ThemeToggle";
import FeatureGuide from "../components/FeatureGuide";
import WelcomeBanner from "../components/WelcomeBanner";
import HelpTip from "../components/HelpTip";
import { useAuth } from "../context/AuthContext";
import { payOnChainIfLinked } from "../services/chainPayment";
import { authorOf, sourceLine } from "../utils/bookDisplay";

import { API_URL } from "../config";
const BASE_URL = API_URL;

// Format helper

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
  const { updateUserFields, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false); // sidebar drawer on phones
  const [library, setLibrary] = useState([]);
  const [showBalance, setShowBalance] = useState(false);
  const [balancePinOpen, setBalancePinOpen] = useState(false);
  const [purchasePinOpen, setPurchasePinOpen] = useState(false);
  const [pendingPurchaseBook, setPendingPurchaseBook] = useState(null);

  // Discover Marketplace
  const [discoverBooks, setDiscoverBooks] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [discoverSort, setDiscoverSort] = useState("ranked"); // best-rated first, not newest first
  const [discoverPrice, setDiscoverPrice] = useState(""); // "", "paid" or "free"
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotal, setDiscoverTotal] = useState(0);
  const [discoverPages, setDiscoverPages] = useState(1);
  const DISCOVER_PAGE_SIZE = 24;

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

  // The book list (discoverBooks) never carries chapter text anymore —
  // it's fetched on demand per-chapter through the purchase-gated
  // endpoint, so a paid book's content can't be read before it's bought.
  const [activeChapterContent, setActiveChapterContent] = useState(null);
  const [chapterContentLoading, setChapterContentLoading] = useState(false);
  const [chapterPaywall, setChapterPaywall] = useState(null); // { price } when locked

  // Reader display settings (Wattpad / Magazine style)
  const [readerTheme, setReaderTheme] = useState("sepia");
  const [readerFontSize, setReaderFontSize] = useState("medium");

  // In-reader translation (same feature as the standalone BookDetail page,
  // wired in here too since readers mostly read through this dashboard's
  // own reader, not the standalone /books/:id page)
  const [readerTargetLanguage, setReaderTargetLanguage] = useState("hindi");
  const [readerTranslatedText, setReaderTranslatedText] = useState(null);
  const [readerTranslating, setReaderTranslating] = useState(false);
  const [readerTranslateError, setReaderTranslateError] = useState("");

  // In-reader highlights — saved locally per book+chapter, like the
  // existing reading-progress/reading-list preferences
  const [highlights, setHighlights] = useState(() => {
    try {
      const saved = localStorage.getItem("reader_highlights");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [selectionPopup, setSelectionPopup] = useState(null); // { text, x, y }

  // Reviews CRUD states
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Settings tab (profile + appearance)
  const [settingsName, setSettingsName] = useState(user?.name || "");
  const [settingsBio, setSettingsBio] = useState(user?.bio || "");
  const [settingsInterests, setSettingsInterests] = useState(user?.interests || []);
  const [savingSettings, setSavingSettings] = useState(false);
  const availableInterests = [
    "fiction", "non-fiction", "science", "technology", "poetry", "drama", "history", "biography"
  ];

  // Reader-writer matches for Matchmaker (from /api/matching — real TF-IDF
  // profile-similarity matching, not the old client-side interest overlap)
  const [authors, setAuthors] = useState([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);
  const [matchesPersonalized, setMatchesPersonalized] = useState(false);

  // Contact to auto-open when the Messages tab is entered (e.g. from
  // "Message" on a matched author) — cleared once ChatInterface picks it up.
  const [pendingChatContact, setPendingChatContact] = useState(null);

  useEffect(() => {
    fetchLibrary();
    fetchDiscoverBooks();
    fetchAuthors();
  }, []);

  // Reset any translated view / pending highlight popup whenever the
  // reader moves to a different chapter or closes the book, and fetch
  // that chapter's actual content on demand (see fetchChapterContent).
  useEffect(() => {
    setReaderTranslatedText(null);
    setReaderTranslateError("");
    setSelectionPopup(null);

    const chapter = selectedBook?.chapters?.[activeChapterIdx];
    if (selectedBook && chapter) {
      fetchChapterContent(selectedBook._id, chapter._id);
    } else {
      setActiveChapterContent(null);
      setChapterPaywall(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChapterIdx, selectedBook?._id]);

  const fetchLibrary = async () => {
    try {
      const { data } = await axios.get(`${BASE_URL}/api/reader/user/library`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setLibrary(data.data || []);
      }
    } catch (err) {
      console.error("Library fetch error:", err);
    }
  };

  // Fetches one chapter's actual text on demand — the discover/library
  // list responses never include chapter content, so a paid book's text
  // literally doesn't exist client-side until this call succeeds (which
  // the backend only allows for a purchaser or the book's own author).
  const fetchChapterContent = async (bookId, chapterId) => {
    setChapterContentLoading(true);
    setChapterPaywall(null);
    setActiveChapterContent(null);
    try {
      const { data } = await axios.get(
        `${BASE_URL}/api/books/${bookId}/chapters/${chapterId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (data.success) {
        setActiveChapterContent(data.data.chapter);
      }
    } catch (err) {
      if (err.response?.data?.requiresPurchase) {
        setChapterPaywall({ price: err.response.data.price });
      } else {
        console.error(err);
      }
    } finally {
      setChapterContentLoading(false);
    }
  };

  // Loads one page of the marketplace. Anything not passed uses the current filters,
  // so callers only say what changed. page > 1 adds to the list ("show more").
  const fetchDiscoverBooks = async ({
    genre = selectedGenre,
    search = searchQuery,
    sort = discoverSort,
    price = discoverPrice,
    page = 1,
  } = {}) => {
    setLoadingDiscover(page === 1);
    try {
      const params = new URLSearchParams();
      params.set("status", "published");
      params.set("limit", String(DISCOVER_PAGE_SIZE));
      params.set("page", String(page));
      params.set("sort", sort);
      if (genre) params.set("genre", genre);
      if (search) params.set("search", search);
      if (price === "paid") params.set("isPaid", "true");
      if (price === "free") params.set("isPaid", "false");

      const { data } = await axios.get(`${BASE_URL}/api/books?${params.toString()}`);
      if (data.success) {
        setDiscoverBooks((prev) => (page > 1 ? [...prev, ...(data.data || [])] : data.data || []));
        setDiscoverPage(page);
        setDiscoverTotal(data.pagination?.total ?? (data.data || []).length);
        setDiscoverPages(data.pagination?.pages ?? 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDiscover(false);
    }
  };

  const changeSort = (sort) => {
    setDiscoverSort(sort);
    fetchDiscoverBooks({ sort });
  };

  const changePrice = (price) => {
    setDiscoverPrice(price);
    fetchDiscoverBooks({ price });
  };

  const fetchAuthors = async () => {
    setLoadingAuthors(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/matching`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setAuthors(data.data);
        setMatchesPersonalized(data.personalized);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAuthors(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDiscoverBooks();
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    fetchDiscoverBooks({ genre });
  };

  // Purchase/Unlock a paid book — now PIN + MetaMask gated
  const handlePurchaseBook = (book) => {
    const isPaid = book.isPaid || book.price > 0;
    if (!isPaid) {
      // Free unlock: no PIN/MetaMask needed, proceed directly
      executePurchase(book, "", "");
      return;
    }
    setPendingPurchaseBook(book);
    setPurchasePinOpen(true);
  };

  const executePurchase = async (book, txHash, pin) => {
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/reader/${book._id}/purchase`,
        { txHash, pin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        alert(data.message + (txHash ? `\nTx: ${txHash.slice(0, 14)}...` : ""));
        if (data.walletBalance !== undefined) {
          updateUserFields({ walletBalance: data.walletBalance });
        }
        fetchLibrary();
        fetchDiscoverBooks();
        // If the reader just bought the book they were mid-paywall on,
        // immediately fetch the chapter they were trying to read instead
        // of leaving the "Purchase to continue" screen up.
        if (chapterPaywall && selectedBook?._id === book._id && selectedBook.chapters?.[activeChapterIdx]) {
          fetchChapterContent(book._id, selectedBook.chapters[activeChapterIdx]._id);
        }
      }
    } catch (err) {
      alert(err.response?.data?.message || "Purchase failed.");
    }
  };

  const handlePurchaseAfterPin = async (pin) => {
    const book = pendingPurchaseBook;
    setPurchasePinOpen(false);
    setPendingPurchaseBook(null);
    if (!book) return;

    let txHash = "";
    try {
      ({ txHash } = await payOnChainIfLinked({
        payer: user,
        receiver: book.author,
        amountUsd: book.price || 0,
        purpose: "book_purchase",
      }));
    } catch (metamaskErr) {
      alert("MetaMask transaction failed: " + metamaskErr.message);
      return;
    }
    await executePurchase(book, txHash, pin);
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

  // ── In-reader translation ──────────────────────────────────────────────
  // Every language is always offered, including English — the Book model
  // defaults `language` to "english" for any book that never had it set
  // explicitly, so filtering out "the book's own language" would silently
  // hide English from almost every book. A genuine same-language attempt
  // is caught server-side with a clear error (readerTranslateError below).
  const readerAvailableLanguages = TRANSLATE_LANGUAGES;

  const handleReaderTranslate = async () => {
    if (!activeChapterContent?.content) return;
    setReaderTranslating(true);
    setReaderTranslateError("");
    try {
      const { data } = await axios.post(`${BASE_URL}/api/ai/translate`, {
        text: activeChapterContent.content,
        targetLanguage: readerTargetLanguage,
        sourceLanguage: selectedBook?.language,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setReaderTranslatedText(data.translatedText);
      }
    } catch (err) {
      setReaderTranslateError(err.response?.data?.message || "Translation failed. Please try again.");
    } finally {
      setReaderTranslating(false);
    }
  };

  // ── In-reader highlights (saved to localStorage per book+chapter) ────────
  const highlightKey = selectedBook && activeChapterIdx !== null ? `${selectedBook._id}_${activeChapterIdx}` : null;
  const currentHighlights = (highlightKey && highlights[highlightKey]) || [];

  const persistHighlights = (updated) => {
    setHighlights(updated);
    localStorage.setItem("reader_highlights", JSON.stringify(updated));
  };

  const handleChapterMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString()?.trim();
    if (text && text.length > 1 && text.length < 500 && highlightKey) {
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPopup({ text, x: rect.left + rect.width / 2, y: rect.top });
    } else {
      setSelectionPopup(null);
    }
  };

  const addHighlight = () => {
    if (!selectionPopup || !highlightKey) return;
    const newHighlight = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text: selectionPopup.text };
    const updated = { ...highlights, [highlightKey]: [...currentHighlights, newHighlight] };
    persistHighlights(updated);
    setSelectionPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = (id) => {
    if (!highlightKey) return;
    const updated = { ...highlights, [highlightKey]: currentHighlights.filter(h => h.id !== id) };
    persistHighlights(updated);
  };

  // Splits chapter text around each saved highlight's first occurrence and
  // wraps it in a clickable <mark> (click to remove).
  const renderChapterWithHighlights = (text) => {
    if (!text) return text;
    if (currentHighlights.length === 0) return text;

    const ranges = [];
    for (const h of currentHighlights) {
      if (!h.text) continue;
      const idx = text.indexOf(h.text);
      if (idx === -1) continue;
      ranges.push({ id: h.id, start: idx, end: idx + h.text.length });
    }
    ranges.sort((a, b) => a.start - b.start);
    const clean = [];
    let lastEnd = -1;
    for (const r of ranges) {
      if (r.start >= lastEnd) { clean.push(r); lastEnd = r.end; }
    }

    const nodes = [];
    let cursor = 0;
    clean.forEach((r) => {
      if (r.start > cursor) nodes.push(text.slice(cursor, r.start));
      nodes.push(
        <mark
          key={r.id}
          onClick={() => removeHighlight(r.id)}
          title="Click to remove highlight"
          style={{ background: "rgba(251, 191, 36, 0.45)", color: "inherit", borderRadius: 3, padding: "0 1px", cursor: "pointer" }}
        >
          {text.slice(r.start, r.end)}
        </mark>
      );
      cursor = r.end;
    });
    if (cursor < text.length) nodes.push(text.slice(cursor));
    return nodes;
  };

  // Quick star-rate from inside the reader itself (no need to close the
  // book and go back to "Read Details & Reviews" just to rate it).
  const myRatingForSelectedBook = selectedBook?.ratings?.find(
    r => r.user === user?._id || r.user?._id === user?._id
  );
  const handleQuickRate = async (stars) => {
    if (!selectedBook) return;
    try {
      const { data } = await axios.post(`${BASE_URL}/api/books/${selectedBook._id}/rate`, {
        rating: stars,
        review: myRatingForSelectedBook?.review || ""
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        const updatedBookRes = await axios.get(`${BASE_URL}/api/books/${selectedBook._id}`);
        if (updatedBookRes.data.success) {
          setSelectedBook(updatedBookRes.data.data);
        }
        fetchDiscoverBooks();
      }
    } catch {
      alert("Error submitting rating.");
    }
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
        fetchDiscoverBooks();
      }
    } catch {
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
      fetchDiscoverBooks();
    } catch {
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

  const TAB_TITLES = {
    overview: "Overview",
    library: "My Library",
    discover: "Discover marketplace",
    readinglist: "Reading List",
    myreviews: "My Reviews",
    matchmaker: "Matchmaker",
    messages: "Messages",
    settings: "Settings",
    help: "Help & Guide",
  };

  // searching from the top bar jumps to Discover with that text
  const searchFromTopBar = (text) => {
    setSearchQuery(text);
    setActiveTab("discover");
    fetchDiscoverBooks({ search: text });
  };

  return (
    <div className="dashboard-wrapper">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo"><BookOpen size={22} /><span>BookConnect</span></div>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: "var(--success)" }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-role-badge" style={{ background: "rgba(22, 163, 74, 0.1)", color: "var(--success)" }}>
              Reader
            </span>
          </div>
        </div>

        <nav className="sidebar-nav" onClick={() => setSidebarOpen(false)}>
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
          <button className="sidebar-link" onClick={() => navigate("/profile")} title="Your profile, MetaMask wallet and payment history">
            <UserCircle size={18} /><span>Profile & Wallet</span>
          </button>
          <button className={`sidebar-link ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <button className={`sidebar-link ${activeTab === "help" ? "active" : ""}`} onClick={() => setActiveTab("help")}>
            <HelpCircle size={18} /><span>Help & Guide</span>
          </button>
        </nav>

        {/* Wallet Balance widget — masked by default (GPay style) */}
        <div style={{
          margin: "10px 16px",
          padding: "12px 14px",
          background: "rgba(22, 163, 74, 0.04)",
          border: "1px solid rgba(22, 163, 74, 0.12)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>Wallet Balance</span>
            <HelpTip
              title="Wallet balance"
              text="Your in-app money, used to buy books and pay publishing fees. It is hidden by default — click the eye and enter your PIN to see it."
            />
            <button
              onClick={() => showBalance ? setShowBalance(false) : setBalancePinOpen(true)}
              style={{ background: "none", border: "none", color: "var(--success)", cursor: "pointer", padding: 0 }}
              title={showBalance ? "Hide balance" : "Reveal with PIN"}
            >
              {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DollarSign size={14} color="var(--success)" />
            <strong style={{ fontSize: 15, color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
              {showBalance
                ? `$${(user?.walletBalance !== undefined ? user.walletBalance : 1000).toFixed(2)}`
                : "$ ••••••"}
            </strong>
          </div>
        </div>

        <button className="sidebar-logout" onClick={onLogout}>
          <LogOut size={16} /><span>Sign out</span>
        </button>
      </aside>

      {/* PIN Modal — Reveal Balance */}
      <WalletPinModal
        isOpen={balancePinOpen}
        onClose={() => setBalancePinOpen(false)}
        onSuccess={() => { setShowBalance(true); setBalancePinOpen(false); }}
        token={token}
        title="Enter PIN to View Wallet Balance"
      />

      {/* PIN Modal — Purchase Authorization */}
      <WalletPinModal
        isOpen={purchasePinOpen}
        onClose={() => { setPurchasePinOpen(false); setPendingPurchaseBook(null); }}
        onSuccess={handlePurchaseAfterPin}
        token={token}
        title={`Enter PIN to Purchase "${pendingPurchaseBook?.title || "Book"}"`}
      />

      {/* Main Area */}
      <div className="dashboard-main">
        <DashboardTopBar
          title={TAB_TITLES[activeTab] || "Dashboard"}
          user={user}
          onMenu={() => setSidebarOpen(true)}
          onSearch={searchFromTopBar}
          searchHint="Search books, authors, genres…"
          menuItems={[
            { label: "Profile & Wallet", icon: <UserCircle size={16} />, onClick: () => navigate("/profile") },
            { label: "Settings", icon: <Settings size={16} />, onClick: () => setActiveTab("settings") },
            { label: "Help & Guide", icon: <HelpCircle size={16} />, onClick: () => setActiveTab("help") },
            { label: "Sign out", icon: <LogOut size={16} />, onClick: onLogout, danger: true },
          ]}
        />
        <div className="dash-body">
          
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Welcome, {user?.name?.split(" ")[0]} 👋</h1>
                  <p>Read books, rate manuscripts, and explore personalized recommendations.</p>
                </div>
                <button onClick={() => setActiveTab("discover")} className="btn-primary-dash" style={{ background: "var(--success)" }}>
                  <Search size={16} /> Browse Marketplace
                </button>
              </div>

              <WelcomeBanner role="reader" userId={user?._id} onOpenGuide={() => setActiveTab("help")} />

              <div className="stats-row">
                <StatCard icon={<BookOpen size={20} />} label="Library Books" value={library.length} color="var(--success)" />
                <StatCard icon={<Star size={20} />} label="My Rated Books" value={myReviews.length} color="var(--warning)" />
                <StatCard icon={<Heart size={20} />} label="Saved Books" value={readingList.length} color="var(--danger)" />
                <StatCard icon={<Sparkles size={20} />} label="Interest Matches" value={authors.length} color="var(--accent-600)" />
              </div>

              <div className="dash-grid">
                {/* Current Reads / Library progress */}
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>My Reading Progress</h3>
                    <button className="panel-link" onClick={() => setActiveTab("library")}>Go to library</button>
                  </div>
                  {library.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0" }}>No books unlocked yet. Go to Discover to unlock!</p>
                  ) : (
                    library.slice(0, 3).map((b) => {
                      const pct = progresses[b._id] || 0;
                      return (
                        <div key={b._id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 0", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)" }}>
                          <div style={{ display: "flex", justify: "space-between", fontSize: 13, fontWeight: "bold" }}>
                            <span>{b.title}</span>
                            <span style={{ color: "var(--success)" }}>{pct}% read</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={e => handleProgressChange(b._id, e.target.value)}
                            style={{ width: "100%", accentColor: "var(--success)" }}
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
                      <div key={b._id} style={{ display: "flex", gap: 12, alignItems: "center", padding: 10, background: "rgba(22, 163, 74, 0.03)", borderRadius: 8, border: "1px solid rgba(22, 163, 74, 0.1)" }}>
                        <BookOpen size={24} color="var(--success)" />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{b.title}</span>
                          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>Recommended based on your interest in: {b.genre}</span>
                        </div>
                        <button
                          onClick={() => { setSelectedBook(b); setActiveTab("discover"); }}
                          style={{ border: "none", background: "none", color: "var(--success)", cursor: "pointer" }}
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
                  <BookMarked size={48} color="var(--text-muted)" style={{ marginBottom: 12 }} />
                  <p style={{ color: "var(--text-secondary)" }}>Your library is empty. Go search the marketplace to unlock books!</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {library.map((b) => {
                    const pct = progresses[b._id] || 0;
                    return (
                      <div key={b._id} className="glass-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div style={{ width: 40, height: 50, background: "var(--success-bg)", color: "var(--success)", borderRadius: 8, display: "flex", alignItems: "center", justify: "center" }}>
                            <span style={{ margin: "auto" }}><BookOpen size={18} /></span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: 13, fontWeight: "bold", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</span>
                            <span style={{ display: "block", fontSize: 10, color: "var(--text-secondary)" }}>by {authorOf(b)}</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justify: "space-between", fontSize: 11, marginBottom: 4 }}>
                            <span>Progress Tracker</span>
                            <strong style={{ color: "var(--success)" }}>{pct}%</strong>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={e => handleProgressChange(b._id, e.target.value)}
                            style={{ width: "100%", accentColor: "var(--success)" }}
                          />
                        </div>

                        <button
                          onClick={() => { setSelectedBook(b); setActiveChapterIdx(0); }}
                          style={{
                            width: "100%",
                            padding: "8px",
                            background: "var(--success)",
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
                <>
                <div
                  className="glass-panel animate-fade-in"
                  style={{ 
                    padding: 0, 
                    marginTop: 24, 
                    borderRadius: 16,
                    overflow: "hidden",
                    border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
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
                    borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)"
                  }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: "bold", margin: 0 }}>{selectedBook.title}</h3>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>by {authorOf(selectedBook)}</span>
                      {sourceLine(selectedBook) && (
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-muted)" }}>{sourceLine(selectedBook)}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Rate:</span>
                        <RatingStars rating={myRatingForSelectedBook?.rating || 0} setRating={handleQuickRate} size={16} />
                      </div>
                      <button
                        onClick={() => { setActiveChapterIdx(null); setSelectedBook(null); }}
                        className="btn-secondary"
                        style={{ padding: "6px 12px", fontSize: 12, borderColor: "var(--danger)", color: "var(--danger)" }}
                      >
                        Close Reader
                      </button>
                    </div>
                  </div>

                  {/* Settings Control Panel */}
                  <div style={{ 
                    display: "flex", 
                    justify: "space-between", 
                    alignItems: "center", 
                    flexWrap: "wrap",
                    gap: 12,
                    padding: "12px 24px", 
                    background: "color-mix(in srgb, var(--text-primary) 2%, transparent)",
                    borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)",
                    fontSize: 12
                  }}>
                    {/* Theme selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Theme:</span>
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
                              border: readerTheme === t.id ? `2px solid var(--success)` : `1px solid ${t.border}`,
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
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>Font Size:</span>
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
                              border: "1px solid var(--gray-300)",
                              background: readerFontSize === sz.id ? "var(--success)" : "#ffffff",
                              color: readerFontSize === sz.id ? "#ffffff" : "var(--gray-700)",
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

                    {/* Translate selector */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "var(--text-secondary)", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
                        <Languages size={12} /> Translate:
                      </span>
                      <select
                        value={readerTargetLanguage}
                        onChange={(e) => { setReaderTargetLanguage(e.target.value); setReaderTranslatedText(null); }}
                        style={{ padding: "3px 6px", borderRadius: 4, border: "1px solid var(--gray-300)", fontSize: 11, background: "#ffffff", color: "var(--gray-700)" }}
                      >
                        {readerAvailableLanguages.map((lang) => (
                          <option key={lang} value={lang}>{lang.charAt(0).toUpperCase() + lang.slice(1)}</option>
                        ))}
                      </select>
                      {readerTranslatedText ? (
                        <button
                          onClick={() => setReaderTranslatedText(null)}
                          style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid var(--gray-300)", background: "#ffffff", color: "var(--gray-700)", fontWeight: "bold", cursor: "pointer", fontSize: 11 }}
                        >
                          Show Original
                        </button>
                      ) : (
                        <button
                          onClick={handleReaderTranslate}
                          disabled={readerTranslating}
                          style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "var(--success)", color: "#fff", fontWeight: "bold", cursor: readerTranslating ? "not-allowed" : "pointer", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <RefreshCw size={10} className={readerTranslating ? "spin" : ""} />
                          {readerTranslating ? "Translating..." : "Translate"}
                        </button>
                      )}
                      {readerTranslateError && (
                        <span style={{ color: "var(--danger)", fontSize: 11 }}>{readerTranslateError}</span>
                      )}
                    </div>
                  </div>

                  {/* Main Book Reader Layout */}
                  <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", minHeight: "500px" }}>
                    {/* Sidebar Chapters navigation */}
                    <div style={{ 
                      background: "color-mix(in srgb, var(--text-primary) 1%, transparent)",
                      borderRight: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", 
                      padding: 16, 
                      display: "flex", 
                      flexDirection: "column", 
                      gap: 6,
                      maxHeight: "600px",
                      overflowY: "auto"
                    }}>
                      <div style={{ fontSize: 11, fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, paddingLeft: 8 }}>
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
                            background: activeChapterIdx === idx ? "rgba(22, 163, 74, 0.1)" : "transparent",
                            color: activeChapterIdx === idx ? "var(--success)" : "var(--gray-700)",
                            fontWeight: activeChapterIdx === idx ? "bold" : "normal"
                          }}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ 
                              width: 18, 
                              height: 18, 
                              borderRadius: "50%", 
                              background: activeChapterIdx === idx ? "var(--success)" : "color-mix(in srgb, var(--text-primary) 5%, transparent)",
                              color: activeChapterIdx === idx ? "#fff" : "var(--text-secondary)",
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
                            background: "linear-gradient(to right, color-mix(in srgb, var(--text-primary) 3%, transparent), transparent)",
                            transition: "all 0.2s ease",
                            opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "linear-gradient(to right, color-mix(in srgb, var(--text-primary) 6%, transparent), transparent)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = "linear-gradient(to right, color-mix(in srgb, var(--text-primary) 3%, transparent), transparent)"; }}
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
                            background: "linear-gradient(to left, color-mix(in srgb, var(--text-primary) 3%, transparent), transparent)",
                            transition: "all 0.2s ease",
                            opacity: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.background = "linear-gradient(to left, color-mix(in srgb, var(--text-primary) 6%, transparent), transparent)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; e.currentTarget.style.background = "linear-gradient(to left, color-mix(in srgb, var(--text-primary) 3%, transparent), transparent)"; }}
                        >
                          <span style={{ fontSize: 32, opacity: 0.6, fontWeight: "300" }}>›</span>
                        </div>
                      )}

                      {chapterContentLoading ? (
                        <p style={{ color: "var(--text-muted)" }}>Loading chapter...</p>
                      ) : chapterPaywall ? (
                        <div style={{ maxWidth: 420, width: "100%", textAlign: "center", padding: "40px 20px" }}>
                          <Lock size={32} style={{ marginBottom: 12, opacity: 0.8 }} />
                          <h2 style={{ fontSize: 20, fontWeight: "bold", marginBottom: 8, color: "inherit" }}>This is a paid book</h2>
                          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 20 }}>
                            Purchase "{selectedBook.title}" for ${chapterPaywall.price} to keep reading.
                          </p>
                          <button
                            onClick={() => handlePurchaseBook(selectedBook)}
                            className="btn-primary-dash"
                            style={{ background: "var(--success)", display: "inline-flex" }}
                          >
                            Purchase Book (${chapterPaywall.price})
                          </button>
                        </div>
                      ) : selectedBook.chapters && selectedBook.chapters[activeChapterIdx] && activeChapterContent ? (
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
                            borderBottom: `1px solid ${readerTheme === "light" ? "color-mix(in srgb, var(--text-primary) 8%, transparent)" : readerTheme === "sepia" ? "rgba(67,52,34,0.1)" : "rgba(255,255,255,0.1)"}`,
                            paddingBottom: 16,
                            textAlign: "center",
                            color: "inherit"
                          }}>
                            {selectedBook.chapters[activeChapterIdx].title}
                          </h2>

                          {readerTranslatedText && (
                            <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, marginBottom: 8, textAlign: "center" }}>
                              Showing translation ({readerTargetLanguage.charAt(0).toUpperCase() + readerTargetLanguage.slice(1)}) — highlighting is available on the original text only
                            </div>
                          )}

                          {/* Chapter Body */}
                          <div
                            onMouseUp={readerTranslatedText ? undefined : handleChapterMouseUp}
                            style={{
                              fontSize: readerFontSize === "small" ? "14px" : readerFontSize === "medium" ? "17px" : readerFontSize === "large" ? "21px" : "25px",
                              lineHeight: 1.8,
                              whiteSpace: "pre-wrap",
                              textAlign: "justify",
                              color: "inherit"
                            }}
                          >
                            {readerTranslatedText || renderChapterWithHighlights(activeChapterContent.content)}
                          </div>

                          {/* Bottom Metadata Info */}
                          <div style={{
                            display: "flex",
                            justify: "center",
                            alignItems: "center",
                            marginTop: 48,
                            paddingTop: 24,
                            borderTop: `1px solid ${readerTheme === "light" ? "color-mix(in srgb, var(--text-primary) 8%, transparent)" : readerTheme === "sepia" ? "rgba(67,52,34,0.1)" : "rgba(255,255,255,0.1)"}`
                          }}>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontFamily: "sans-serif" }}>
                              Chapter {activeChapterIdx + 1} of {selectedBook.chapters.length} • Click side edges to turn pages
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p style={{ color: "var(--text-muted)" }}>No chapter content loaded.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Floating "Highlight" popup — appears near a text selection */}
                {selectionPopup && (
                  <div
                    style={{
                      position: "fixed",
                      left: selectionPopup.x,
                      top: Math.max(selectionPopup.y - 44, 8),
                      transform: "translateX(-50%)",
                      zIndex: 2000,
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}
                  >
                    <button
                      onClick={addHighlight}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#fbbf24", color: "#1f2937", border: "none",
                        borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
                      }}
                    >
                      <Highlighter size={13} /> Highlight
                    </button>
                    <button
                      onClick={() => setSelectionPopup(null)}
                      title="Dismiss"
                      style={{
                        background: "#1f2937", color: "#fff", border: "none",
                        borderRadius: 8, width: 24, height: 24, fontSize: 12, fontWeight: 700,
                        cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.25)"
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </>
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
                  <button type="submit" className="btn-primary" style={{ background: "var(--success)" }}>Search</button>
                </form>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["", "fiction", "non-fiction", "science", "technology", "poetry", "drama", "history", "biography", "mystery", "romance", "thriller", "fantasy", "horror", "children"].map(g => (
                    <button
                      key={g}
                      onClick={() => handleGenreChange(g)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 20,
                        border: "1.5px solid var(--accent-100)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        textTransform: "capitalize",
                        background: selectedGenre === g ? "var(--success)" : "#fff",
                        color: selectedGenre === g ? "#fff" : "var(--text-secondary)"
                      }}
                    >
                      {g || "All Genres"}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>Price</span>
                  {[["", "All"], ["paid", "Paid"], ["free", "Free"]].map(([value, label]) => (
                    <button
                      key={value || "all"}
                      onClick={() => changePrice(value)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 20,
                        border: "1.5px solid var(--accent-100)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        background: discoverPrice === value ? "var(--success)" : "#fff",
                        color: discoverPrice === value ? "#fff" : "var(--text-secondary)"
                      }}
                    >
                      {label}
                    </button>
                  ))}
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginLeft: 8 }}>Sort</span>
                  <select
                    value={discoverSort}
                    onChange={(e) => changeSort(e.target.value)}
                    className="input-field"
                    style={{ width: "auto", padding: "5px 10px", fontSize: 12 }}
                    aria-label="Sort books"
                  >
                    <option value="ranked">Top ranked</option>
                    <option value="-createdAt">Newest</option>
                    <option value="price">Price: low to high</option>
                    <option value="-price">Price: high to low</option>
                    <option value="title">Title A-Z</option>
                  </select>
                </div>
              </div>

              {/* Marketplace list */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
                {loadingDiscover ? (
                  <div style={{ gridColumn: "1/-1", display: "flex", justify: "center", padding: 40 }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : discoverBooks.length === 0 ? (
                  <p style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--text-muted)" }}>No published books found.</p>
                ) : (
                  discoverBooks.map(b => {
                    const unlocked = isUnlocked(b._id);
                    const pinned = readingList.some(item => item._id === b._id);

                    return (
                      <div key={b._id} className="glass-panel" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", justify: "space-between" }}>
                            <span className="book-status new" style={{ textTransform: "capitalize", background: "rgba(22, 163, 74, 0.1)", color: "var(--success)" }}>{b.genre}</span>
                            <button onClick={() => toggleReadingList(b)} style={{ background: "none", border: "none", color: pinned ? "var(--danger)" : "var(--text-muted)", cursor: "pointer" }}>
                              <Heart size={16} fill={pinned ? "currentColor" : "none"} />
                            </button>
                          </div>
                          <h3 style={{ fontSize: 14, fontWeight: "bold", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.title}</h3>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>by {authorOf(b)}</span>
                        </div>

                        <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", height: 50 }}>
                          {b.description}
                        </p>

                        <div style={{ display: "flex", justify: "space-between", alignItems: "center", marginTop: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--text-primary)" }}>
                            {b.isPaid ? `$${b.price}` : "Free"}
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--warning)" }}>
                            <Star size={12} fill="currentColor" /> {b.averageRating > 0 ? b.averageRating : "—"}
                          </span>
                        </div>

                        {unlocked ? (
                          <button
                            onClick={() => { setSelectedBook(b); }}
                            className="btn-secondary"
                            style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: 8, borderColor: "var(--success)", color: "var(--success)" }}
                          >
                            Read Details & Reviews
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchaseBook(b)}
                            className="btn-primary"
                            style={{ width: "100%", justify: "center", fontSize: 12, padding: 8, background: "var(--success)" }}
                          >
                            {b.isPaid ? `Purchase Book ($${b.price})` : "Unlock Free Book"}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {!loadingDiscover && discoverBooks.length > 0 && (
                <div style={{ textAlign: "center", marginTop: 20, color: "var(--text-secondary)", fontSize: 12 }}>
                  Showing {discoverBooks.length} of {discoverTotal} books
                  {discoverPage < discoverPages && (
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-primary" style={{ background: "var(--success)" }} onClick={() => fetchDiscoverBooks({ page: discoverPage + 1 })}>
                        Show more books
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Book reviews detail panel overlay */}
              {selectedBook && !activeChapterIdx && (
                <div className="glass-panel" style={{ padding: 24, marginTop: 20 }}>
                  <div style={{ display: "flex", justify: "space-between", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", paddingBottom: 12, marginBottom: 16 }}>
                    <div>
                      <h2>{selectedBook.title} Reviews</h2>
                      <span style={{ fontSize: 12 }}>Average Rating: <strong style={{ color: "var(--warning)" }}>{selectedBook.averageRating} / 5</strong> ({selectedBook.ratings?.length || 0} reviews)</span>
                    </div>
                    <button onClick={() => setSelectedBook(null)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12 }}>Close</button>
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
                          <button type="submit" disabled={submittingReview} className="btn-primary" style={{ background: "var(--success)", padding: "6px 16px", fontSize: 12 }}>
                            Submit Review
                          </button>
                          {selectedBook.ratings?.some(r => r.user === user?._id || r.user?._id === user?._id) && (
                            <button type="button" onClick={handleDeleteReview} className="btn-secondary" style={{ padding: "6px 16px", fontSize: 12, borderColor: "var(--danger)", color: "var(--danger)" }}>
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
                        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>No reviews left yet.</p>
                      ) : (
                        selectedBook.ratings?.map((r, idx) => (
                          <div key={idx} style={{ padding: 10, background: "color-mix(in srgb, var(--text-primary) 1%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)", borderRadius: 8 }}>
                            <div style={{ display: "flex", justify: "space-between", alignItems: "center" }}>
                              <strong style={{ fontSize: 12 }}>Reader {r.user?.name || "Anonymous"}</strong>
                              <RatingStars rating={r.rating} readOnly size={12} />
                            </div>
                            <p style={{ fontSize: 11, color: "var(--gray-700)", marginTop: 4 }}>{r.review}</p>
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
                  <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>Your reading list is empty.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {readingList.map(b => (
                      <div key={b._id} style={{ display: "flex", justify: "space-between", alignItems: "center", padding: 14, background: "color-mix(in srgb, var(--text-primary) 1%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)", borderRadius: 10 }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <BookMarked size={18} color="var(--success)" />
                          <div>
                            <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{b.title}</span>
                            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>by {authorOf(b)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => { setSelectedBook(b); setActiveTab("discover"); }}
                          style={{
                            padding: "5px 12px",
                            background: "rgba(22, 163, 74, 0.1)",
                            color: "var(--success)",
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
                  <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>You have not left any ratings or reviews yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {myReviews.map(b => {
                      const userRating = b.ratings.find(r => r.user === user?._id || r.user?._id === user?._id);
                      return (
                        <div key={b._id} style={{ padding: 16, background: "color-mix(in srgb, var(--text-primary) 1%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)", borderRadius: 10, display: "flex", justify: "space-between", alignItems: "center" }}>
                          <div>
                            <strong style={{ fontSize: 13, display: "block" }}>{b.title}</strong>
                            <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>"{userRating?.review || "Rated only"}"</p>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <RatingStars rating={userRating?.rating || 0} readOnly size={14} />
                            <button
                              onClick={() => { setSelectedBook(b); setActiveTab("discover"); }}
                              className="edit-btn"
                              style={{ background: "var(--accent-100)", color: "var(--accent-600)" }}
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
                  <p>
                    {matchesPersonalized
                      ? "Ranked by TF-IDF profile similarity — your bio, interests, and reading history against each author's/publisher's profile and published work."
                      : "Add a bio or a few interests to your profile, or purchase a book, to get ranked matches."}
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 20 }}>
                {loadingAuthors ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : authors.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)" }}>No authors or publishers registered on the platform yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {authors.map(({ user: a, score, reason }) => (
                      <div key={a._id} style={{ padding: 18, background: "rgba(79, 70, 229, 0.02)", border: "1px solid rgba(79, 70, 229, 0.1)", borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: "bold" }}>{a.name}</span>
                            <span style={{ background: "var(--accent-100)", color: "var(--accent-700)", padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: "bold", textTransform: "capitalize" }}>
                              {a.role}
                            </span>
                            {score !== null && (
                              <span style={{ background: "rgba(79, 70, 229, 0.1)", color: "var(--accent-600)", padding: "1px 6px", borderRadius: 10, fontSize: 10, fontWeight: "bold" }}>
                                {Math.round(score * 100)}% Profile Match
                              </span>
                            )}
                          </div>
                          <span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{a.bio || reason}</span>
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            {a.interests?.map((tag) => (
                              <span key={tag} style={{ fontSize: 9, background: "color-mix(in srgb, var(--text-primary) 3%, transparent)", padding: "2px 6px", borderRadius: 4, textTransform: "capitalize" }}>{tag}</span>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => { setPendingChatContact(a); setActiveTab("messages"); }}
                          style={{
                            padding: "6px 14px",
                            background: "var(--accent-600)",
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
                          <MessageCircle size={12} /> Message
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MESSAGES / CHAT TAB */}
          {activeTab === "messages" && (
            <div className="dash-content animate-fade-in" style={{ height: "calc(100vh - 120px)" }}>
              <ChatInterface user={user} currentRole="reader" token={token} initialContact={pendingChatContact} />
            </div>
          )}

          {/* HELP & GUIDE TAB */}
          {activeTab === "help" && (
            <FeatureGuide
              role="reader"
              onGo={(target) => (target.tab ? setActiveTab(target.tab) : navigate(target.path))}
            />
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Profile & Account Settings</h1>
                  <p>Update your display identity and reading interests — interests power your personalized recommendations and reader–writer matches.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 32, maxWidth: 640 }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!settingsName.trim()) return alert("Name is required!");
                    setSavingSettings(true);
                    try {
                      const res = await updateProfile({ name: settingsName, bio: settingsBio, interests: settingsInterests });
                      if (res.success) {
                        alert("Profile updated successfully!");
                      } else {
                        alert("Profile update failed: " + res.error);
                      }
                    } catch (err) {
                      console.error(err);
                      alert("Error updating profile settings.");
                    } finally {
                      setSavingSettings(false);
                    }
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 20 }}
                >
                  <div>
                    <label className="form-label">Display Name</label>
                    <input
                      type="text"
                      className="input-field"
                      value={settingsName}
                      onChange={e => setSettingsName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Bio</label>
                    <textarea
                      className="input-field"
                      placeholder="Tell authors and publishers a bit about yourself..."
                      style={{ height: 120, resize: "none" }}
                      value={settingsBio}
                      onChange={e => setSettingsBio(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label">Reading Interests</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {availableInterests.map(genre => {
                        const active = settingsInterests.includes(genre);
                        return (
                          <button
                            key={genre}
                            type="button"
                            onClick={() => setSettingsInterests(active
                              ? settingsInterests.filter(i => i !== genre)
                              : [...settingsInterests, genre])}
                            style={{
                              padding: "6px 12px",
                              fontSize: 12,
                              borderRadius: 20,
                              border: "1.5px solid",
                              borderColor: active ? "var(--success)" : "var(--border-medium)",
                              background: active ? "rgba(22, 163, 74, 0.08)" : "var(--bg-primary)",
                              color: active ? "var(--success)" : "var(--text-secondary)",
                              fontWeight: 600,
                              cursor: "pointer",
                              textTransform: "capitalize",
                              transition: "all 0.15s"
                            }}
                          >
                            {genre}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 20, display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" disabled={savingSettings} className="btn-primary">
                      {savingSettings ? "Saving settings..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="glass-panel" style={{ padding: 32, maxWidth: 640 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Appearance</h3>
                <ThemeToggle />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ReaderDashboard;
