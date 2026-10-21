import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BookOpen, Upload, Star, Shield, TrendingUp, Eye, MessageCircle, BarChart2,
  Clock, CheckCircle, AlertCircle, Plus, FileText, Lock, Sparkles, ArrowUpRight,
  Send, User, ArrowLeft, RefreshCw, HelpCircle, BookMarked, Wallet, DollarSign, Layers
} from "lucide-react";
import ChatInterface from "../components/ChatInterface";
import ThemeToggle from "../components/ThemeToggle";
import WelcomeBanner from "../components/WelcomeBanner";
import HelpTip from "../components/HelpTip";
import ChapterManager from "../components/books/ChapterManager";
import confetti from "canvas-confetti";
import { useAuth } from "../context/AuthContext";
import { connectMetaMask, getConnectedAccount, isMetaMaskInstalled } from "../services/web3";
import {
  registerManuscriptOnChain,
  updateManuscriptOnChain,
  verifyManuscriptOnChain,
  CONTRACT_ADDRESS,
} from "../services/manuscriptRegistry";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Format helper
const fmt = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n || 0);

// Stat Card Component
const StatCard = ({ icon, label, value, change, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "1a", color }}>{icon}</div>
    <div className="stat-info">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
    {change !== undefined && (
      <div className={`stat-change ${change >= 0 ? "up" : "down"}`}>
        <ArrowUpRight size={13} />{Math.abs(change)}%
      </div>
    )}
  </div>
);

// Activity Item Component
const ActivityItem = ({ icon, text, time, color }) => (
  <div className="activity-item">
    <div className="activity-icon" style={{ background: color + "1a", color }}>{icon}</div>
    <div className="activity-text">
      <span>{text}</span>
      <span className="activity-time">{time}</span>
    </div>
  </div>
);

// Skeleton Loader
const Skel = () => (
  <div className="skel-row" style={{ height: 48, background: "rgba(255,255,255,0.03)", borderRadius: 8, marginBottom: 8 }} />
);

// Live preview of the cover image URL currently typed/picked — so authors
// can see exactly what will be saved instead of only finding out later
// (e.g. after picking a theme preset that quietly replaced a custom URL).
const CoverPreview = ({ url }) => {
  // Tracks which URL last failed to load, rather than a plain boolean, so
  // switching to a new URL is automatically treated as "not failed" on the
  // very next render — no effect needed to reset it.
  const [erroredUrl, setErroredUrl] = useState(null);
  const failed = erroredUrl === url;

  if (!url) return null;
  return (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 44, height: 60, borderRadius: 6, overflow: "hidden", flexShrink: 0,
        background: "var(--gray-100)", display: "flex", alignItems: "center", justifyContent: "center",
        border: "1px solid var(--border-light)"
      }}>
        {failed ? (
          <AlertCircle size={16} color="var(--danger)" />
        ) : (
          <img
            src={url}
            alt="Cover preview"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setErroredUrl(url)}
          />
        )}
      </div>
      <span style={{ fontSize: 11, color: failed ? "var(--danger)" : "var(--text-muted)" }}>
        {failed ? "This URL didn't load — double-check the link." : "This is what will be saved as the cover."}
      </span>
    </div>
  );
};

// Every genre the Book model accepts (backend/models/Book.js).
const BOOK_GENRES = [
  "fiction", "non-fiction", "science", "technology", "poetry", "drama", "history",
  "biography", "mystery", "romance", "thriller", "fantasy", "horror", "children",
];

// "Suggest genre" — asks the trained genre classifier (backend
// POST /api/ai/suggest-genre; TF-IDF + logistic regression trained on the
// CMU Book Summary Dataset) to read the manuscript text and offer its top 3
// genres. The author stays in control: clicking a chip just fills the select.
const GenreSuggester = ({ text, token, onPick }) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState("");

  const suggest = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/ai/suggest-genre`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuggestions(data.suggestions);
    } catch (err) {
      setSuggestions(null);
      setError(err.response?.data?.message || "Could not get a suggestion right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        onClick={suggest}
        disabled={loading}
        style={{
          background: "none", border: "none", padding: 0, cursor: loading ? "wait" : "pointer",
          fontSize: 12, fontWeight: 600, color: "var(--accent-600)", display: "inline-flex", alignItems: "center", gap: 4
        }}
      >
        <Sparkles size={12} /> {loading ? "Reading your manuscript..." : "Suggest genre from my text"}
      </button>
      {error && <div style={{ fontSize: 11, color: "var(--danger)", marginTop: 4 }}>{error}</div>}
      {suggestions && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
          {suggestions.map(s => (
            <button
              key={s.genre}
              type="button"
              onClick={() => onPick(s.genre)}
              title="Click to use this genre"
              style={{
                padding: "3px 10px", fontSize: 11, borderRadius: 20, cursor: "pointer", textTransform: "capitalize",
                border: "1px solid var(--accent-200)", background: "var(--accent-50)", color: "var(--accent-700)", fontWeight: 600
              }}
            >
              {s.genre} · {Math.round(s.probability * 100)}%
            </button>
          ))}
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            Trained model — a suggestion only.
          </span>
        </div>
      )}
    </div>
  );
};

// ─── BOOK ROW COMPONENT ──────────────────────────────────────────────────────
const BookRow = ({ book, onEdit, onPayCost, setActive }) => {
  const isPublished = book.status === "published";
  const isReview = book.status === "under_review";
  const isSeen = book.status === "seen";
  const isCostProposed = book.status === "cost_proposed";

  let statusLabel = "Draft";
  let statusClass = "draft";

  if (isPublished) {
    statusLabel = "Published";
    statusClass = "published";
  } else if (isReview) {
    statusLabel = "Under Review";
    statusClass = "review";
  } else if (isSeen) {
    statusLabel = "Seen";
    statusClass = "new";
  } else if (isCostProposed) {
    statusLabel = "Cost Proposed";
    statusClass = "review";
  } else if (book.status === "declined") {
    statusLabel = "Declined";
    statusClass = "draft";
  }

  return (
    <div className="book-row" style={{ padding: "12px 0" }}>
      <div className="book-row-cover">
        <BookOpen size={16} />
      </div>
      <div className="book-row-info">
        <span className="book-row-title" style={{ fontWeight: 600 }}>{book.title}</span>
        <span className="book-row-genre" style={{ textTransform: "capitalize" }}>{book.genre || "Fiction"}</span>
      </div>
      <span className={`book-status ${statusClass}`}>{statusLabel}</span>
      
      {isCostProposed && (
        <span style={{ fontSize: 11, fontWeight: "bold", color: "var(--warning)", background: "rgba(217, 119, 6,0.1)", padding: "2px 6px", borderRadius: 4 }}>
          ${book.publishingCost} fee
        </span>
      )}

      <span className="book-views"><Eye size={12} /> {fmt(book.totalReads || 0)}</span>
      
      <div className="book-row-actions" style={{ display: "flex", gap: 6 }}>
        {isCostProposed ? (
          <button 
            className="row-action-btn secure" 
            style={{ background: "var(--success)", color: "#fff", display: "flex", alignItems: "center", gap: 3 }}
            onClick={() => onPayCost(book.id || book._id)}
          >
            <DollarSign size={12} /> Pay & Publish
          </button>
        ) : (
          <button className="row-action-btn edit" onClick={() => onEdit(book.id || book._id)}>Edit</button>
        )}

        {book.blockchainHash ? (
          <button className="row-action-btn secure" onClick={() => setActive("blockchain")}><Shield size={12} /> Secure</button>
        ) : (
          <button className="row-action-btn verify" onClick={() => setActive("blockchain")}>Secure</button>
        )}
      </div>
    </div>
  );
};

// ─── IN-EDITOR AI WRITER PANEL ──────────────────────────────────────────────
const InlineAIWriter = ({ content, setContent, bookId, token, onEvaluateSuccess, title = "", genre = "" }) => {
  const [assistType, setAssistType] = useState("improve");
  const [isAssisting, setIsAssisting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  const handleRewrite = async () => {
    if (!content.trim()) return alert("Write some draft content first!");
    setIsAssisting(true);
    setAiSuggestion("");
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/ai/assist`,
        { text: content, promptType: assistType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setAiSuggestion(data.suggestion);
      }
    } catch (err) {
      console.error(err);
      alert("Error getting AI rewrite.");
    } finally {
      setIsAssisting(false);
    }
  };

  const handleScan = async () => {
    if (!content.trim()) return alert("Write some draft content first!");
    setIsScanning(true);
    setScanResult(null);
    try {
      let data;
      if (bookId) {
        const response = await axios.post(
          `${BASE_URL}/api/ai/evaluate/${bookId}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        data = response.data;
      } else {
        const response = await axios.post(
          `${BASE_URL}/api/ai/evaluate-raw`,
          { text: content, title, genre },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        data = response.data;
      }

      if (data.success) {
        setScanResult(data);
        if (onEvaluateSuccess) onEvaluateSuccess(data);
      }
    } catch (err) {
      console.error(err);
      alert("AI scan error.");
    } finally {
      setIsScanning(false);
    }
  };

  const applySuggestion = () => {
    if (!aiSuggestion) return;
    const cleaned = aiSuggestion.replace(/^\[.*\]:\n/, "");
    setContent(cleaned);
    setAiSuggestion("");
  };

  return (
    <div className="glass-panel" style={{ padding: 20, border: "1px solid rgba(79, 70, 229, 0.15)", background: "rgba(79, 70, 229, 0.02)" }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "var(--accent-600)", marginBottom: 12 }}>
        <Sparkles size={16} /> AI Writing Assistant (Inline)
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: "bold", color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>REWRITE SELECTION</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select 
              value={assistType} 
              onChange={e => setAssistType(e.target.value)}
              className="input-field" 
              style={{ flex: 1, padding: "6px 10px", fontSize: 12, borderRadius: 6, border: "1px solid var(--accent-100)" }}
            >
              <option value="improve">Refine Flow & Tone</option>
              <option value="simplify">Simplify Vocabulary</option>
              <option value="formal">Classical Literary Tone</option>
              <option value="summarize">Create Synopsis</option>
            </select>
            <button 
              type="button" 
              onClick={handleRewrite} 
              disabled={isAssisting} 
              className="btn-primary" 
              style={{ padding: "6px 14px", fontSize: 12, borderRadius: 6, background: "var(--accent-600)" }}
            >
              {isAssisting ? "Thinking..." : "Rewrite"}
            </button>
          </div>
        </div>

        {aiSuggestion && (
          <div style={{ padding: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(79,70,229,0.15)", borderRadius: 8 }}>
            <span style={{ fontSize: 10, color: "var(--accent-600)", fontWeight: "bold", display: "block" }}>SUGGESTION:</span>
            <p style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 4, whiteSpace: "pre-wrap" }}>{aiSuggestion}</p>
            <button 
              type="button" 
              onClick={applySuggestion} 
              style={{ marginTop: 8, padding: "4px 10px", fontSize: 11, background: "var(--accent-600)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
            >
              Apply Rewrite
            </button>
          </div>
        )}

        <hr style={{ border: "none", borderTop: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)" }} />

        <div>
          <button 
            type="button" 
            onClick={handleScan} 
            disabled={isScanning} 
            className="btn-secondary" 
            style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", fontSize: 12 }}
          >
            {isScanning ? <RefreshCw className="animate-spin" size={12} /> : <BarChart2 size={12} />} 
            Scan Readability & Plagiarism
          </button>

          {scanResult && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{ background: "rgba(79, 70, 229, 0.05)", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid rgba(79, 70, 229, 0.1)" }}>
                  <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>QUALITY SCORE</span>
                  <div style={{ fontSize: 16, fontWeight: "bold", color: "var(--accent-600)" }}>{scanResult.qualityScore}%</div>
                </div>
                <div style={{ background: "rgba(8, 145, 178, 0.05)", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid rgba(8, 145, 178, 0.1)" }}>
                  <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>READABILITY</span>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--info)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scanResult.readabilityScore}</div>
                </div>
              </div>

              <div style={{ background: scanResult.plagiarismScore > 15 ? "rgba(220,38,38,0.05)" : "rgba(22, 163, 74,0.05)", padding: 8, borderRadius: 6, border: "1px solid color-mix(in srgb, var(--text-primary) 5%, transparent)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>Plagiarism:</span>
                  <strong style={{ color: scanResult.plagiarismScore > 15 ? "var(--danger)" : "var(--success)" }}>{scanResult.plagiarismScore}%</strong>
                </div>
                {scanResult.plagiarismMatches && scanResult.plagiarismMatches.length > 0 && (
                  <div style={{ fontSize: 9, color: "var(--danger)", marginTop: 4 }}>
                    ⚠️ Overlap with "{scanResult.plagiarismMatches[0].title}" ({scanResult.plagiarismMatches[0].similarity}% match)
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR OVERVIEW ────────────────────────────────────────────────────────
export const AuthorOverview = ({ user, setActive, books, loading, setEditingBookId, onPayCost }) => {
  const totalReads = books.reduce((s, b) => s + (b.totalReads || 0), 0);
  const publishedBooks = books.filter(b => b.status === "published");
  const draftBooks = books.filter(b => b.status === "draft" || !b.status);
  const reviewBooks = books.filter(b => b.status === "under_review" || b.status === "seen" || b.status === "cost_proposed");
  
  const avgRating = books.filter(b => b.qualityScore).length
    ? (books.reduce((s, b) => s + (b.qualityScore || 0), 0) / books.filter(b => b.qualityScore).length).toFixed(1)
    : "—";

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
          <p>Here's what's happening with your literary works today.</p>
        </div>
        <button onClick={() => setActive("upload")} className="btn-primary-dash">
          <Plus size={16} /> New Book
        </button>
      </div>

      <WelcomeBanner role="author" userId={user?._id} onOpenGuide={() => setActive("help")} />

      <div className="stats-row">
        <StatCard icon={<BookOpen size={20} />} label="Total Books" value={loading ? "…" : books.length} color="var(--accent-600)" />
        <StatCard icon={<Eye size={20} />} label="Total Reads" value={loading ? "…" : fmt(totalReads)} color="var(--info)" />
        <StatCard icon={<CheckCircle size={20} />} label="Published" value={loading ? "…" : publishedBooks.length} color="var(--success)" />
        <StatCard icon={<Star size={20} />} label="Avg Readability Score" value={loading ? "…" : avgRating} color="var(--warning)" />
      </div>

      {!loading && books.length > 0 && (
        <div className="status-summary">
          <div className="status-pill published"><CheckCircle size={12} /> {publishedBooks.length} Published</div>
          {draftBooks.length > 0 && <div className="status-pill draft"><FileText size={12} /> {draftBooks.length} Drafts</div>}
          {reviewBooks.length > 0 && <div className="status-pill review"><Clock size={12} /> {reviewBooks.length} Submissions</div>}
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-panel">
          <div className="panel-header">
            <h3>Recent Books</h3>
            <button className="panel-link" onClick={() => setActive("mybooks")}>View all</button>
          </div>
          {loading ? (
            [1, 2, 3].map(i => <Skel key={i} />)
          ) : books.length === 0 ? (
            <p className="empty-text">
              No books yet. <span className="action-text" onClick={() => setActive("upload")} style={{ color: "var(--accent-600)", cursor: "pointer", textDecoration: "underline" }}>Upload your first book →</span>
            </p>
          ) : (
            books.slice(0, 4).map((b) => (
              <BookRow
                key={b._id}
                book={b}
                onEdit={(id) => { setEditingBookId(id); setActive("editbook"); }}
                onPayCost={onPayCost}
                setActive={setActive}
              />
            ))
          )}
        </div>

        <div className="dash-panel">
          <div className="panel-header">
            <h3>Recent Activities</h3>
          </div>
          {loading ? (
            [1, 2, 3].map(i => <Skel key={i} />)
          ) : (
            <div className="activity-list">
              {publishedBooks.slice(0, 2).map((b) => (
                <ActivityItem key={b._id} icon={<BookOpen size={14} />} text={`"${b.title}" is live on the library`} time="Published" color="var(--success)" />
              ))}
              {books.filter(b => b.status === "under_review").slice(0, 2).map((b) => (
                <ActivityItem key={b._id} icon={<Clock size={14} />} text={`Submitted "${b.title}" to publisher`} time="Reviewing" color="var(--warning)" />
              ))}
              {books.filter(b => b.blockchainHash).slice(0, 1).map((b) => (
                <ActivityItem key={`bc-${b._id}`} icon={<Shield size={14} />} text={`"${b.title}" secured on Ethereum`} time="Web3 Verified" color="var(--accent-600)" />
              ))}
              <ActivityItem icon={<Sparkles size={14} />} text="AI Writing Assistant loaded in editor panels" time="System Ready" color="var(--info)" />
            </div>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-row">
          <button className="action-card" onClick={() => setActive("upload")}>
            <Upload size={22} color="var(--accent-600)" />
            <span>Upload Book</span>
          </button>
          <button className="action-card" onClick={() => setActive("messages")}>
            <MessageCircle size={22} color="var(--info)" />
            <span>Publishers Chat</span>
          </button>
          <button className="action-card" onClick={() => setActive("blockchain")}>
            <Shield size={22} color="var(--success)" />
            <span>Verify Ownership</span>
          </button>
          <button className="action-card" onClick={() => setActive("analytics")}>
            <TrendingUp size={22} color="var(--warning)" />
            <span>Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR MY BOOKS ────────────────────────────────────────────────────────
export const AuthorMyBooks = ({ books, loading, setActive, setEditingBookId, onPayCost }) => {
  const publishedBooks = books.filter(b => b.status === "published");

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>My Books</h1>
          <p>You have {books.length} book{books.length !== 1 ? "s" : ""} in your library.</p>
        </div>
        <button onClick={() => setActive("upload")} className="btn-primary-dash">
          <Plus size={16} /> New Book
        </button>
      </div>

      <div className="dash-panel" style={{ maxWidth: "100%" }}>
        <div className="panel-header">
          <h3>All Manuscripts ({books.length})</h3>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Published: <strong>{publishedBooks.length}</strong>
          </span>
        </div>
        
        {loading ? (
          [1, 2, 3, 4].map(i => <Skel key={i} />)
        ) : books.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <BookMarked size={48} color="var(--gray-600)" style={{ marginBottom: 12 }} />
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No books uploaded yet.</p>
            <button onClick={() => setActive("upload")} className="btn-primary-dash" style={{ marginTop: 12, display: "inline-flex" }}>
              Upload your first book
            </button>
          </div>
        ) : (
          <div className="books-list-container">
            {books.map((b) => (
              <div key={b._id} className="book-row-full" style={{ display: "flex", alignItems: "center", justify: "space-between", padding: "10px 0", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="book-row-cover" style={{ width: 34, height: 44, background: "var(--accent-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-600)", borderRadius: 6 }}>
                    <BookOpen size={16} />
                  </div>
                  <div>
                    <span className="book-row-title" style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{b.title}</span>
                    <span className="book-row-genre" style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>
                      {b.genre || "Fiction"} · Created: {new Date(b.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span className={`book-status ${b.status === "published" ? "published" : b.status === "under_review" || b.status === "seen" || b.status === "cost_proposed" ? "review" : "draft"}`}>
                    {b.status === "published" ? "Published" : b.status === "under_review" ? "Reviewing" : b.status === "seen" ? "Read by publisher" : b.status === "cost_proposed" ? "Offer received" : b.status === "declined" ? "Declined" : "Draft"}
                  </span>

                  {b.status === "declined" && (
                    <span style={{ fontSize: 11, color: "var(--danger)", maxWidth: 240 }} title={b.declineReason || ""}>
                      {b.declineReason ? `Publisher said: ${b.declineReason}` : "Publisher declined — edit and send to another."}
                    </span>
                  )}
                  
                  {b.status === "cost_proposed" && (
                    <span style={{ fontSize: 11, fontWeight: "bold", color: "var(--warning)" }}>
                      Publisher's offer: ${b.publishingCost}
                    </span>
                  )}

                  <span className="book-rating" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                    <Star size={12} fill={b.qualityScore ? "currentColor" : "none"} color="var(--warning)" />
                    {b.qualityScore ? `${b.qualityScore}/100` : "No Scan"}
                  </span>
                  
                  <div style={{ display: "flex", gap: 8 }}>
                    {b.status === "cost_proposed" ? (
                      <button 
                        className="btn-primary-dash" 
                        style={{ padding: "5px 10px", fontSize: 11, background: "var(--success)" }}
                        onClick={() => onPayCost(b._id)}
                      >
                        Pay & Publish
                      </button>
                    ) : (
                      <button 
                        className="edit-btn" 
                        onClick={() => { setEditingBookId(b._id); setActive("editbook"); }}
                      >
                        Edit
                      </button>
                    )}
                    
                    <button 
                      className="btn-blockchain-verify"
                      onClick={() => { setActive("blockchain"); }}
                      style={{ 
                        padding: "6px 12px", 
                        fontSize: "0.8rem", 
                        background: b.blockchainHash ? "rgba(22, 163, 74, 0.1)" : "rgba(79, 70, 229, 0.1)", 
                        color: b.blockchainHash ? "var(--success)" : "var(--accent-300)",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Shield size={12} /> {b.blockchainHash ? "Secured" : "Lock Ledger"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── AUTHOR UPLOAD BOOK ──────────────────────────────────────────────────────
export const AuthorUploadBook = ({ token, setActive, fetchBooks }) => {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("fiction");
  const [price, setPrice] = useState("0");
  const [content, setContent] = useState("");
  const [publishers, setPublishers] = useState([]);
  const [selectedPublisher, setSelectedPublisher] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBookId, setCreatedBookId] = useState(null);
  const [coverImage, setCoverImage] = useState("");

  // Fetch publishers
  useEffect(() => {
    axios.get(`${BASE_URL}/api/auth/search?q=@`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data.success) {
        setPublishers(res.data.data.filter(u => u.role === "publisher"));
      }
    }).catch(console.error);
  }, []);

  const handleSaveDraft = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      return alert("Title and Content are required!");
    }
    setIsSubmitting(true);
    try {
      const payload = { 
        title, 
        content, 
        genre, 
        price: parseFloat(price), 
        publisher: selectedPublisher || null,
        coverImage: coverImage || null
      };

      let res;
      if (createdBookId) {
        res = await axios.put(`${BASE_URL}/api/manuscripts/${createdBookId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        res = await axios.post(`${BASE_URL}/api/manuscripts`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (res.data.success) {
        setCreatedBookId(res.data.id || res.data.data._id);
        alert("Draft saved successfully! You can now run AI Scans on the right-hand panel.");
        await fetchBooks();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Error saving draft.";
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!createdBookId) {
      return alert("Please save the manuscript as a draft first!");
    }
    if (!selectedPublisher) {
      return alert("Please select a publisher to review your work!");
    }
    setIsSubmitting(true);
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/manuscripts/${createdBookId}/submit`,
        { publisherId: selectedPublisher },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        confetti({ particleCount: 80, spread: 60 });
        alert("Manuscript submitted to publisher for review successfully!");
        await fetchBooks();
        setActive("mybooks");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Error submitting review.";
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Create & Write Manuscript</h1>
          <p>Compose stories, use inline AI rewrite, and select publishers to submit.</p>
        </div>
        <button onClick={() => setActive("mybooks")} className="btn-secondary" style={{ padding: "8px 16px" }}>
          <ArrowLeft size={16} /> Back to Library
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Editor Form */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <form onSubmit={handleSaveDraft} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">Manuscript Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Pride and Prejudice in Space"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Genre</label>
                <select className="input-field" value={genre} onChange={e => setGenre(e.target.value)} style={{ textTransform: "capitalize" }}>
                  {BOOK_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <GenreSuggester text={content} token={token} onPick={setGenre} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">
                  Select Target Publisher
                  <HelpTip
                    title="What happens next?"
                    text="The publisher reviews your manuscript and may propose a publishing fee. You pay it from your wallet balance and the book goes live."
                  />
                </label>
                <select className="input-field" value={selectedPublisher} onChange={e => setSelectedPublisher(e.target.value)}>
                  <option value="">-- Choose Publisher --</option>
                  {publishers.map(p => (
                    <option key={p._id} value={p._id}>{p.name}{p.publisherVerification?.isVerified ? " ✓ Verified" : " (not verified)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Book Price (USD) - Paid Reading</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">Cover Image URL</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. https://images.unsplash.com/... or leave blank"
                  value={coverImage}
                  onChange={e => setCoverImage(e.target.value)}
                />
                <CoverPreview url={coverImage} />
              </div>
              <div>
                <label className="form-label">Cover Theme Preset</label>
                <select
                  className="input-field"
                  onChange={e => {
                    if (e.target.value) setCoverImage(e.target.value);
                    e.target.value = "";
                  }}
                  value=""
                >
                  <option value="">-- Choose A Theme Style --</option>
                  <option value={`https://picsum.photos/seed/${encodeURIComponent(title || "book")}/300/450`}>Automatic Title Art (Picsum — random stock photo)</option>
                  <option value="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=300&auto=format&fit=crop">Modern Abstract (Vibrant Art)</option>
                  <option value="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300&auto=format&fit=crop">Digital Technology (Tech & Code)</option>
                  <option value="https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300&auto=format&fit=crop">Classic Literature (Paperback Book)</option>
                  <option value="https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=300&auto=format&fit=crop">Mystery & Noir (Dark & Foggy)</option>
                  <option value="https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=300&auto=format&fit=crop">Romantic Red (Rose petals & Love)</option>
                </select>
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Picking a preset here replaces whatever URL you typed on the left.
                </span>
              </div>
            </div>

            <div>
              <label className="form-label">Manuscript Workspace</label>
              <textarea
                className="input-field"
                placeholder="Write your story chapters directly here..."
                style={{ height: 350, fontFamily: "var(--font-body)", lineHeight: 1.6, padding: 14 }}
                value={content}
                onChange={e => setContent(e.target.value)}
                required
              />
              <span style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4, display: "block" }}>
                Word Count: {content.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="btn-secondary"
                disabled={isSubmitting}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <FileText size={16} /> {createdBookId ? "Save Changes" : "Save as Draft"}
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={isSubmitting || !selectedPublisher || !createdBookId}
                onClick={handleSubmitReview}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg, var(--accent-600) 0%, var(--accent-700) 100%)" }}
              >
                <Send size={16} /> Submit to Publisher
              </button>
            </div>
          </form>
        </div>

        {/* AI Sidebar */}
        <div>
          <InlineAIWriter 
            content={content} 
            setContent={setContent} 
            bookId={createdBookId} 
            token={token} 
            title={title}
            genre={genre}
          />
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR EDIT BOOK ────────────────────────────────────────────────────────
export const AuthorEditBook = ({ token, bookId, setActive, fetchBooks }) => {
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("fiction");
  const [price, setPrice] = useState("0");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [selectedPublisher, setSelectedPublisher] = useState("");
  const [publishers, setPublishers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [coverImage, setCoverImage] = useState("");
  const [chapters, setChapters] = useState([]);

  const fetchManuscript = () => {
    return axios.get(`${BASE_URL}/api/manuscripts/${bookId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(({ data }) => {
      if (data.success) {
        setTitle(data.data.title || "");
        setGenre(data.data.genre || "fiction");
        setPrice(data.data.price ? String(data.data.price) : "0");
        setContent(data.data.content || "");
        setStatus(data.data.status || "draft");
        setSelectedPublisher(data.data.publisher?._id || "");
        setCoverImage(data.data.coverImage || "");
        setChapters(data.data.chapters || []);
      }
    });
  };

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);

    // Fetch publishers
    axios.get(`${BASE_URL}/api/auth/search?q=@`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data.success) {
        setPublishers(res.data.data.filter(u => u.role === "publisher"));
      }
    }).catch(console.error);

    // Fetch book
    fetchManuscript().catch(console.error).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, token]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return alert("Title and Content are required!");
    setIsSaving(true);

    try {
      const payload = { 
        title, 
        content, 
        genre, 
        price: parseFloat(price), 
        publisher: selectedPublisher || null,
        coverImage: coverImage || null
      };

      const { data } = await axios.put(
        `${BASE_URL}/api/manuscripts/${bookId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data.success) {
        alert("Manuscript updated successfully!");
        await fetchBooks();
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Error saving manuscript edits.";
      alert(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedPublisher) {
      return alert("Select a publisher first!");
    }
    setIsSaving(true);
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/manuscripts/${bookId}/submit`,
        { publisherId: selectedPublisher },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        confetti({ particleCount: 80, spread: 60 });
        alert("Submitted to publisher successfully!");
        await fetchBooks();
        setActive("mybooks");
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || "Submission error.";
      alert(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dash-content animate-fade-in" style={{ textAlign: "center", padding: "100px 0" }}>
        <RefreshCw className="animate-spin" size={48} style={{ color: "var(--accent-600)" }} />
        <p style={{ marginTop: 12, color: "var(--text-muted)" }}>Loading manuscript details...</p>
      </div>
    );
  }

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Edit Manuscript</h1>
          <p>Currently Editing: <strong>{title}</strong> (Status: <span style={{ textTransform: "uppercase", color: "var(--accent-600)" }}>{status}</span>)</p>
        </div>
        <button onClick={() => setActive("mybooks")} className="btn-secondary" style={{ padding: "8px 16px" }}>
          <ArrowLeft size={16} /> Cancel Edits
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Editor Form */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">Manuscript Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Genre</label>
                <select className="input-field" value={genre} onChange={e => setGenre(e.target.value)} style={{ textTransform: "capitalize" }}>
                  {BOOK_GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <GenreSuggester text={content} token={token} onPick={setGenre} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">
                  Select Publisher
                  <HelpTip
                    title="What happens next?"
                    text="The publisher reviews your manuscript and may propose a publishing fee. You pay it from your wallet balance and the book goes live."
                  />
                </label>
                <select className="input-field" value={selectedPublisher} onChange={e => setSelectedPublisher(e.target.value)}>
                  <option value="">-- Choose Publisher --</option>
                  {publishers.map(p => (
                    <option key={p._id} value={p._id}>{p.name}{p.publisherVerification?.isVerified ? " ✓ Verified" : " (not verified)"}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Book Price (USD)</label>
                <input
                  type="number"
                  className="input-field"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label className="form-label">Cover Image URL</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. https://images.unsplash.com/... or leave blank"
                  value={coverImage}
                  onChange={e => setCoverImage(e.target.value)}
                />
                <CoverPreview url={coverImage} />
              </div>
              <div>
                <label className="form-label">Cover Theme Preset</label>
                <select
                  className="input-field"
                  onChange={e => {
                    if (e.target.value) setCoverImage(e.target.value);
                    e.target.value = "";
                  }}
                  value=""
                >
                  <option value="">-- Choose A Theme Style --</option>
                  <option value={`https://picsum.photos/seed/${encodeURIComponent(title || "book")}/300/450`}>Automatic Title Art (Picsum — random stock photo)</option>
                  <option value="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=300&auto=format&fit=crop">Modern Abstract (Vibrant Art)</option>
                  <option value="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300&auto=format&fit=crop">Digital Technology (Tech & Code)</option>
                  <option value="https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300&auto=format&fit=crop">Classic Literature (Paperback Book)</option>
                  <option value="https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=300&auto=format&fit=crop">Mystery & Noir (Dark & Foggy)</option>
                  <option value="https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=300&auto=format&fit=crop">Romantic Red (Rose petals & Love)</option>
                </select>
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, display: "block" }}>
                  Picking a preset here replaces whatever URL you typed on the left.
                </span>
              </div>
            </div>

            <div>
              <label className="form-label">Manuscript Content</label>
              <textarea
                className="input-field"
                style={{ height: 350, fontFamily: "var(--font-body)", lineHeight: 1.6, padding: 14 }}
                value={content}
                onChange={e => setContent(e.target.value)}
                required
              />
              <div style={{ display: "flex", justify: "space-between", fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                <span>Word Count: {content.split(/\s+/).filter(Boolean).length} words</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                type="submit"
                className="btn-secondary"
                disabled={isSaving}
              >
                Save Draft
              </button>
              
              {["draft", "declined"].includes(status) && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isSaving || !selectedPublisher}
                  onClick={handleSubmitReview}
                  style={{ background: "linear-gradient(135deg, var(--accent-600) 0%, var(--accent-700) 100%)" }}
                >
                  Send to Publisher
                </button>
              )}
            </div>
          </form>
        </div>

        {/* AI Sidebar */}
        <div>
          <InlineAIWriter
            content={content}
            setContent={setContent}
            bookId={bookId}
            token={token}
            title={title}
            genre={genre}
          />
        </div>
      </div>

      {/* Chapter-by-chapter breakdown — the "Manuscript Content" box above is
          a free-write scratchpad / AI-assist source; chapters here are what
          readers actually navigate once published. Splitting into named
          chapters before publishing also each get their own version-history
          snapshot, unlike the single auto-generated "Introduction" chapter
          that's created if none exist at publish time. */}
      <div className="glass-panel" style={{ padding: 24, marginTop: 20 }}>
        <ChapterManager bookId={bookId} chapters={chapters} onChapterUpdate={fetchManuscript} />
      </div>
    </div>
  );
};

// ─── AUTHOR BLOCKCHAIN ───────────────────────────────────────────────────────
export const AuthorBlockchain = ({ token, books, user, fetchBooks }) => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [selectedBookId, setSelectedBookId] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [metamaskDetected, setMetamaskDetected] = useState(true);
  const [isOnChainRegistering, setIsOnChainRegistering] = useState(false);
  const [onChainError, setOnChainError] = useState("");
  const [isOnChainVerifying, setIsOnChainVerifying] = useState(false);
  const [onChainVerifyResult, setOnChainVerifyResult] = useState(null);

  // Auto-detect MetaMask and restore existing connection on mount
  useEffect(() => {
    const detect = async () => {
      // First check if user already linked in DB
      if (user?.blockchainWallet?.isLinked && user?.blockchainWallet?.address) {
        setWalletAddress(user.blockchainWallet.address);
        setWalletConnected(true);
      }

      // Check if MetaMask extension is installed
      if (!isMetaMaskInstalled()) {
        setMetamaskDetected(false);
        return;
      }

      // Try to get already-authorized account (no popup)
      const existing = await getConnectedAccount();
      if (existing) {
        setWalletAddress(existing);
        setWalletConnected(true);
      }
    };
    detect();
  }, [user]);

  useEffect(() => {
    if (books.length > 0 && !selectedBookId) {
      setSelectedBookId(books[0]._id || books[0].id);
    }
  }, [books, selectedBookId]);

  const handleConnectWallet = async () => {
    setConnecting(true);
    setConnectError("");
    try {
      // This triggers the actual MetaMask popup via eth_requestAccounts
      const address = await connectMetaMask();
      setWalletAddress(address);
      setWalletConnected(true);

      // Save to backend
      await axios.post(`${BASE_URL}/api/auth/link-wallet`, { walletAddress: address }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error("MetaMask connect error:", err);
      setConnectError(err.message || "Failed to connect MetaMask. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleRegister = async () => {
    if (!selectedBookId) return alert("Select a book first!");
    setIsRegistering(true);
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/blockchain/register/${selectedBookId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        // canvas-confetti draws via <canvas> fillStyle, which can't resolve CSS custom properties — literal colors only
        confetti({ particleCount: 150, spread: 80, colors: ["#4f46e5", "#16a34a"] });
        alert("Manuscript registered on Blockchain successfully!");
        await fetchBooks();
      }
    } catch (err) {
      console.error(err);
      alert("Error registering on blockchain.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedBookId) return alert("Select a book to verify!");
    const book = books.find(b => (b._id || b.id) === selectedBookId);
    if (!book) return;
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/blockchain/verify/${selectedBookId}`,
        { currentContent: book.content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setVerifyResult(data);
    } catch (err) {
      console.error(err);
      alert("Error verifying book integrity.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Real on-chain registration — writes to the deployed ManuscriptRegistry
  // smart contract on Sepolia, signed by the author's own MetaMask wallet.
  // Reuses the off-chain blockchainHash so both records reference the same
  // fingerprint (requires "Register Copyright Signature" to have run first).
  const handleOnChainRegister = async () => {
    const book = books.find(b => (b._id || b.id) === selectedBookId);
    if (!book) return alert("Select a manuscript first!");
    if (!book.blockchainHash) return alert("Register the copyright signature first (left panel) — the on-chain step reuses that hash.");

    setIsOnChainRegistering(true);
    setOnChainError("");
    try {
      let result;
      try {
        result = await registerManuscriptOnChain(book._id || book.id, book.blockchainHash);
      } catch (err) {
        // Already registered on-chain (e.g. re-running after a content edit) — push a new version instead.
        if (String(err?.reason || err?.message || "").includes("already registered")) {
          result = await updateManuscriptOnChain(book._id || book.id, book.blockchainHash);
        } else {
          throw err;
        }
      }

      await axios.post(
        `${BASE_URL}/api/blockchain/onchain-register/${selectedBookId}`,
        { txHash: result.txHash, network: "sepolia" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      confetti({ particleCount: 150, spread: 80, colors: ["#4f46e5", "#16a34a"] });
      await fetchBooks();
    } catch (err) {
      console.error("On-chain registration error:", err);
      setOnChainError(err?.reason || err?.shortMessage || err?.message || "On-chain registration failed.");
    } finally {
      setIsOnChainRegistering(false);
    }
  };

  const handleOnChainVerify = async () => {
    const book = books.find(b => (b._id || b.id) === selectedBookId);
    if (!book?.blockchainHash) return alert("This manuscript has no registered hash to verify against.");

    setIsOnChainVerifying(true);
    setOnChainVerifyResult(null);
    try {
      const isValid = await verifyManuscriptOnChain(book._id || book.id, book.blockchainHash);
      setOnChainVerifyResult({ isValid });
    } catch (err) {
      console.error("On-chain verify error:", err);
      setOnChainError(err?.reason || err?.shortMessage || err?.message || "On-chain verification failed.");
    } finally {
      setIsOnChainVerifying(false);
    }
  };

  const verifiedBooks = books.filter(b => b.blockchainHash);

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Blockchain Ledger Registry</h1>
          <p>Register ownership signatures and protect your copyrights on the ledger.</p>
        </div>
      </div>

      <div className="blockchain-panel">
        <div className="blockchain-status" style={{ border: "1px solid rgba(79, 70, 229, 0.2)" }}>
          <div className="chain-icon"><Wallet size={32} color="var(--accent-600)" /></div>
          <div style={{ flex: 1 }}>
            <h3>
              Web3 Ledger Integration
              <HelpTip
                title="What is this for?"
                text="Lets you prove you wrote a manuscript by a certain date. A fingerprint of your text is saved — your story itself is not published. MetaMask is needed for the public-blockchain option."
              />
            </h3>
            {walletConnected ? (
              <p className="chain-ok" style={{ color: "var(--success)", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={14} /> Connected: {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </p>
            ) : (
              <p className="chain-warn" style={{ color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
                <AlertCircle size={14} /> Connect Ethereum Wallet (MetaMask) to verify signatures.
              </p>
            )}
          </div>
          {!walletConnected && (
            !metamaskDetected ? (
              <a
                href="https://metamask.io/download/"
                target="_blank"
                rel="noreferrer"
                className="btn-primary"
                style={{
                  background: "#f6851b",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "10px 18px",
                  borderRadius: 10,
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: 13
                }}
              >
                🦊 Install MetaMask
              </a>
            ) : (
              <button
                onClick={handleConnectWallet}
                disabled={connecting}
                className="btn-primary"
                style={{
                  background: connecting
                    ? "var(--text-muted)"
                    : "linear-gradient(135deg, #f6851b 0%, #e2761b 100%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  borderRadius: 10,
                  color: "#fff",
                  fontWeight: "bold",
                  fontSize: 13,
                  border: "none",
                  cursor: connecting ? "not-allowed" : "pointer"
                }}
              >
                {connecting ? (
                  <><span>⏳</span><span>Opening MetaMask...</span></>
                ) : (
                  <><span style={{ fontSize: 16 }}>🦊</span><span>Connect MetaMask</span></>
                )}
              </button>
            )
          )}
        </div>

        {/* Connection Error Banner */}
        {connectError && (
          <div style={{
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            borderRadius: 10,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--danger)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginTop: 12
          }}>
            <span>⚠️</span>
            <div>
              <strong>Connection Failed:</strong> {connectError}
              {connectError.includes("already open") && (
                <p style={{ margin: "4px 0 0", opacity: 0.8 }}>
                  Look for the 🦊 MetaMask icon in your browser toolbar and click it.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="dash-grid" style={{ marginTop: 24 }}>
          <div className="dash-panel">
            <div className="panel-header">
              <h3>Lock/Verify Manuscript Ledger</h3>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label className="form-label">Select Manuscript</label>
                <select className="input-field" value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)}>
                  {books.map(b => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.title} {b.blockchainHash ? " (Secured)" : " (Unsecured)"}
                    </option>
                  ))}
                </select>
              </div>

              {selectedBookId && books.find(b => (b._id || b.id) === selectedBookId)?.blockchainHash ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="glass-panel" style={{ padding: 14, background: "rgba(22, 163, 74, 0.05)" }}>
                    <p style={{ fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 6, fontWeight: "bold" }}>
                      <CheckCircle size={14} /> Securely Locked on Ledger
                    </p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 4 }}>
                      Hash: {books.find(b => (b._id || b.id) === selectedBookId).blockchainHash}
                    </p>
                  </div>
                  
                  <button onClick={handleVerify} disabled={isVerifying} className="btn-secondary" style={{ width: "100%", justifyContent: "center" }}>
                    {isVerifying ? "Verifying..." : "Verify Content Integrity"}
                  </button>
                </div>
              ) : (
                <button onClick={handleRegister} disabled={isRegistering || !walletConnected} className="btn-primary" style={{ width: "100%", justifyContent: "center" }}>
                  {isRegistering ? "Securing Ledger..." : "Register Copyright Signature"}
                </button>
              )}

              {verifyResult && (
                <div className="glass-panel" style={{ padding: 14, borderColor: verifyResult.isValid ? "var(--success)" : "var(--danger)", background: "color-mix(in srgb, var(--text-primary) 15%, transparent)" }}>
                  <span style={{ color: verifyResult.isValid ? "var(--success)" : "var(--danger)", fontWeight: "bold", fontSize: 13 }}>
                    {verifyResult.isValid ? "✓ INTEGRITY VERIFIED" : "❌ HASH MISMATCH"}
                  </span>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>{verifyResult.message}</p>
                </div>
              )}
            </div>
          </div>

          <div className="dash-panel">
            <div className="panel-header">
              <h3>Secured Works ({verifiedBooks.length})</h3>
            </div>
            
            {verifiedBooks.length === 0 ? (
              <p className="empty-text">No secured blockchain registries found.</p>
            ) : (
              <div className="activity-list">
                {verifiedBooks.map(b => (
                  <div key={b._id || b.id} className="chain-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)" }}>
                    <Lock size={14} color="var(--accent-600)" />
                    <div style={{ flex: 1 }}>
                      <span className="chain-title" style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{b.title}</span>
                      <span className="chain-hash" style={{ display: "block", fontSize: 9, color: "var(--text-secondary)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                        {b.blockchainHash.slice(0, 16)}...
                      </span>
                    </div>
                    <span className="chain-date" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                      {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                    <CheckCircle size={14} color="var(--success)" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Real on-chain anchor — actually writes to the deployed
            ManuscriptRegistry contract on Sepolia via the author's own
            MetaMask wallet, distinct from the off-chain hash-in-MongoDB
            "ledger" above. */}
        {(() => {
          const book = books.find(b => (b._id || b.id) === selectedBookId);
          const onChain = book?.onChainTxHash;

          return (
            <div className="dash-panel" style={{ marginTop: 20 }}>
              <div className="panel-header">
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={16} color="var(--accent-600)" /> Real Blockchain Anchor (Sepolia Testnet)
                  <HelpTip
                    title="What is Sepolia?"
                    text="A practice version of Ethereum — nothing on it has real money value. You need a little free test ETH for the fee (search for a Sepolia faucet)."
                  />
                </h3>
              </div>

              {!CONTRACT_ADDRESS ? (
                <p className="empty-text">Smart contract not configured yet.</p>
              ) : !book ? (
                <p className="empty-text">Select a manuscript above.</p>
              ) : onChain ? (
                <div className="glass-panel" style={{ padding: 14, background: "rgba(22, 163, 74, 0.05)" }}>
                  <p style={{ fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 6, fontWeight: "bold" }}>
                    <CheckCircle size={14} /> Anchored on Sepolia — a real, public blockchain transaction
                  </p>
                  <a
                    href={`https://sepolia.etherscan.io/tx/${onChain}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: 11, color: "var(--accent-600)", fontFamily: "monospace", display: "block", marginTop: 6, wordBreak: "break-all" }}
                  >
                    {onChain} ↗ View on Etherscan
                  </a>

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button onClick={handleOnChainVerify} disabled={isOnChainVerifying} className="btn-secondary" style={{ flex: 1, justifyContent: "center" }}>
                      {isOnChainVerifying ? "Checking chain..." : "Verify on Sepolia"}
                    </button>
                    <button
                      onClick={handleOnChainRegister}
                      disabled={isOnChainRegistering || !book.blockchainHash}
                      className="btn-secondary"
                      style={{ flex: 1, justifyContent: "center" }}
                      title="Push a new on-chain snapshot if you've edited and re-registered the off-chain hash since"
                    >
                      {isOnChainRegistering ? "Submitting..." : "Push New Version"}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    Not yet anchored on Sepolia. This writes the same hash shown above to a real, permanent smart
                    contract — you'll sign the transaction in MetaMask and pay a small amount of testnet gas.
                  </p>
                  <button
                    onClick={handleOnChainRegister}
                    disabled={isOnChainRegistering || !walletConnected || !book.blockchainHash}
                    className="btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    {isOnChainRegistering ? "Confirm in MetaMask..." : "Register on Sepolia (Real Blockchain)"}
                  </button>
                  {!book.blockchainHash && (
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Register the copyright signature above first.</p>
                  )}
                </div>
              )}

              {onChainVerifyResult && (
                <div className="glass-panel" style={{ padding: 14, marginTop: 12, borderColor: onChainVerifyResult.isValid ? "var(--success)" : "var(--danger)" }}>
                  <span style={{ color: onChainVerifyResult.isValid ? "var(--success)" : "var(--danger)", fontWeight: "bold", fontSize: 13 }}>
                    {onChainVerifyResult.isValid ? "✓ MATCHES ON-CHAIN RECORD" : "❌ DOES NOT MATCH ON-CHAIN RECORD"}
                  </span>
                </div>
              )}

              {onChainError && (
                <div className="glass-panel" style={{ padding: 14, marginTop: 12, background: "var(--danger-bg)" }}>
                  <span style={{ color: "var(--danger)", fontSize: 12 }}>{onChainError}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Version History — transparent, content-hashed edit timeline */}
        <div className="dash-panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <h3>
              Version History
              <HelpTip
                title="What is this?"
                text="A timeline of saved versions of your manuscript. Each has its own fingerprint, so you can see when the text changed."
              />
            </h3>
          </div>
          {(() => {
            const selectedBook = books.find(b => (b._id || b.id) === selectedBookId);
            const history = selectedBook?.versionHistory || [];
            if (!selectedBook) {
              return <p className="empty-text">Select a manuscript above to see its version history.</p>;
            }
            if (history.length === 0) {
              return <p className="empty-text">No snapshots recorded yet for this manuscript.</p>;
            }
            return (
              <div className="activity-list">
                {[...history].reverse().map((v, idx) => (
                  <div key={v._id || idx} className="chain-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)" }}>
                    <Layers size={14} color="var(--accent-600)" />
                    <div style={{ flex: 1 }}>
                      <span className="chain-title" style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>
                        {v.note} · {v.wordCount} words
                      </span>
                      <span className="chain-hash" style={{ display: "block", fontSize: 9, color: "var(--text-secondary)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
                        {v.contentHash}
                      </span>
                    </div>
                    <span className="chain-date" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                      {new Date(v.snapshotAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR ANALYTICS ────────────────────────────────────────────────────────
export const AuthorAnalytics = ({ books, user }) => {
  const totalReads = books.reduce((s, b) => s + (b.totalReads || 0), 0);
  const totalEarnings = user?.earnings || 0;
  const totalWords = books.reduce((s, b) => s + (b.content ? b.content.split(/\s+/).filter(Boolean).length : 0), 0);

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Examine reader engagement and royalty yields.</p>
        </div>
      </div>

      <div className="stats-row">
        <StatCard icon={<Eye size={20} />} label="Total Reads" value={fmt(totalReads)} color="var(--info)" />
        <StatCard icon={<TrendingUp size={20} />} label="Est. Earnings (USD)" value={`$${totalEarnings.toFixed(2)}`} color="var(--success)" />
        <StatCard icon={<FileText size={20} />} label="Total Word Count" value={fmt(totalWords)} color="var(--accent-600)" />
        <StatCard icon={<Star size={20} />} label="Books Scanned" value={books.filter(b => b.qualityScore).length} color="var(--warning)" />
      </div>

      <div className="dash-grid" style={{ marginTop: 24 }}>
        <div className="dash-panel">
          <div className="panel-header">
            <h3>Readership Breakdown by Manuscript</h3>
          </div>
          {books.length === 0 ? (
            <p className="empty-text">No books to display metrics.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "10px 0" }}>
              {books.map(b => {
                const maxReads = Math.max(...books.map(x => x.totalReads || 0), 1);
                const percent = (((b.totalReads || 0) / maxReads) * 100).toFixed(0);
                return (
                  <div key={b._id || b.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{b.title}</span>
                      <strong>{fmt(b.totalReads || 0)} reads</strong>
                    </div>
                    <div style={{ height: 8, background: "rgba(255,255,255,0.05)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${percent}%`, height: "100%", background: "linear-gradient(90deg, var(--accent-600), var(--info))", borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="dash-panel">
          <div className="panel-header">
            <h3>Monthly Reader Trends</h3>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", height: 180, gap: 16, paddingBottom: 10, borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)" }}>
            {[
              { m: "Dec", h: 25 }, { m: "Jan", h: 40 }, { m: "Feb", h: 55 }, 
              { m: "Mar", h: 45 }, { m: "Apr", h: 70 }, { m: "May", h: 90 }
            ].map((trend, idx) => (
              <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{ width: "100%", height: `${trend.h}%`, background: idx === 5 ? "var(--accent-600)" : "rgba(79, 70, 229, 0.4)", borderRadius: "4px 4px 0 0" }} />
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>{trend.m}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR AI PLAYGROUND ────────────────────────────────────────────────────
export const AuthorAIAssistant = ({ token }) => {
  const [inputText, setInputText] = useState("");
  const [promptType, setPromptType] = useState("improve");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRunAI = async () => {
    if (!inputText.trim()) return alert("Please write or paste some text first!");
    setLoading(true);
    setResult("");
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/ai/assist`,
        { text: inputText, promptType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (data.success) {
        setResult(data.suggestion);
      }
    } catch (err) {
      console.error(err);
      alert("AI suggestion generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleTemplate = (text, type) => {
    setInputText(text);
    setPromptType(type);
  };

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>AI Creative Laboratory</h1>
          <p>Generate summaries, translate styles, refine story drafts, and simplify complex prose.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* Playground panel */}
        <div className="glass-panel" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <h3>AI Writing Playground</h3>
          
          <div>
            <label className="form-label">Select Transformation Rule</label>
            <select className="input-field" value={promptType} onChange={e => setPromptType(e.target.value)}>
              <option value="improve">Refine Flow & Tone (Polishes vocabulary and expressions)</option>
              <option value="simplify">Simplify Vocabulary (Improves readability rating)</option>
              <option value="formal">Classical Literary Tone (Elevates prose density)</option>
              <option value="summarize">Create Synopsis Summary (Builds abstract blurb)</option>
            </select>
          </div>

          <div>
            <label className="form-label">Draft / Input Content</label>
            <textarea
              className="input-field"
              placeholder="Paste your paragraph or story chapter here..."
              style={{ height: 280, resize: "none" }}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
            />
          </div>

          <button onClick={handleRunAI} disabled={loading} className="btn-primary" style={{ width: "100%" }}>
            {loading ? "AI is processing suggestions..." : "Generate AI Suggestions"}
          </button>
        </div>

        {/* Templates and Outputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Output card */}
          <div className="glass-panel" style={{ padding: 24, flex: 1, minHeight: 280, display: "flex", flexDirection: "column" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent-600)" }}><Sparkles size={16} /> AI Output Suggestion</h3>
            {loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw className="spin" size={32} style={{ color: "var(--accent-600)" }} />
              </div>
            ) : result ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                <div style={{ flex: 1, padding: 16, background: "rgba(79, 70, 229, 0.03)", border: "1px solid rgba(79, 70, 229, 0.1)", borderRadius: 10, fontSize: 13, lineHeight: 1.6, overflowY: "auto" }}>
                  {result.replace(/^\[.*\]:\n/, "")}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(result.replace(/^\[.*\]:\n/, ""));
                    alert("AI suggestions copied to clipboard!");
                  }}
                  className="btn-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Copy suggestion to clipboard
                </button>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                Write draft content and click generate to observe AI suggestions here.
              </div>
            )}
          </div>

          {/* Quick presets */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3>Creative Inspiration Presets</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <button 
                onClick={() => handleTemplate("She was very sad when she had to leave the house because it was a bad day.", "improve")}
                className="btn-secondary" style={{ fontSize: 11, textAlign: "left", justifyContent: "flex-start", padding: "8px 12px" }}
              >
                Preset: Improve Vocabulary ("She was sad...")
              </button>
              <button
                onClick={() => handleTemplate("I need to utilize additional methods to terminate the comprehensive process.", "simplify")}
                className="btn-secondary" style={{ fontSize: 11, textAlign: "left", justifyContent: "flex-start", padding: "8px 12px" }}
              >
                Preset: Simplify Prose ("I need to utilize...")
              </button>
              <button
                onClick={() => handleTemplate("The system works on decentralised consensus to guarantee database records aren't modified.", "formal")}
                className="btn-secondary" style={{ fontSize: 11, textAlign: "left", justifyContent: "flex-start", padding: "8px 12px" }}
              >
                Preset: Classical Literary ("The system works...")
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR SETTINGS ─────────────────────────────────────────────────────────
export const AuthorSettings = ({ user }) => {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests || []);
  const [loading, setLoading] = useState(false);

  const availableInterests = [
    "fiction", "non-fiction", "science", "technology", "poetry", "drama", "history", "biography"
  ];

  const handleToggleInterest = (genre) => {
    if (interests.includes(genre)) {
      setInterests(interests.filter(i => i !== genre));
    } else {
      setInterests([...interests, genre]);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert("Name is required!");
    setLoading(true);
    try {
      const res = await updateProfile({ name, bio, interests });
      if (res.success) {
        alert("Author Profile updated successfully!");
      } else {
        alert("Profile update failed: " + res.error);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating profile settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Profile & Account Settings</h1>
          <p>Update your public display identity, author biography details, and genre interests.</p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 32, maxWidth: 640 }}>
        <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="form-label">Author Biography (Bio)</label>
            <textarea
              className="input-field"
              placeholder="Tell your readers and publishers about yourself..."
              style={{ height: 120, resize: "none" }}
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Literary Genre Interests</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {availableInterests.map(genre => {
                const active = interests.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => handleToggleInterest(genre)}
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      borderRadius: 20,
                      border: "1.5px solid",
                      borderColor: active ? "var(--accent-600)" : "var(--border-medium)",
                      background: active ? "rgba(79, 70, 229, 0.08)" : "var(--bg-primary)",
                      color: active ? "var(--accent-600)" : "var(--text-secondary)",
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

          <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving settings..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-panel" style={{ padding: 32, maxWidth: 640 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Appearance</h3>
        <ThemeToggle />
      </div>
    </div>
  );
};