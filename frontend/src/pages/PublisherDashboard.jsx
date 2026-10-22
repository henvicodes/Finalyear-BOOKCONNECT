import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  BookOpen,
  Eye,
  ChevronRight,
  Sparkles,
  EyeOff,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Shield,
  Users,
  DollarSign,
  MessageCircle,
  Settings,
  FileText,
  Send,
  RefreshCw,
  BarChart2,
  Award,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
} from "lucide-react";
import ChatInterface from "../components/ChatInterface";
import WalletPinModal from "../components/WalletPinModal";
import SearchBar from "../components/SearchBar"; // Unified Search Bar
import { useAuth } from "../context/AuthContext";
import "../styles/Dashboard.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Format helper
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + "K" : String(n || 0));

// Stat Card
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

const PublisherDashboard = ({ user, token, onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);

  // Verification Proof
  const [verifying, setVerifying] = useState(false);
  const [proofDoc, setProofDoc] = useState(
    user?.publisherVerification?.documentLink || "",
  );
  const [isVerified, setIsVerified] = useState(
    user?.publisherVerification?.isVerified || false,
  );
  const [verifyHash, setVerifyHash] = useState(
    user?.publisherVerification?.blockchainHash || "",
  );
  const [showBalance, setShowBalance] = useState(false);
  const [balancePinOpen, setBalancePinOpen] = useState(false);

  // Authors search
  const [authors, setAuthors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  // Proposal Cost
  const [pricingCost, setPricingCost] = useState("");
  const [submittingCost, setSubmittingCost] = useState(false);

  // AI Review Scan
  const [evaluatingSub, setEvaluatingSub] = useState(false);
  const [aiReport, setAiReport] = useState(null);

  useEffect(() => {
    fetchSubmissions();
    fetchAuthors();
  }, []);

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const { data } = await axios.get(
        `${BASE_URL}/api/books?limit=100&status=under_review`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const res = await axios.get(
        `${BASE_URL}/api/books?limit=100&status=seen`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const resProp = await axios.get(
        `${BASE_URL}/api/books?limit=100&status=cost_proposed`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const resPub = await axios.get(
        `${BASE_URL}/api/books?limit=100&status=published`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const allSubs = [
        ...(data.data || []),
        ...(res.data?.data || []),
        ...(resProp.data?.data || []),
        ...(resPub.data?.data || []),
      ].filter(
        (b) => b.publisher?._id === user?._id || b.publisher === user?._id,
      );

      setSubmissions(allSubs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const fetchAuthors = async (q = "") => {
    setLoadingAuthors(true);
    try {
      const { data } = await axios.get(
        `${BASE_URL}/api/auth/search?q=${q || "@"}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        setAuthors(data.data.filter((u) => u.role === "author"));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAuthors(false);
    }
  };

  const handleSearchAuthors = (e) => {
    e.preventDefault();
    fetchAuthors(searchQuery);
  };

  const handleVerifyPublisher = async (e) => {
    e.preventDefault();
    if (!proofDoc.trim())
      return alert("Please specify a document URL (e.g. Google Doc link)");
    setVerifying(true);
    try {
      const mockHash =
        "0x" +
        Array.from({ length: 40 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join("");
      const { data } = await axios.put(
        `${BASE_URL}/api/auth/profile`,
        {
          publisherVerification: {
            isVerified: true,
            documentLink: proofDoc,
            blockchainHash: mockHash,
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        setIsVerified(true);
        setVerifyHash(mockHash);
        alert(
          "Publisher credibility successfully locked on Blockchain Ledger!",
        );
      }
    } catch (err) {
      alert("Error uploading verification proof.");
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenSubmission = async (sub) => {
    setSelectedSub(sub);
    setAiReport(null);
    if (sub.status === "under_review") {
      try {
        await axios.post(
          `${BASE_URL}/api/manuscripts/${sub._id}/mark-seen`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        fetchSubmissions();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAIScan = async (subId) => {
    setEvaluatingSub(true);
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/ai/evaluate/${subId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        setAiReport(data);
        fetchSubmissions();
      }
    } catch (err) {
      alert("Error evaluating manuscript.");
    } finally {
      setEvaluatingSub(false);
    }
  };

  const handleProposeCost = async (e) => {
    e.preventDefault();
    if (!pricingCost || !selectedSub) return;
    setSubmittingCost(true);
    try {
      const { data } = await axios.post(
        `${BASE_URL}/api/manuscripts/${selectedSub._id}/propose-cost`,
        {
          cost: parseFloat(pricingCost),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (data.success) {
        alert(`Proposed cost of $${pricingCost} sent to author successfully!`);
        setPricingCost("");
        setSelectedSub(null);
        fetchSubmissions();
      }
    } catch (err) {
      alert("Error submitting proposal cost.");
    } finally {
      setSubmittingCost(false);
    }
  };

  const reviewCount = submissions.filter((s) => s.status === "under_review")
    .length;
  const publishedBooks = submissions.filter((s) => s.status === "published");

  const navLinks = [
    { id: "overview", icon: <BarChart2 size={18} />, label: "Overview" },
    {
      id: "verification",
      icon: <Shield size={18} />,
      label: "Web3 Trust Proof",
    },
    {
      id: "submissions",
      icon: <FileText size={18} />,
      label: "Submissions",
      badge: reviewCount,
    },
    {
      id: "published",
      icon: <BookOpen size={18} />,
      label: `Published (${publishedBooks.length})`,
    },
    { id: "authors", icon: <Users size={18} />, label: "Authors Directory" },
    {
      id: "messages",
      icon: <MessageCircle size={18} />,
      label: "Negotiations",
    },
  ];

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar Overlay */}
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
          <div className="sidebar-avatar" style={{ background: "#0369a1" }}>
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
              style={{ background: "rgba(3, 105, 161, 0.1)", color: "#0369a1" }}
            >
              Publisher
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Workspace</div>
          {navLinks.map((link, i) => (
            <React.Fragment key={link.id}>
              {i === 4 && (
                <div
                  className="sidebar-section-label"
                  style={{ marginTop: 16 }}
                >
                  Management
                </div>
              )}
              <button
                className={`sidebar-link ${
                  activeTab === link.id ? "active" : ""
                }`}
                onClick={() => {
                  setActiveTab(link.id);
                  setSidebarOpen(false);
                }}
                style={activeTab === link.id ? { color: "#0369a1" } : {}}
              >
                {link.icon}
                <span>{link.label}</span>
                {link.badge > 0 && (
                  <span
                    style={{
                      background: "#f59e0b",
                      color: "#fff",
                      padding: "1px 6px",
                      borderRadius: 10,
                      fontSize: 10,
                      marginLeft: "auto",
                    }}
                  >
                    {link.badge}
                  </span>
                )}
                {activeTab === link.id && !link.badge && (
                  <ChevronRight size={14} className="link-arrow" />
                )}
              </button>
            </React.Fragment>
          ))}
        </nav>

        {/* Wallet Balance */}
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
                color: "#0369a1",
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
            <DollarSign size={16} color="#0369a1" />
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                color: isVerified ? "#10b981" : "#f59e0b",
                fontSize: 12,
                fontWeight: 600,
                background: isVerified
                  ? "rgba(16,185,129,0.1)"
                  : "rgba(245,158,11,0.1)",
                padding: "6px 12px",
                borderRadius: 20,
              }}
            >
              {isVerified ? <Shield size={14} /> : <AlertCircle size={14} />}
              <span className="hide-mobile">
                {isVerified ? "Trust Verified" : "Web3 Link Pending"}
              </span>
            </div>
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
                  <h1>Publisher Dashboard 👋</h1>
                  <p>
                    Securely negotiate royalties, verify identities on the
                    ledger, and publish manuscripts.
                  </p>
                </div>
              </div>

              <div className="stats-row">
                <StatCard
                  icon={<BookOpen size={20} />}
                  label="Published Books"
                  value={publishedBooks.length}
                  color="#0369a1"
                />
                <StatCard
                  icon={<Clock size={20} />}
                  label="Pending Review"
                  value={reviewCount}
                  color="#f59e0b"
                />
                <StatCard
                  icon={<DollarSign size={20} />}
                  label="Earned Revenue"
                  value={`$${(user?.earnings || 0).toFixed(2)}`}
                  color="#059669"
                />
                <StatCard
                  icon={<Shield size={20} />}
                  label="Credibility Status"
                  value={isVerified ? "Verified" : "Unverified"}
                  color={isVerified ? "#10b981" : "#f59e0b"}
                />
              </div>

              <div className="dash-grid">
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Recent Submissions</h3>
                    <button
                      className="panel-link"
                      onClick={() => setActiveTab("submissions")}
                    >
                      View all
                    </button>
                  </div>
                  {submissions.length === 0 ? (
                    <p
                      style={{
                        fontSize: 13,
                        color: "#94a3b8",
                        padding: "10px 0",
                      }}
                    >
                      No submissions received yet.
                    </p>
                  ) : (
                    submissions.slice(0, 4).map((s, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "12px 0",
                          borderBottom: "1px solid #f1f5f9",
                        }}
                      >
                        <div>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              display: "block",
                              color: "#0f172a",
                            }}
                          >
                            {s.title}
                          </span>
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            by {s.author?.name || "Unknown"}
                          </span>
                        </div>
                        <span
                          className={`book-status ${
                            s.status === "published"
                              ? "published"
                              : s.status === "under_review"
                              ? "review"
                              : "new"
                          }`}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Ledger Activity Log</h3>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    {isVerified && (
                      <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                        <Shield size={16} color="#10b981" />
                        <div>
                          <strong
                            style={{ display: "block", color: "#0f172a" }}
                          >
                            Publisher trust verified
                          </strong>
                          <span
                            style={{
                              fontSize: 11,
                              color: "#94a3b8",
                              fontFamily: "monospace",
                            }}
                          >
                            {verifyHash.slice(0, 20)}...
                          </span>
                        </div>
                      </div>
                    )}
                    {publishedBooks.slice(0, 2).map((b, idx) => (
                      <div
                        key={idx}
                        style={{ display: "flex", gap: 12, fontSize: 13 }}
                      >
                        <CheckCircle size={16} color="#10b981" />
                        <div>
                          <strong
                            style={{ display: "block", color: "#0f172a" }}
                          >
                            "{b.title}" published
                          </strong>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>
                            Payout completed to author
                          </span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
                      <Clock size={16} color="#f59e0b" />
                      <div>
                        <strong style={{ display: "block", color: "#0f172a" }}>
                          Monitoring system active
                        </strong>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>
                          Ready for proposals cost setting
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VERIFICATION TAB */}
          {activeTab === "verification" && (
            <div
              className="dash-content animate-fade-in"
              style={{ maxWidth: 640 }}
            >
              <div className="dash-welcome">
                <div>
                  <h1>Publisher Trust Verification</h1>
                  <p>
                    Verify your identity by locking accreditation credentials on
                    the blockchain.
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 32 }}>
                {isVerified ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <Award
                      size={48}
                      color="#10b981"
                      style={{ marginBottom: 12 }}
                    />
                    <h3
                      style={{
                        color: "#10b981",
                        fontSize: 20,
                        marginBottom: 8,
                      }}
                    >
                      Web3 Credibility Verified
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: "#64748b",
                        marginBottom: 24,
                      }}
                    >
                      Your proof doc has been hashed and immutable locked on the
                      blockchain.
                    </p>
                    <div
                      style={{
                        padding: 16,
                        background: "#f8fafc",
                        borderRadius: 10,
                        border: "1px solid #e2e8f0",
                        fontFamily: "monospace",
                        fontSize: 12,
                        textAlign: "left",
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <strong style={{ color: "#0f172a" }}>
                          Accreditation Doc:
                        </strong>{" "}
                        <br />{" "}
                        <span style={{ color: "#0369a1" }}>{proofDoc}</span>
                      </div>
                      <div>
                        <strong style={{ color: "#0f172a" }}>
                          Ledger Hash:
                        </strong>{" "}
                        <br />{" "}
                        <span style={{ color: "#64748b" }}>{verifyHash}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={handleVerifyPublisher}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 20,
                    }}
                  >
                    <div>
                      <label className="form-label">
                        Verification Document URL
                      </label>
                      <input
                        type="url"
                        className="input-field"
                        required
                        placeholder="https://docs.google.com/document/d/..."
                        value={proofDoc}
                        onChange={(e) => setProofDoc(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={verifying}
                      className="btn-primary"
                      style={{
                        justifyContent: "center",
                        background: "#0369a1",
                      }}
                    >
                      {verifying
                        ? "Signing Ledger..."
                        : "Register Verification Proof on Blockchain"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* SUBMISSIONS TAB */}
          {activeTab === "submissions" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Manuscript Submissions</h1>
                  <p>
                    Open manuscript drafts, evaluate quality metrics, and
                    propose publishing cost fees.
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 2fr",
                  gap: 24,
                }}
              >
                {/* List pane */}
                <div
                  className="glass-panel"
                  style={{ padding: 0, overflow: "hidden" }}
                >
                  <div
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #e2e8f0",
                      fontWeight: 700,
                      fontSize: 14,
                      background: "#fafafa",
                    }}
                  >
                    Incoming Drafts ({submissions.length})
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      maxHeight: "60vh",
                      overflowY: "auto",
                    }}
                  >
                    {submissions.length === 0 ? (
                      <p
                        style={{
                          padding: 20,
                          fontSize: 13,
                          color: "#94a3b8",
                          textAlign: "center",
                        }}
                      >
                        No manuscripts submitted yet.
                      </p>
                    ) : (
                      submissions.map((sub) => (
                        <div
                          key={sub._id}
                          onClick={() => handleOpenSubmission(sub)}
                          style={{
                            padding: "16px 20px",
                            borderBottom: "1px solid #f1f5f9",
                            cursor: "pointer",
                            background:
                              selectedSub?._id === sub._id
                                ? "#f3f0ff"
                                : "transparent",
                            borderLeft:
                              selectedSub?._id === sub._id
                                ? "3px solid #0369a1"
                                : "3px solid transparent",
                            transition: "all 0.2s",
                          }}
                        >
                          <span
                            style={{
                              display: "block",
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#0f172a",
                              marginBottom: 4,
                            }}
                          >
                            {sub.title}
                          </span>
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              color: "#64748b",
                              textTransform: "capitalize",
                              marginBottom: 8,
                            }}
                          >
                            {sub.genre} · by {sub.author?.name || "Unknown"}
                          </span>
                          <span
                            className={`book-status ${
                              sub.status === "published"
                                ? "published"
                                : sub.status === "under_review"
                                ? "review"
                                : "new"
                            }`}
                          >
                            {sub.status.replace("_", " ")}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Sub reader pane */}
                <div className="glass-panel" style={{ padding: 24 }}>
                  {selectedSub ? (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          borderBottom: "1px solid #e2e8f0",
                          paddingBottom: 16,
                          marginBottom: 20,
                        }}
                      >
                        <div>
                          <h2
                            style={{
                              fontSize: 20,
                              fontWeight: 700,
                              color: "#0f172a",
                              marginBottom: 4,
                            }}
                          >
                            {selectedSub.title}
                          </h2>
                          <span style={{ fontSize: 13, color: "#64748b" }}>
                            Submitted by:{" "}
                            <strong style={{ color: "#0f172a" }}>
                              {selectedSub.author?.name}
                            </strong>
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            background: "#f1f5f9",
                            padding: "4px 10px",
                            borderRadius: 20,
                          }}
                        >
                          Status:{" "}
                          <strong
                            style={{
                              color: "#0369a1",
                              textTransform: "capitalize",
                            }}
                          >
                            {selectedSub.status.replace("_", " ")}
                          </strong>
                        </span>
                      </div>

                      {/* AI scan box */}
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: 20,
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          marginBottom: 20,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 12,
                          }}
                        >
                          <h4
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              fontSize: 14,
                              color: "#0369a1",
                              margin: 0,
                            }}
                          >
                            <Sparkles size={16} /> AI Quality Assessment
                          </h4>
                          <button
                            onClick={() => handleAIScan(selectedSub._id)}
                            disabled={evaluatingSub}
                            className="btn-primary"
                            style={{
                              padding: "6px 14px",
                              fontSize: 11,
                              background: "#0369a1",
                            }}
                          >
                            {evaluatingSub ? (
                              <RefreshCw className="animate-spin" size={12} />
                            ) : (
                              <BarChart2 size={12} />
                            )}{" "}
                            Run Scan
                          </button>
                        </div>

                        {(aiReport || selectedSub.qualityScore) && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr",
                              gap: 12,
                            }}
                          >
                            <div
                              style={{
                                background: "#fff",
                                padding: 12,
                                borderRadius: 8,
                                textAlign: "center",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#64748b",
                                  textTransform: "uppercase",
                                  fontWeight: 700,
                                }}
                              >
                                Quality
                              </span>
                              <div
                                style={{
                                  fontSize: 18,
                                  fontWeight: 800,
                                  color: "#7c3aed",
                                  marginTop: 4,
                                }}
                              >
                                {aiReport?.qualityScore ||
                                  selectedSub.qualityScore}
                                %
                              </div>
                            </div>
                            <div
                              style={{
                                background: "#fff",
                                padding: 12,
                                borderRadius: 8,
                                textAlign: "center",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#64748b",
                                  textTransform: "uppercase",
                                  fontWeight: 700,
                                }}
                              >
                                Readability
                              </span>
                              <div
                                style={{
                                  fontSize: 18,
                                  fontWeight: 800,
                                  color: "#0ea5e9",
                                  marginTop: 4,
                                }}
                              >
                                {aiReport?.readabilityScore ||
                                  selectedSub.readabilityScore}
                              </div>
                            </div>
                            <div
                              style={{
                                background: "#fff",
                                padding: 12,
                                borderRadius: 8,
                                textAlign: "center",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  color: "#64748b",
                                  textTransform: "uppercase",
                                  fontWeight: 700,
                                }}
                              >
                                Plagiarism
                              </span>
                              <div
                                style={{
                                  fontSize: 18,
                                  fontWeight: 800,
                                  color:
                                    (aiReport?.plagiarismScore ||
                                      selectedSub.plagiarismScore) > 15
                                      ? "#ef4444"
                                      : "#10b981",
                                  marginTop: 4,
                                }}
                              >
                                {aiReport?.plagiarismScore ||
                                  selectedSub.plagiarismScore}
                                %
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Content block */}
                      <div
                        style={{
                          maxHeight: 250,
                          overflowY: "auto",
                          padding: 16,
                          background: "#f8fafc",
                          borderRadius: 12,
                          border: "1px solid #e2e8f0",
                          fontSize: 14,
                          lineHeight: 1.7,
                          color: "#334155",
                          marginBottom: 24,
                        }}
                      >
                        {selectedSub.content}
                      </div>

                      {/* Pricing proposal cost action */}
                      {selectedSub.status !== "published" ? (
                        <div
                          style={{
                            borderTop: "1px solid #e2e8f0",
                            paddingTop: 20,
                          }}
                        >
                          <form
                            onSubmit={handleProposeCost}
                            style={{
                              display: "flex",
                              gap: 12,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                color: "#0f172a",
                              }}
                            >
                              Set Publishing Cost Fee ($):
                            </span>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 499"
                              value={pricingCost}
                              onChange={(e) => setPricingCost(e.target.value)}
                              className="input-field"
                              style={{ width: 140 }}
                            />
                            <button
                              type="submit"
                              disabled={submittingCost}
                              className="btn-primary"
                              style={{ background: "#0369a1" }}
                            >
                              {submittingCost
                                ? "Sending..."
                                : "Submit Cost Proposal"}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div
                          style={{
                            color: "#10b981",
                            fontWeight: 600,
                            fontSize: 14,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: "rgba(16,185,129,0.1)",
                            padding: "12px 16px",
                            borderRadius: 8,
                          }}
                        >
                          <CheckCircle size={18} /> Fully Published & Paid ($
                          {selectedSub.publishingCost} fee received)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        minHeight: 300,
                        color: "#94a3b8",
                      }}
                    >
                      <FileText
                        size={48}
                        style={{ opacity: 0.3, marginBottom: 16 }}
                      />
                      <p style={{ fontSize: 14 }}>
                        Select a manuscript from the list to review details.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PUBLISHED BOOKS TAB */}
          {activeTab === "published" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Published Catalog</h1>
                  <p>
                    Manuscripts published on the platform database under your
                    imprint.
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                {publishedBooks.length === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#94a3b8",
                      textAlign: "center",
                      padding: 20,
                    }}
                  >
                    No published books yet.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {publishedBooks.map((b) => (
                      <div
                        key={b._id}
                        style={{
                          display: "flex",
                          gap: 16,
                          padding: 16,
                          background: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 64,
                            background: "#f3f0ff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#7c3aed",
                            borderRadius: 6,
                            flexShrink: 0,
                          }}
                        >
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              display: "block",
                              color: "#0f172a",
                              marginBottom: 2,
                            }}
                          >
                            {b.title}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "#64748b",
                              display: "block",
                              marginBottom: 8,
                            }}
                          >
                            Author: {b.author?.name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#059669",
                              background: "rgba(5,150,105,0.1)",
                              padding: "2px 8px",
                              borderRadius: 4,
                            }}
                          >
                            Fee: ${b.publishingCost} (Paid)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AUTHORS DIRECTORY TAB */}
          {activeTab === "authors" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Authors Directory</h1>
                  <p>
                    Discover registered writers, browse profiles, and initiate
                    negotiations.
                  </p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                <form
                  onSubmit={handleSearchAuthors}
                  style={{ display: "flex", gap: 12, marginBottom: 24 }}
                >
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search by author name or interests..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ background: "#0369a1", padding: "0 24px" }}
                  >
                    Search
                  </button>
                </form>

                {loadingAuthors ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      padding: 40,
                    }}
                  >
                    <RefreshCw
                      className="animate-spin"
                      size={24}
                      color="#0369a1"
                    />
                  </div>
                ) : authors.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#94a3b8",
                      padding: 20,
                    }}
                  >
                    No authors found.
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {authors.map((a) => (
                      <div
                        key={a._id}
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
                            alignItems: "center",
                            gap: 16,
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              background: "#e2e8f0",
                              color: "#475569",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: 700,
                              fontSize: 16,
                            }}
                          >
                            {a.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span
                              style={{
                                display: "block",
                                fontSize: 14,
                                fontWeight: 700,
                                color: "#0f172a",
                              }}
                            >
                              {a.name}
                            </span>
                            <span
                              style={{
                                display: "block",
                                fontSize: 12,
                                color: "#64748b",
                                marginTop: 2,
                              }}
                            >
                              {a.bio || "No biography added."}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveTab("messages")}
                          className="btn-secondary"
                          style={{ borderColor: "#0369a1", color: "#0369a1" }}
                        >
                          <MessageCircle size={14} /> Chat
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NEGOTIATIONS TAB */}
          {activeTab === "messages" && (
            <div
              className="dash-content animate-fade-in"
              style={{ height: "calc(100vh - 120px)" }}
            >
              <ChatInterface
                user={user}
                currentRole="publisher"
                token={token}
              />
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};

export default PublisherDashboard;
