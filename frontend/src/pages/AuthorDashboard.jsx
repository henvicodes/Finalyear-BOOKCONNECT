import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BookOpen,
  Upload,
  Star,
  Shield,
  TrendingUp,
  Eye,
  MessageCircle,
  BarChart2,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  FileText,
  Lock,
  Sparkles,
  ArrowUpRight,
  Send,
  User,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  BookMarked,
  Wallet,
  DollarSign,
  PenTool,
} from "lucide-react";
import ChatInterface from "../components/ChatInterface";
import confetti from "canvas-confetti";
import { useAuth } from "../context/AuthContext";
import {
  connectMetaMask,
  getConnectedAccount,
  isMetaMaskInstalled,
} from "../services/web3";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Format helper
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n || 0));

// Stat Card Component
const StatCard = ({ icon, label, value, change, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "1a", color }}>
      {icon}
    </div>
    <div className="stat-info">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
    {change !== undefined && (
      <div className={`stat-change ${change >= 0 ? "up" : "down"}`}>
        <ArrowUpRight size={13} />
        {Math.abs(change)}%
      </div>
    )}
  </div>
);

// Activity Item Component
const ActivityItem = ({ icon, text, time, color }) => (
  <div className="activity-item">
    <div className="activity-icon" style={{ background: color + "1a", color }}>
      {icon}
    </div>
    <div className="activity-text">
      <span>{text}</span>
      <span className="activity-time">{time}</span>
    </div>
  </div>
);

// Skeleton Loader
const Skel = () => (
  <div
    className="skel-row"
    style={{
      height: 48,
      background: "rgba(255,255,255,0.03)",
      borderRadius: 8,
      marginBottom: 8,
    }}
  />
);

// ─── BOOK ROW COMPONENT ──────────────────────────────────────────────────────
const BookRow = ({ book, onEdit, onPayCost, onBlockchain, setActive }) => {
  const isPublished = book.status === "published";
  const isReview = book.status === "under_review";
  const isSeen = book.status === "seen";
  const isCostProposed = book.status === "cost_proposed";
  const isDraft = book.status === "draft" || !book.status;

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
  }

  return (
    <div className="book-row-full">
      <div className="book-row-cover">
        {book.coverImage && book.coverImage !== "default-cover.jpg" ? (
          <img src={book.coverImage} alt={book.title} />
        ) : (
          <BookOpen size={24} />
        )}
      </div>
      <div className="book-row-info">
        <span className="book-row-title">{book.title}</span>
        <span
          className="book-row-genre"
          style={{ textTransform: "capitalize" }}
        >
          {book.genre || "Fiction"}
        </span>
      </div>
      <span className={`book-status ${statusClass}`}>{statusLabel}</span>

      {isCostProposed && (
        <span
          style={{
            fontSize: 12,
            fontWeight: "bold",
            color: "#f59e0b",
            background: "rgba(245,158,11,0.1)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          ${book.publishingCost} fee
        </span>
      )}

      <span
        className="book-views"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <Eye size={14} /> {fmt(book.totalReads || 0)}
      </span>

      <div className="book-row-actions">
        {isCostProposed ? (
          <button
            className="btn-primary-dash"
            style={{
              padding: "6px 12px",
              fontSize: 12,
              background: "#10b981",
              boxShadow: "none",
            }}
            onClick={() => onPayCost(book.id || book._id)}
          >
            <DollarSign size={12} /> Pay & Publish
          </button>
        ) : (
          <button
            className="edit-btn"
            onClick={() => onEdit(book.id || book._id)}
          >
            Edit
          </button>
        )}

        {book.blockchainHash ? (
          <button
            className="edit-btn"
            style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}
            onClick={() => setActive("blockchain")}
          >
            <Shield size={12} style={{ marginRight: 4 }} /> Secure
          </button>
        ) : (
          <button
            className="edit-btn"
            style={{ background: "rgba(124, 58, 237, 0.1)", color: "#7c3aed" }}
            onClick={() => setActive("blockchain")}
          >
            Secure
          </button>
        )}
      </div>
    </div>
  );
};

// ─── IN-EDITOR AI WRITER PANEL ──────────────────────────────────────────────
const InlineAIWriter = ({
  content,
  setContent,
  bookId,
  token,
  onEvaluateSuccess,
  title = "",
  genre = "",
}) => {
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
        { headers: { Authorization: `Bearer ${token}` } },
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
          { headers: { Authorization: `Bearer ${token}` } },
        );
        data = response.data;
      } else {
        const response = await axios.post(
          `${BASE_URL}/api/ai/evaluate-raw`,
          { text: content, title, genre },
          { headers: { Authorization: `Bearer ${token}` } },
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
    <div
      className="glass-panel"
      style={{
        padding: 20,
        border: "1px solid rgba(124, 58, 237, 0.15)",
        background: "rgba(124, 58, 237, 0.02)",
      }}
    >
      <h3
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: "#7c3aed",
          marginBottom: 12,
        }}
      >
        <Sparkles size={16} /> AI Writing Assistant (Inline)
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label
            style={{
              fontSize: 11,
              fontWeight: "bold",
              color: "#64748b",
              display: "block",
              marginBottom: 6,
            }}
          >
            REWRITE SELECTION
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={assistType}
              onChange={(e) => setAssistType(e.target.value)}
              className="input-field"
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: 12,
                borderRadius: 6,
                border: "1px solid #ede9fe",
              }}
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
              style={{
                padding: "6px 14px",
                fontSize: 12,
                borderRadius: 6,
                background: "#7c3aed",
              }}
            >
              {isAssisting ? "Thinking..." : "Rewrite"}
            </button>
          </div>
        </div>

        {aiSuggestion && (
          <div
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(124,58,237,0.15)",
              borderRadius: 8,
            }}
          >
            <span
              style={{
                fontSize: 10,
                color: "#7c3aed",
                fontWeight: "bold",
                display: "block",
              }}
            >
              SUGGESTION:
            </span>
            <p
              style={{
                fontSize: 12,
                color: "#1a1a2e",
                marginTop: 4,
                whiteSpace: "pre-wrap",
              }}
            >
              {aiSuggestion}
            </p>
            <button
              type="button"
              onClick={applySuggestion}
              style={{
                marginTop: 8,
                padding: "4px 10px",
                fontSize: 11,
                background: "#7c3aed",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Apply Rewrite
            </button>
          </div>
        )}

        <hr
          style={{ border: "none", borderTop: "1px solid rgba(0,0,0,0.06)" }}
        />

        <div>
          <button
            type="button"
            onClick={handleScan}
            disabled={isScanning}
            className="btn-secondary"
            style={{
              width: "100%",
              justifyContent: "center",
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              fontSize: 12,
            }}
          >
            {isScanning ? (
              <RefreshCw className="animate-spin" size={12} />
            ) : (
              <BarChart2 size={12} />
            )}
            Scan Readability & Plagiarism
          </button>

          {scanResult && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    background: "rgba(124, 58, 237, 0.05)",
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "center",
                    border: "1px solid rgba(124, 58, 237, 0.1)",
                  }}
                >
                  <span style={{ fontSize: 9, color: "#64748b" }}>
                    QUALITY SCORE
                  </span>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: "#7c3aed",
                    }}
                  >
                    {scanResult.qualityScore}%
                  </div>
                </div>
                <div
                  style={{
                    background: "rgba(14, 165, 233, 0.05)",
                    padding: 8,
                    borderRadius: 6,
                    textAlign: "center",
                    border: "1px solid rgba(14, 165, 233, 0.1)",
                  }}
                >
                  <span style={{ fontSize: 9, color: "#64748b" }}>
                    READABILITY
                  </span>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: "bold",
                      color: "#0ea5e9",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {scanResult.readabilityScore}
                  </div>
                </div>
              </div>

              <div
                style={{
                  background:
                    scanResult.plagiarismScore > 15
                      ? "rgba(239,68,68,0.05)"
                      : "rgba(16,185,129,0.05)",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                  }}
                >
                  <span>Plagiarism:</span>
                  <strong
                    style={{
                      color:
                        scanResult.plagiarismScore > 15 ? "#ef4444" : "#10b981",
                    }}
                  >
                    {scanResult.plagiarismScore}%
                  </strong>
                </div>
                {scanResult.plagiarismMatches &&
                  scanResult.plagiarismMatches.length > 0 && (
                    <div
                      style={{ fontSize: 9, color: "#ef4444", marginTop: 4 }}
                    >
                      ⚠️ Overlap with "{scanResult.plagiarismMatches[0].title}"
                      ({scanResult.plagiarismMatches[0].similarity}% match)
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
export const AuthorOverview = ({
  user,
  setActive,
  books,
  loading,
  setEditingBookId,
  onPayCost,
}) => {
  const totalReads = books.reduce((s, b) => s + (b.totalReads || 0), 0);
  const publishedBooks = books.filter((b) => b.status === "published");
  const draftBooks = books.filter((b) => b.status === "draft" || !b.status);
  const reviewBooks = books.filter(
    (b) =>
      b.status === "under_review" ||
      b.status === "seen" ||
      b.status === "cost_proposed",
  );

  const avgRating = books.filter((b) => b.qualityScore).length
    ? (
        books.reduce((s, b) => s + (b.qualityScore || 0), 0) /
        books.filter((b) => b.qualityScore).length
      ).toFixed(1)
    : "—";

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
          <p>Here's what's happening with your literary works today.</p>
        </div>
        <button
          onClick={() => setActive("upload")}
          className="btn-primary-dash"
        >
          <Plus size={16} /> New Book
        </button>
      </div>

      <div className="stats-row">
        <StatCard
          icon={<BookOpen size={20} />}
          label="Total Books"
          value={loading ? "…" : books.length}
          color="#7c3aed"
        />
        <StatCard
          icon={<Eye size={20} />}
          label="Total Reads"
          value={loading ? "…" : fmt(totalReads)}
          color="#0ea5e9"
        />
        <StatCard
          icon={<CheckCircle size={20} />}
          label="Published"
          value={loading ? "…" : publishedBooks.length}
          color="#059669"
        />
        <StatCard
          icon={<Star size={20} />}
          label="Avg Quality Score"
          value={loading ? "…" : avgRating}
          color="#f59e0b"
        />
      </div>

      {!loading && books.length > 0 && (
        <div className="status-summary">
          <div className="status-pill published">
            <CheckCircle size={12} /> {publishedBooks.length} Published
          </div>
          {draftBooks.length > 0 && (
            <div className="status-pill draft">
              <FileText size={12} /> {draftBooks.length} Drafts
            </div>
          )}
          {reviewBooks.length > 0 && (
            <div className="status-pill review">
              <Clock size={12} /> {reviewBooks.length} Submissions
            </div>
          )}
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-panel">
          <div className="panel-header">
            <h3>Recent Books</h3>
            <button className="panel-link" onClick={() => setActive("mybooks")}>
              View all
            </button>
          </div>
          {loading ? (
            [1, 2, 3].map((i) => <Skel key={i} />)
          ) : books.length === 0 ? (
            <p className="empty-text">
              No books yet.{" "}
              <span
                className="action-text"
                onClick={() => setActive("upload")}
                style={{
                  color: "#7c3aed",
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Upload your first book →
              </span>
            </p>
          ) : (
            books.slice(0, 4).map((b) => (
              <BookRow
                key={b._id}
                book={b}
                onEdit={(id) => {
                  setEditingBookId(id);
                  setActive("editbook");
                }}
                onPayCost={onPayCost}
                onBlockchain={() => setActive("blockchain")}
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
            [1, 2, 3].map((i) => <Skel key={i} />)
          ) : (
            <div className="activity-list">
              {publishedBooks.slice(0, 2).map((b) => (
                <ActivityItem
                  key={b._id}
                  icon={<BookOpen size={14} />}
                  text={`"${b.title}" is live on the library`}
                  time="Published"
                  color="#059669"
                />
              ))}
              {books
                .filter((b) => b.status === "under_review")
                .slice(0, 2)
                .map((b) => (
                  <ActivityItem
                    key={b._id}
                    icon={<Clock size={14} />}
                    text={`Submitted "${b.title}" to publisher`}
                    time="Reviewing"
                    color="#f59e0b"
                  />
                ))}
              {books
                .filter((b) => b.blockchainHash)
                .slice(0, 1)
                .map((b) => (
                  <ActivityItem
                    key={`bc-${b._id}`}
                    icon={<Shield size={14} />}
                    text={`"${b.title}" secured on Ethereum`}
                    time="Web3 Verified"
                    color="#7c3aed"
                  />
                ))}
              <ActivityItem
                icon={<Sparkles size={14} />}
                text="AI Writing Assistant loaded in editor panels"
                time="System Ready"
                color="#0ea5e9"
              />
            </div>
          )}
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="actions-row">
          <button className="action-card" onClick={() => setActive("upload")}>
            <Upload size={22} color="#7c3aed" />
            <span>Upload Book</span>
          </button>
          <button className="action-card" onClick={() => setActive("messages")}>
            <MessageCircle size={22} color="#0ea5e9" />
            <span>Publishers Chat</span>
          </button>
          <button
            className="action-card"
            onClick={() => setActive("blockchain")}
          >
            <Shield size={22} color="#059669" />
            <span>Verify Ownership</span>
          </button>
          <button
            className="action-card"
            onClick={() => setActive("analytics")}
          >
            <TrendingUp size={22} color="#f59e0b" />
            <span>Analytics</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR MY BOOKS ────────────────────────────────────────────────────────
export const AuthorMyBooks = ({
  books,
  loading,
  setActive,
  setEditingBookId,
  onPayCost,
}) => {
  const publishedBooks = books.filter((b) => b.status === "published");

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>My Books</h1>
          <p>
            You have {books.length} book{books.length !== 1 ? "s" : ""} in your
            library.
          </p>
        </div>
        <button
          onClick={() => setActive("upload")}
          className="btn-primary-dash"
        >
          <Plus size={16} /> New Book
        </button>
      </div>

      <div className="dash-panel" style={{ maxWidth: "100%" }}>
        <div className="panel-header">
          <h3>All Manuscripts ({books.length})</h3>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>
            Published: <strong>{publishedBooks.length}</strong>
          </span>
        </div>

        {loading ? (
          [1, 2, 3, 4].map((i) => <Skel key={i} />)
        ) : books.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <BookMarked
              size={48}
              color="#4b5563"
              style={{ marginBottom: 12 }}
            />
            <p style={{ color: "#94a3b8", fontSize: 14 }}>
              No books uploaded yet.
            </p>
            <button
              onClick={() => setActive("upload")}
              className="btn-primary-dash"
              style={{ marginTop: 12, display: "inline-flex" }}
            >
              Upload your first book
            </button>
          </div>
        ) : (
          <div className="books-list-container">
            {books.map((b) => (
              <div key={b._id} className="book-row-full">
                <div className="book-row-cover">
                  {b.coverImage && b.coverImage !== "default-cover.jpg" ? (
                    <img src={b.coverImage} alt={b.title} />
                  ) : (
                    <BookOpen size={24} />
                  )}
                </div>
                <div className="book-row-info">
                  <span className="book-row-title">{b.title}</span>
                  <span className="book-row-genre">
                    {b.genre || "Fiction"} · Created:{" "}
                    {new Date(b.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <span
                  className={`book-status ${
                    b.status === "published"
                      ? "published"
                      : b.status === "under_review" ||
                        b.status === "seen" ||
                        b.status === "cost_proposed"
                      ? "review"
                      : "draft"
                  }`}
                >
                  {b.status === "published"
                    ? "Published"
                    : b.status === "under_review"
                    ? "Reviewing"
                    : b.status === "seen"
                    ? "Seen"
                    : b.status === "cost_proposed"
                    ? "Proposed"
                    : "Draft"}
                </span>

                {b.status === "cost_proposed" && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: "bold",
                      color: "#f59e0b",
                    }}
                  >
                    Proposed fee: ${b.publishingCost}
                  </span>
                )}

                <span
                  className="book-rating"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                  }}
                >
                  <Star
                    size={12}
                    fill={b.qualityScore ? "currentColor" : "none"}
                    color="#f59e0b"
                  />
                  {b.qualityScore ? `${b.qualityScore}/100` : "No Scan"}
                </span>

                <div style={{ display: "flex", gap: 8 }}>
                  {b.status === "cost_proposed" ? (
                    <button
                      className="btn-primary-dash"
                      style={{
                        padding: "5px 10px",
                        fontSize: 11,
                        background: "#10b981",
                      }}
                      onClick={() => onPayCost(b._id)}
                    >
                      Pay & Publish
                    </button>
                  ) : (
                    <button
                      className="edit-btn"
                      onClick={() => {
                        setEditingBookId(b._id);
                        setActive("editbook");
                      }}
                    >
                      Edit
                    </button>
                  )}

                  <button
                    className="btn-blockchain-verify"
                    onClick={() => {
                      setActive("blockchain");
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: "0.8rem",
                      background: b.blockchainHash
                        ? "rgba(16, 185, 129, 0.1)"
                        : "rgba(124, 58, 237, 0.1)",
                      color: b.blockchainHash ? "#10b981" : "#a78bfa",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Shield size={12} />{" "}
                    {b.blockchainHash ? "Secured" : "Lock Ledger"}
                  </button>
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
    axios
      .get(`${BASE_URL}/api/auth/search?q=@`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) {
          setPublishers(res.data.data.filter((u) => u.role === "publisher"));
        }
      })
      .catch(console.error);
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
        coverImage: coverImage || null,
      };

      let res;
      if (createdBookId) {
        res = await axios.put(
          `${BASE_URL}/api/manuscripts/${createdBookId}`,
          payload,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } else {
        res = await axios.post(`${BASE_URL}/api/manuscripts`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      if (res.data.success) {
        setCreatedBookId(res.data.id || res.data.data._id);
        alert(
          "Draft saved successfully! You can now run AI Scans on the right-hand panel.",
        );
        await fetchBooks();
      }
    } catch (err) {
      console.error(err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Error saving draft.";
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        confetti({ particleCount: 80, spread: 60 });
        alert("Manuscript submitted to publisher for review successfully!");
        await fetchBooks();
        setActive("mybooks");
      }
    } catch (err) {
      console.error(err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Error submitting review.";
      alert(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="dash-content animate-fade-in"
      style={{ position: "relative" }}
    >
      <div className="dash-welcome">
        <div>
          <h1>Create & Write Manuscript</h1>
          <p>
            Compose stories, use inline AI rewrite, and select publishers to
            submit.
          </p>
        </div>
        <button
          onClick={() => setActive("mybooks")}
          className="btn-secondary"
          style={{ padding: "8px 16px" }}
        >
          <ArrowLeft size={16} /> Back to Library
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2.5fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Editor Form Container */}
        <div
          className="glass-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "80vh",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <form
            onSubmit={handleSaveDraft}
            style={{ display: "flex", flexDirection: "column", flex: 1 }}
          >
            {/* Metadata Section */}
            <div
              style={{
                padding: 24,
                borderBottom: "1px solid #e2e8f0",
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                }}
              >
                <div>
                  <label className="form-label">Manuscript Title</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Pride and Prejudice in Space"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    style={{ fontSize: 16, fontWeight: 600 }}
                  />
                </div>
                <div>
                  <label className="form-label">Genre</label>
                  <select
                    className="input-field"
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    style={{ textTransform: "capitalize" }}
                  >
                    <option value="fiction">Fiction</option>
                    <option value="non-fiction">Non-Fiction</option>
                    <option value="science">Science</option>
                    <option value="technology">Technology</option>
                    <option value="poetry">Poetry</option>
                    <option value="mystery">Mystery</option>
                    <option value="romance">Romance</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Select Target Publisher</label>
                  <select
                    className="input-field"
                    value={selectedPublisher}
                    onChange={(e) => setSelectedPublisher(e.target.value)}
                  >
                    <option value="">-- Choose Publisher --</option>
                    {publishers.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">
                    Book Price (USD) - Paid Reading
                  </label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Cover Image URL</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://images.unsplash.com/... or leave blank"
                    value={coverImage}
                    onChange={(e) => setCoverImage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Cover Theme Preset</label>
                  <select
                    className="input-field"
                    onChange={(e) => {
                      if (e.target.value) setCoverImage(e.target.value);
                      else setCoverImage("");
                    }}
                    value={coverImage}
                  >
                    <option value="">-- Choose A Theme Style --</option>
                    <option
                      value={`https://picsum.photos/seed/${encodeURIComponent(
                        title || "book",
                      )}/300/450`}
                    >
                      Automatic Title Art (Picsum)
                    </option>
                    <option value="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=300&auto=format&fit=crop">
                      Modern Abstract (Vibrant Art)
                    </option>
                    <option value="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300&auto=format&fit=crop">
                      Digital Technology (Tech & Code)
                    </option>
                    <option value="https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300&auto=format&fit=crop">
                      Classic Literature (Paperback Book)
                    </option>
                    <option value="https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=300&auto=format&fit=crop">
                      Mystery & Noir (Dark & Foggy)
                    </option>
                    <option value="https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=300&auto=format&fit=crop">
                      Romantic Red (Rose petals & Love)
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Writing Area */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "24px 32px",
              }}
            >
              <label
                className="form-label"
                style={{ marginBottom: 12, fontSize: 14 }}
              >
                Manuscript Workspace
              </label>
              <textarea
                className="input-field"
                placeholder="Start writing your story here..."
                style={{
                  flex: 1,
                  minHeight: 400,
                  border: "none",
                  background: "transparent",
                  fontSize: 16,
                  lineHeight: 1.8,
                  padding: 0,
                  resize: "none",
                  outline: "none",
                  boxShadow: "none",
                }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </div>

            {/* Sticky Action Bar */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                background: "#ffffff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                bottom: 0,
                zIndex: 10,
              }}
            >
              <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>
                Word Count:{" "}
                <strong style={{ color: "#0f172a" }}>
                  {content.split(/\s+/).filter(Boolean).length}
                </strong>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  type="submit"
                  className="btn-secondary"
                  disabled={isSubmitting}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 20px",
                  }}
                >
                  <FileText size={16} />{" "}
                  {createdBookId ? "Save Changes" : "Save as Draft"}
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  disabled={
                    isSubmitting || !selectedPublisher || !createdBookId
                  }
                  onClick={handleSubmitReview}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 20px",
                  }}
                >
                  <Send size={16} /> Submit to Publisher
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* AI Sidebar */}
        <div style={{ position: "sticky", top: 100 }}>
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

  useEffect(() => {
    if (!bookId) return;
    setLoading(true);

    // Fetch publishers
    axios
      .get(`${BASE_URL}/api/auth/search?q=@`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (res.data.success) {
          setPublishers(res.data.data.filter((u) => u.role === "publisher"));
        }
      })
      .catch(console.error);

    // Fetch book
    axios
      .get(`${BASE_URL}/api/manuscripts/${bookId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        if (data.success) {
          setTitle(data.data.title || "");
          setGenre(data.data.genre || "fiction");
          setPrice(data.data.price ? String(data.data.price) : "0");
          setContent(data.data.content || "");
          setStatus(data.data.status || "draft");
          setSelectedPublisher(data.data.publisher?._id || "");
          setCoverImage(data.data.coverImage || "");
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookId, token]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim())
      return alert("Title and Content are required!");
    setIsSaving(true);

    try {
      const payload = {
        title,
        content,
        genre,
        price: parseFloat(price),
        publisher: selectedPublisher || null,
        coverImage: coverImage || null,
      };

      const { data } = await axios.put(
        `${BASE_URL}/api/manuscripts/${bookId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (data.success) {
        alert("Manuscript updated successfully!");
        await fetchBooks();
      }
    } catch (err) {
      console.error(err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Error saving manuscript edits.";
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        confetti({ particleCount: 80, spread: 60 });
        alert("Submitted to publisher successfully!");
        await fetchBooks();
        setActive("mybooks");
      }
    } catch (err) {
      console.error(err);
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Submission error.";
      alert(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div
        className="dash-content animate-fade-in"
        style={{ textAlign: "center", padding: "100px 0" }}
      >
        <RefreshCw
          className="animate-spin"
          size={48}
          style={{ color: "#7c3aed" }}
        />
        <p style={{ marginTop: 12, color: "#94a3b8" }}>
          Loading manuscript details...
        </p>
      </div>
    );
  }

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Edit Manuscript</h1>
          <p>
            Currently Editing: <strong>{title}</strong> (Status:{" "}
            <span style={{ textTransform: "uppercase", color: "#7c3aed" }}>
              {status}
            </span>
            )
          </p>
        </div>
        <button
          onClick={() => setActive("mybooks")}
          className="btn-secondary"
          style={{ padding: "8px 16px" }}
        >
          <ArrowLeft size={16} /> Cancel Edits
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20 }}>
        {/* Editor Form */}
        <div className="glass-panel" style={{ padding: 24 }}>
          <form
            onSubmit={handleUpdate}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="form-label">Manuscript Title</label>
                <input
                  type="text"
                  className="input-field"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Genre</label>
                <select
                  className="input-field"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  style={{ textTransform: "capitalize" }}
                >
                  <option value="fiction">Fiction</option>
                  <option value="non-fiction">Non-Fiction</option>
                  <option value="science">Science</option>
                  <option value="technology">Technology</option>
                  <option value="poetry">Poetry</option>
                  <option value="mystery">Mystery</option>
                  <option value="romance">Romance</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="form-label">Select Publisher</label>
                <select
                  className="input-field"
                  value={selectedPublisher}
                  onChange={(e) => setSelectedPublisher(e.target.value)}
                >
                  <option value="">-- Choose Publisher --</option>
                  {publishers.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
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
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div>
                <label className="form-label">Cover Image URL</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. https://images.unsplash.com/... or leave blank"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Cover Theme Preset</label>
                <select
                  className="input-field"
                  onChange={(e) => {
                    if (e.target.value) {
                      setCoverImage(e.target.value);
                    } else {
                      setCoverImage("");
                    }
                  }}
                  value={coverImage}
                >
                  <option value="">-- Choose A Theme Style --</option>
                  <option
                    value={`https://picsum.photos/seed/${encodeURIComponent(
                      title || "book",
                    )}/300/450`}
                  >
                    Automatic Title Art (Picsum)
                  </option>
                  <option value="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=300&auto=format&fit=crop">
                    Modern Abstract (Vibrant Art)
                  </option>
                  <option value="https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300&auto=format&fit=crop">
                    Digital Technology (Tech & Code)
                  </option>
                  <option value="https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300&auto=format&fit=crop">
                    Classic Literature (Paperback Book)
                  </option>
                  <option value="https://images.unsplash.com/photo-1509248961158-e54f6934749c?q=80&w=300&auto=format&fit=crop">
                    Mystery & Noir (Dark & Foggy)
                  </option>
                  <option value="https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=300&auto=format&fit=crop">
                    Romantic Red (Rose petals & Love)
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label className="form-label">Manuscript Content</label>
              <textarea
                className="input-field"
                style={{
                  height: 350,
                  fontFamily: "var(--font-body)",
                  lineHeight: 1.6,
                  padding: 14,
                }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
              <div
                style={{
                  display: "flex",
                  justify: "space-between",
                  fontSize: 11,
                  color: "#64748b",
                  marginTop: 4,
                }}
              >
                <span>
                  Word Count: {content.split(/\s+/).filter(Boolean).length}{" "}
                  words
                </span>
              </div>
            </div>

            <div
              style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}
            >
              <button
                type="submit"
                className="btn-secondary"
                disabled={isSaving}
              >
                Save Draft
              </button>

              {status !== "published" && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isSaving || !selectedPublisher}
                  onClick={handleSubmitReview}
                  style={{
                    background:
                      "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
                  }}
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

  useEffect(() => {
    const detect = async () => {
      if (user?.blockchainWallet?.isLinked && user?.blockchainWallet?.address) {
        setWalletAddress(user.blockchainWallet.address);
        setWalletConnected(true);
      }
      if (!isMetaMaskInstalled()) {
        setMetamaskDetected(false);
        return;
      }
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
      const address = await connectMetaMask();
      setWalletAddress(address);
      setWalletConnected(true);
      await axios.post(
        `${BASE_URL}/api/auth/link-wallet`,
        { walletAddress: address },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (err) {
      setConnectError(
        err.message || "Failed to connect MetaMask. Please try again.",
      );
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
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data.success) {
        confetti({
          particleCount: 150,
          spread: 80,
          colors: ["#7c3aed", "#10b981"],
        });
        alert("Manuscript registered on Blockchain successfully!");
        await fetchBooks();
      }
    } catch (err) {
      alert("Error registering on blockchain.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedBookId) return alert("Select a book to verify!");
    const book = books.find((b) => (b._id || b.id) === selectedBookId);
    if (!book) return;
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/blockchain/verify/${selectedBookId}`,
        { currentContent: book.content },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setVerifyResult(data);
    } catch (err) {
      alert("Error verifying book integrity.");
    } finally {
      setIsVerifying(false);
    }
  };

  const verifiedBooks = books.filter((b) => b.blockchainHash);
  const selectedBook = books.find((b) => (b._id || b.id) === selectedBookId);

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Blockchain Ledger Registry</h1>
          <p>
            Register ownership signatures and protect your copyrights on the
            ledger.
          </p>
        </div>
      </div>

      {/* Web3 Wallet Integration Banner */}
      <div
        className="glass-panel"
        style={{
          padding: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "rgba(124, 58, 237, 0.1)",
              color: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Web3 Ledger Integration
            </h3>
            {walletConnected ? (
              <p
                style={{
                  fontSize: 13,
                  color: "#059669",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                  marginTop: 4,
                }}
              >
                <CheckCircle size={14} /> Connected: {walletAddress.slice(0, 8)}
                ...{walletAddress.slice(-6)}
              </p>
            ) : (
              <p
                style={{
                  fontSize: 13,
                  color: "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontWeight: 500,
                  marginTop: 4,
                }}
              >
                <AlertCircle size={14} /> Connect Ethereum Wallet (MetaMask) to
                verify signatures.
              </p>
            )}
          </div>
        </div>

        {!walletConnected &&
          (!metamaskDetected ? (
            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{
                background: "#f6851b",
                textDecoration: "none",
                padding: "10px 20px",
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
                  ? "#94a3b8"
                  : "linear-gradient(135deg, #f6851b 0%, #e2761b 100%)",
                padding: "10px 20px",
              }}
            >
              {connecting ? "Opening MetaMask..." : "🦊 Connect MetaMask"}
            </button>
          ))}
      </div>

      {connectError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} /> {connectError}
        </div>
      )}

      <div className="dash-grid" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        {/* Lock/Verify Panel */}
        <div className="dash-panel">
          <div className="panel-header">
            <h3>Lock / Verify Manuscript</h3>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              marginTop: 8,
            }}
          >
            <div>
              <label className="form-label">Select Manuscript</label>
              <select
                className="input-field"
                value={selectedBookId}
                onChange={(e) => setSelectedBookId(e.target.value)}
              >
                {books.map((b) => (
                  <option key={b._id || b.id} value={b._id || b.id}>
                    {b.title} {b.blockchainHash ? " (Secured)" : " (Unsecured)"}
                  </option>
                ))}
              </select>
            </div>

            {selectedBook?.blockchainHash ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.05)",
                    border: "1px solid rgba(16, 185, 129, 0.15)",
                    borderRadius: 10,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#059669",
                      fontWeight: 700,
                      fontSize: 13,
                      marginBottom: 6,
                    }}
                  >
                    <Shield size={16} /> Securely Locked on Ledger
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#64748b",
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    Hash: {selectedBook.blockchainHash}
                  </div>
                </div>

                <button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="btn-secondary"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    padding: "10px",
                  }}
                >
                  {isVerifying
                    ? "Verifying Integrity..."
                    : "Verify Content Integrity"}
                </button>
              </div>
            ) : (
              <button
                onClick={handleRegister}
                disabled={isRegistering || !walletConnected}
                className="btn-primary"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  padding: "10px",
                }}
              >
                {isRegistering
                  ? "Securing Ledger..."
                  : "Register Copyright Signature"}
              </button>
            )}

            {verifyResult && (
              <div
                style={{
                  background: verifyResult.isValid
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(239, 68, 68, 0.08)",
                  border: `1px solid ${
                    verifyResult.isValid ? "#10b981" : "#ef4444"
                  }`,
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <span
                  style={{
                    color: verifyResult.isValid ? "#10b981" : "#ef4444",
                    fontWeight: 700,
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {verifyResult.isValid ? (
                    <CheckCircle size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                  {verifyResult.isValid
                    ? "INTEGRITY VERIFIED"
                    : "HASH MISMATCH"}
                </span>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {verifyResult.message}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Secured Works List */}
        <div className="dash-panel">
          <div className="panel-header">
            <h3>Secured Works ({verifiedBooks.length})</h3>
          </div>

          {verifiedBooks.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              <Lock size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
              <p>No secured blockchain registries found.</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 8,
              }}
            >
              {verifiedBooks.map((b) => (
                <div
                  key={b._id || b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "#f8fafc",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: "rgba(124, 58, 237, 0.1)",
                      color: "#7c3aed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Lock size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#0f172a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {b.title}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 10,
                        color: "#64748b",
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
                      {b.blockchainHash.slice(0, 12)}...
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 4,
                    }}
                  >
                    <CheckCircle size={14} color="#10b981" />
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>
                      {new Date(b.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR ANALYTICS ────────────────────────────────────────────────────────
export const AuthorAnalytics = ({ books, user }) => {
  const totalReads = books.reduce((s, b) => s + (b.totalReads || 0), 0);
  const totalEarnings = user?.earnings || 0;
  const totalWords = books.reduce(
    (s, b) =>
      s + (b.content ? b.content.split(/\s+/).filter(Boolean).length : 0),
    0,
  );

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>Analytics Dashboard</h1>
          <p>Examine reader engagement and royalty yields.</p>
        </div>
      </div>

      <div className="stats-row">
        <StatCard
          icon={<Eye size={20} />}
          label="Total Reads"
          value={fmt(totalReads)}
          color="#0ea5e9"
        />
        <StatCard
          icon={<TrendingUp size={20} />}
          label="Est. Earnings (USD)"
          value={`$${totalEarnings.toFixed(2)}`}
          color="#059669"
        />
        <StatCard
          icon={<FileText size={20} />}
          label="Total Word Count"
          value={fmt(totalWords)}
          color="#7c3aed"
        />
        <StatCard
          icon={<Star size={20} />}
          label="Books Scanned"
          value={books.filter((b) => b.qualityScore).length}
          color="#f59e0b"
        />
      </div>

      <div className="dash-grid" style={{ marginTop: 24 }}>
        <div className="dash-panel">
          <div className="panel-header">
            <h3>Readership Breakdown by Manuscript</h3>
          </div>
          {books.length === 0 ? (
            <p className="empty-text">No books to display metrics.</p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: "10px 0",
              }}
            >
              {books.map((b) => {
                const maxReads = Math.max(
                  ...books.map((x) => x.totalReads || 0),
                  1,
                );
                const percent = (
                  ((b.totalReads || 0) / maxReads) *
                  100
                ).toFixed(0);
                return (
                  <div key={b._id || b.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 13,
                        marginBottom: 4,
                      }}
                    >
                      <span>{b.title}</span>
                      <strong>{fmt(b.totalReads || 0)} reads</strong>
                    </div>
                    <div
                      style={{
                        height: 8,
                        background: "rgba(255,255,255,0.05)",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${percent}%`,
                          height: "100%",
                          background:
                            "linear-gradient(90deg, #7c3aed, #0ea5e9)",
                          borderRadius: 4,
                        }}
                      />
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
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              height: 180,
              gap: 16,
              paddingBottom: 10,
              borderBottom: "1px solid rgba(0,0,0,0.1)",
            }}
          >
            {[
              { m: "Dec", h: 25 },
              { m: "Jan", h: 40 },
              { m: "Feb", h: 55 },
              { m: "Mar", h: 45 },
              { m: "Apr", h: 70 },
              { m: "May", h: 90 },
            ].map((trend, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${trend.h}%`,
                    background:
                      idx === 5 ? "#7c3aed" : "rgba(124, 58, 237, 0.4)",
                    borderRadius: "4px 4px 0 0",
                  }}
                />
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  {trend.m}
                </span>
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
    if (!inputText.trim())
      return alert("Please write or paste some text first!");
    setLoading(true);
    setResult("");
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/ai/assist`,
        { text: inputText, promptType },
        { headers: { Authorization: `Bearer ${token}` } },
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result.replace(/^\[.*\]:\n/, ""));
    alert("AI suggestions copied to clipboard!");
  };

  return (
    <div className="dash-content animate-fade-in">
      <div className="dash-welcome">
        <div>
          <h1>AI Creative Laboratory</h1>
          <p>
            Generate summaries, translate styles, refine story drafts, and
            simplify complex prose.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Playground panel */}
        <div
          className="glass-panel"
          style={{
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              borderBottom: "1px solid #f1f5f9",
              paddingBottom: 12,
            }}
          >
            <div
              style={{
                background: "rgba(124, 58, 237, 0.1)",
                color: "#7c3aed",
                padding: 6,
                borderRadius: 8,
              }}
            >
              <PenTool size={18} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              AI Writing Playground
            </h3>
          </div>

          <div>
            <label className="form-label">Select Transformation Rule</label>
            <select
              className="input-field"
              value={promptType}
              onChange={(e) => setPromptType(e.target.value)}
            >
              <option value="improve">
                Refine Flow & Tone (Polishes vocabulary and expressions)
              </option>
              <option value="simplify">
                Simplify Vocabulary (Improves readability rating)
              </option>
              <option value="formal">
                Classical Literary Tone (Elevates prose density)
              </option>
              <option value="summarize">
                Create Synopsis Summary (Builds abstract blurb)
              </option>
            </select>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <label className="form-label">Draft / Input Content</label>
            <textarea
              className="input-field"
              placeholder="Paste your paragraph or story chapter here..."
              style={{
                flex: 1,
                minHeight: 280,
                resize: "none",
                lineHeight: 1.6,
              }}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
          </div>

          <button
            onClick={handleRunAI}
            disabled={loading || !inputText.trim()}
            className="btn-primary"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: 14,
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
            }}
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin" size={16} /> Processing...
              </>
            ) : (
              <>
                <Sparkles size={16} /> Generate AI Suggestions
              </>
            )}
          </button>
        </div>

        {/* Outputs & Presets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Output card */}
          <div
            className="glass-panel"
            style={{
              padding: 24,
              minHeight: 300,
              display: "flex",
              flexDirection: "column",
              border: "1px solid rgba(124, 58, 237, 0.2)",
              boxShadow: "0 8px 24px rgba(124, 58, 237, 0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#7c3aed",
                  fontSize: 16,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                <Sparkles size={18} /> AI Output
              </h3>
              {result && (
                <button
                  onClick={copyToClipboard}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#7c3aed",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <FileText size={14} /> Copy Text
                </button>
              )}
            </div>

            {loading ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#7c3aed",
                }}
              >
                <RefreshCw
                  className="animate-spin"
                  size={32}
                  style={{ marginBottom: 12 }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  AI is analyzing your draft...
                </span>
              </div>
            ) : result ? (
              <div
                style={{
                  flex: 1,
                  padding: 16,
                  background: "#faf8ff",
                  border: "1px solid #e9e3ff",
                  borderRadius: 10,
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: "#1e293b",
                  overflowY: "auto",
                  maxHeight: 400,
                }}
              >
                {result.replace(/^\[.*\]:\n/, "")}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#94a3b8",
                  textAlign: "center",
                  padding: 20,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#f1f5f9",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 12,
                  }}
                >
                  <Sparkles size={24} style={{ opacity: 0.5 }} />
                </div>
                <h4
                  style={{
                    fontSize: 14,
                    color: "#475569",
                    margin: "0 0 4px 0",
                  }}
                >
                  Ready to generate
                </h4>
                <p style={{ fontSize: 12, margin: 0, maxWidth: 200 }}>
                  Write draft content and click generate to observe AI
                  suggestions here.
                </p>
              </div>
            )}
          </div>

          {/* Quick presets */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#0f172a",
                marginBottom: 12,
              }}
            >
              Creative Inspiration Presets
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() =>
                  handleTemplate(
                    "She was very sad when she had to leave the house because it was a bad day.",
                    "improve",
                  )
                }
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: 12,
                  color: "#475569",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#c4b5fd";
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <strong
                  style={{
                    color: "#7c3aed",
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                >
                  Improve Vocabulary
                </strong>
                <span>
                  "She was very sad when she had to leave the house..."
                </span>
              </button>

              <button
                onClick={() =>
                  handleTemplate(
                    "I need to utilize additional methods to terminate the comprehensive process.",
                    "simplify",
                  )
                }
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: 12,
                  color: "#475569",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#c4b5fd";
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <strong
                  style={{
                    color: "#7c3aed",
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                >
                  Simplify Prose
                </strong>
                <span>
                  "I need to utilize additional methods to terminate..."
                </span>
              </button>

              <button
                onClick={() =>
                  handleTemplate(
                    "The system works on decentralised consensus to guarantee database records aren't modified.",
                    "formal",
                  )
                }
                style={{
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#ffffff",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontSize: 12,
                  color: "#475569",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#c4b5fd";
                  e.currentTarget.style.background = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#e2e8f0";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <strong
                  style={{
                    color: "#7c3aed",
                    fontSize: 11,
                    textTransform: "uppercase",
                  }}
                >
                  Classical Literary
                </strong>
                <span>"The system works on decentralised consensus..."</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── AUTHOR SETTINGS ─────────────────────────────────────────────────────────
export const AuthorSettings = ({ user, token }) => {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [interests, setInterests] = useState(user?.interests || []);
  const [loading, setLoading] = useState(false);

  const availableInterests = [
    "fiction",
    "non-fiction",
    "science",
    "technology",
    "poetry",
    "drama",
    "history",
    "biography",
  ];

  const handleToggleInterest = (genre) => {
    if (interests.includes(genre)) {
      setInterests(interests.filter((i) => i !== genre));
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
          <p>
            Update your public display identity, author biography details, and
            genre interests.
          </p>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 32, maxWidth: 640 }}>
        <form
          onSubmit={handleSaveSettings}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          <div>
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Literary Genre Interests</label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 8,
              }}
            >
              {availableInterests.map((genre) => {
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
                      borderColor: active ? "#7c3aed" : "#e2e8f0",
                      background: active ? "rgba(124, 58, 237, 0.08)" : "#fff",
                      color: active ? "#7c3aed" : "#64748b",
                      fontWeight: 600,
                      cursor: "pointer",
                      textTransform: "capitalize",
                      transition: "all 0.15s",
                    }}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid #f1f5f9",
              paddingTop: 20,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Saving settings..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
