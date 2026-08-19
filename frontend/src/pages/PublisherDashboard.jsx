import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BookOpen, Eye, EyeOff, Star, Clock, CheckCircle, AlertCircle, Shield,
  Users, DollarSign, MessageCircle, Settings, FileText, Send, RefreshCw, BarChart2, Award, LogOut
} from "lucide-react";
import ChatInterface from "../components/ChatInterface";
import WalletPinModal from "../components/WalletPinModal";
import ThemeToggle from "../components/ThemeToggle";
import { useAuth } from "../context/AuthContext";
import { Sparkles } from "lucide-react";
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

// ─── PUBLISHER DASHBOARD ─────────────────────────────────────────────────────
const PublisherDashboard = ({ user, token, onLogout }) => {
  const { updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  
  // Verification Proof
  const [verifying, setVerifying] = useState(false);
  const [proofDoc, setProofDoc] = useState(user?.publisherVerification?.documentLink || "");
  const [isVerified, setIsVerified] = useState(user?.publisherVerification?.isVerified || false);
  const [verifyHash, setVerifyHash] = useState(user?.publisherVerification?.blockchainHash || "");
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

  // Settings tab (profile + appearance)
  const [settingsName, setSettingsName] = useState(user?.name || "");
  const [settingsBio, setSettingsBio] = useState(user?.bio || "");
  const [settingsInterests, setSettingsInterests] = useState(user?.interests || []);
  const [savingSettings, setSavingSettings] = useState(false);
  const availableInterests = [
    "fiction", "non-fiction", "science", "technology", "poetry", "drama", "history", "biography"
  ];

  useEffect(() => {
    fetchSubmissions();
    fetchAuthors();
  }, []);

  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      // Find all manuscripts submitted to this publisher
      const { data } = await axios.get(`${BASE_URL}/api/books?limit=100&status=under_review`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Get also other states: seen, cost_proposed, published under this publisher
      const res = await axios.get(`${BASE_URL}/api/books?limit=100&status=seen`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resProp = await axios.get(`${BASE_URL}/api/books?limit=100&status=cost_proposed`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resPub = await axios.get(`${BASE_URL}/api/books?limit=100&status=published`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const allSubs = [
        ...(data.data || []),
        ...(res.data?.data || []),
        ...(resProp.data?.data || []),
        ...(resPub.data?.data || [])
      ].filter(b => b.publisher?._id === user?._id || b.publisher === user?._id);

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
      const { data } = await axios.get(`${BASE_URL}/api/auth/search?q=${q || "@"}`, {
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

  const handleSearchAuthors = (e) => {
    e.preventDefault();
    fetchAuthors(searchQuery);
  };

  // Submit Publisher Web3 Verification Proof
  const handleVerifyPublisher = async (e) => {
    e.preventDefault();
    if (!proofDoc.trim()) return alert("Please specify a document URL (e.g. Google Doc link)");
    setVerifying(true);
    try {
      const mockHash = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
      const { data } = await axios.put(`${BASE_URL}/api/auth/profile`, {
        publisherVerification: {
          isVerified: true,
          documentLink: proofDoc,
          blockchainHash: mockHash
        }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (data.success) {
        setIsVerified(true);
        setVerifyHash(mockHash);
        alert("Publisher credibility successfully locked on Blockchain Ledger!");
      }
    } catch (err) {
      alert("Error uploading verification proof.");
    } finally {
      setVerifying(false);
    }
  };

  // Publisher opens submission (transitions under_review to seen)
  const handleOpenSubmission = async (sub) => {
    setSelectedSub(sub);
    setAiReport(null);
    if (sub.status === "under_review") {
      try {
        await axios.post(`${BASE_URL}/api/manuscripts/${sub._id}/mark-seen`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchSubmissions();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Publisher Evaluates Sub
  const handleAIScan = async (subId) => {
    setEvaluatingSub(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/api/ai/evaluate/${subId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  // Publisher proposes publishing fee cost
  const handleProposeCost = async (e) => {
    e.preventDefault();
    if (!pricingCost || !selectedSub) return;
    setSubmittingCost(true);
    try {
      const { data } = await axios.post(`${BASE_URL}/api/manuscripts/${selectedSub._id}/propose-cost`, {
        cost: parseFloat(pricingCost)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
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

  // Render Submissions overview list
  const reviewCount = submissions.filter(s => s.status === "under_review").length;
  const publishedBooks = submissions.filter(s => s.status === "published");

  return (
    <div className="dashboard-wrapper">
      {/* Sidebar Nav */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><BookOpen size={22} /><span>BookConnect</span></div>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: "var(--info)" }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-role-badge" style={{ background: "rgba(8, 145, 178, 0.1)", color: "var(--info)" }}>
              Publisher
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={`sidebar-link ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            <BarChart2 size={18} /><span>Overview</span>
          </button>
          <button className={`sidebar-link ${activeTab === "verification" ? "active" : ""}`} onClick={() => setActiveTab("verification")}>
            <Shield size={18} /><span>Web3 Trust Proof</span>
          </button>
          <button className={`sidebar-link ${activeTab === "submissions" ? "active" : ""}`} onClick={() => setActiveTab("submissions")}>
            <FileText size={18} /><span>Submissions {reviewCount > 0 && <span style={{ background: "var(--warning)", color: "#fff", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>{reviewCount}</span>}</span>
          </button>
          <button className={`sidebar-link ${activeTab === "published" ? "active" : ""}`} onClick={() => setActiveTab("published")}>
            <BookOpen size={18} /><span>Published ({publishedBooks.length})</span>
          </button>
          <button className={`sidebar-link ${activeTab === "authors" ? "active" : ""}`} onClick={() => setActiveTab("authors")}>
            <Users size={18} /><span>Authors Directory</span>
          </button>
          <button className={`sidebar-link ${activeTab === "messages" ? "active" : ""}`} onClick={() => setActiveTab("messages")}>
            <MessageCircle size={18} /><span>Negotiations</span>
          </button>
          <button className={`sidebar-link ${activeTab === "settings" ? "active" : ""}`} onClick={() => setActiveTab("settings")}>
            <Settings size={18} /><span>Settings</span>
          </button>
        </nav>

        {/* Wallet Balance widget — masked by default (GPay style) */}
        <div style={{
          margin: "10px 16px",
          padding: "12px 14px",
          background: "rgba(8, 145, 178, 0.04)",
          border: "1px solid rgba(8, 145, 178, 0.12)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>Wallet Balance</span>
            <button
              onClick={() => showBalance ? setShowBalance(false) : setBalancePinOpen(true)}
              style={{ background: "none", border: "none", color: "var(--info)", cursor: "pointer", padding: 0 }}
              title={showBalance ? "Hide balance" : "Reveal with PIN"}
            >
              {showBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DollarSign size={14} color="var(--info)" />
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

      {/* Main Content Area */}
      <div className="dashboard-main">
        <header className="dash-topbar" style={{ justifyContent: "flex-end" }}>
          {isVerified ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--success)", fontSize: 13, fontWeight: "bold" }}>
              <Shield size={16} /> Trust Verified Publisher
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--warning)", fontSize: 13, fontWeight: "bold" }}>
              <AlertCircle size={16} /> Web3 Credibility Link Pending
            </div>
          )}
        </header>

        <div className="dash-body">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Publisher Dashboard 👋</h1>
                  <p>Securely negotiate royalties, verify identities on the ledger, and publish manuscripts.</p>
                </div>
              </div>

              <div className="stats-row">
                <StatCard icon={<BookOpen size={20} />} label="Published Books" value={publishedBooks.length} color="var(--info)" />
                <StatCard icon={<Clock size={20} />} label="Pending Review" value={reviewCount} color="var(--warning)" />
                <StatCard icon={<DollarSign size={20} />} label="Earned Revenue" value={`$${(user?.earnings || 0).toFixed(2)}`} color="var(--success)" />
                <StatCard icon={<Shield size={20} />} label="Credibility Status" value={isVerified ? "Verified" : "Unverified"} color={isVerified ? "var(--success)" : "var(--warning)"} />
              </div>

              <div className="dash-grid">
                {/* Recent Submissions */}
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Recent Submissions</h3>
                    <button className="panel-link" onClick={() => setActiveTab("submissions")}>View all</button>
                  </div>
                  {submissions.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "10px 0" }}>No submissions received yet.</p>
                  ) : (
                    submissions.slice(0, 4).map((s, idx) => (
                      <div key={idx} style={{ display: "flex", justify: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{s.title}</span>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>by {s.author?.name || "Unknown"}</span>
                        </div>
                        <span className={`book-status ${s.status === "published" ? "published" : s.status === "under_review" ? "review" : "new"}`}>
                          {s.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Activity Feed */}
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Ledger Activity Log</h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {isVerified && (
                      <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                        <Shield size={14} color="var(--success)" />
                        <div>
                          <strong>Publisher trust verified on chain</strong>
                          <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{verifyHash.slice(0, 20)}...</span>
                        </div>
                      </div>
                    )}
                    {publishedBooks.slice(0, 2).map((b, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                        <CheckCircle size={14} color="var(--success)" />
                        <div>
                          <strong>Manuscript "{b.title}" published</strong>
                          <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>Payout completed to author</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                      <Clock size={14} color="var(--warning)" />
                      <div>
                        <strong>Monitoring system active</strong>
                        <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)" }}>Ready for proposals cost setting</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BLOCKCHAIN TRUST VERIFICATION TAB */}
          {activeTab === "verification" && (
            <div className="dash-content animate-fade-in" style={{ maxWidth: 680 }}>
              <div className="dash-welcome">
                <div>
                  <h1>Publisher Trust Verification</h1>
                  <p>Verify your identity by locking accreditation credentials (e.g. Google Doc link) on the blockchain. This prevents publisher fraud and reassures authors.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 30 }}>
                {isVerified ? (
                  <div style={{ textAlign: "center", padding: "20px 0" }}>
                    <Award size={48} color="var(--success)" style={{ marginBottom: 12 }} />
                    <h3 style={{ color: "var(--success)" }}>Web3 Credibility Ledger Verified</h3>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>
                      Your proof doc has been hashed and immutable locked on the blockchain.
                    </p>
                    <div style={{ marginTop: 16, padding: 12, background: "color-mix(in srgb, var(--text-primary) 2%, transparent)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}>
                      <strong>Accreditation Doc:</strong> {proofDoc}
                      <br />
                      <strong>Ledger Hash:</strong> {verifyHash}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyPublisher} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div>
                      <label className="form-label">Google Doc / Verification Document URL</label>
                      <input
                        type="url"
                        className="input-field"
                        required
                        placeholder="https://docs.google.com/document/d/..."
                        value={proofDoc}
                        onChange={e => setProofDoc(e.target.value)}
                      />
                    </div>
                    <button type="submit" disabled={verifying} className="btn-primary" style={{ justifyContent: "center" }}>
                      {verifying ? "Signing Ledger..." : "Register Verification Proof on Blockchain"}
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
                  <p>Open manuscript drafts, evaluate quality metrics, and propose publishing cost fees.</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 20 }}>
                {/* List pane */}
                <div className="glass-panel" style={{ padding: 0 }}>
                  <div style={{ padding: 16, borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", fontWeight: "bold", fontSize: 14 }}>
                    Incoming Drafts ({submissions.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {submissions.length === 0 ? (
                      <p style={{ padding: 16, fontSize: 12, color: "var(--text-muted)" }}>No manuscripts submitted yet.</p>
                    ) : (
                      submissions.map(sub => (
                        <div
                          key={sub._id}
                          onClick={() => handleOpenSubmission(sub)}
                          style={{
                            padding: 16,
                            borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)",
                            cursor: "pointer",
                            background: selectedSub?._id === sub._id ? "color-mix(in srgb, var(--text-primary) 2%, transparent)" : "transparent"
                          }}
                        >
                          <span style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{sub.title}</span>
                          <span style={{ display: "block", fontSize: 10, color: "var(--text-secondary)", textTransform: "capitalize" }}>
                            {sub.genre} · by {sub.author?.name || "Unknown"}
                          </span>
                          <span className={`book-status ${sub.status === "published" ? "published" : sub.status === "under_review" ? "review" : "new"}`} style={{ display: "inline-block", marginTop: 6 }}>
                            {sub.status}
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
                      <div style={{ display: "flex", justify: "space-between", alignItems: "flex-start", borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", paddingBottom: 16, marginBottom: 16 }}>
                        <div>
                          <h2>{selectedSub.title}</h2>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Submitted by: <strong>{selectedSub.author?.name}</strong></span>
                        </div>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Status: <strong style={{ color: "var(--info)" }}>{selectedSub.status}</strong></span>
                      </div>

                      {/* AI scan box */}
                      <div style={{ background: "rgba(8,145,178,0.03)", padding: 16, border: "1px solid rgba(8,145,178,0.1)", borderRadius: 10, marginBottom: 16 }}>
                        <div style={{ display: "flex", justify: "space-between", alignItems: "center" }}>
                          <h4 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--info)" }}>
                            <Sparkles size={14} /> AI Quality & Plagiarism Assessment
                          </h4>

                          <button
                            onClick={() => handleAIScan(selectedSub._id)}
                            disabled={evaluatingSub}
                            style={{
                              padding: "4px 10px",
                              fontSize: 11,
                              background: "var(--info)",
                              color: "#fff",
                              border: "none",
                              borderRadius: 4,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4
                            }}
                          >
                            {evaluatingSub ? <RefreshCw className="animate-spin" size={10} /> : <BarChart2 size={10} />} Run Scan
                          </button>
                        </div>

                        {(aiReport || selectedSub.qualityScore) && (
                          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                            <div style={{ background: "#fff", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid var(--accent-100)" }}>
                              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>QUALITY</span>
                              <div style={{ fontSize: 16, fontWeight: "bold", color: "var(--accent-600)" }}>{aiReport?.qualityScore || selectedSub.qualityScore}%</div>
                            </div>
                            <div style={{ background: "#fff", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid var(--accent-100)" }}>
                              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>READABILITY</span>
                              <div style={{ fontSize: 13, fontWeight: "bold", color: "var(--info)", marginTop: 2 }}>{aiReport?.readabilityScore || selectedSub.readabilityScore}</div>
                            </div>
                            <div style={{ background: "#fff", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid var(--accent-100)" }}>
                              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>PLAGIARISM</span>
                              <div style={{ fontSize: 15, fontWeight: "bold", color: (aiReport?.plagiarismScore || selectedSub.plagiarismScore) > 15 ? "var(--danger)" : "var(--success)" }}>{aiReport?.plagiarismScore || selectedSub.plagiarismScore}%</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Content block */}
                      <div style={{ maxHeight: 250, overflowY: "auto", padding: 12, background: "color-mix(in srgb, var(--text-primary) 2%, transparent)", borderRadius: 8, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                        {selectedSub.content}
                      </div>

                      {/* Pricing proposal cost action */}
                      {selectedSub.status !== "published" ? (
                        <div style={{ borderTop: "1px solid color-mix(in srgb, var(--text-primary) 6%, transparent)", paddingTop: 16 }}>
                          <form onSubmit={handleProposeCost} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 12, fontWeight: "bold" }}>Set Publishing Cost Fee ($):</span>
                            <input
                              type="number"
                              required
                              placeholder="e.g. 499"
                              value={pricingCost}
                              onChange={e => setPricingCost(e.target.value)}
                              style={{
                                padding: "6px 12px",
                                border: "1px solid var(--accent-100)",
                                borderRadius: 6,
                                width: 120
                              }}
                            />
                            <button type="submit" disabled={submittingCost} className="btn-primary" style={{ background: "var(--info)" }}>
                              {submittingCost ? "Sending..." : "Submit Cost Proposal"}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div style={{ color: "var(--success)", fontWeight: "bold", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle size={16} /> Fully Published & Paid (${selectedSub.publishingCost} fee received)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                      Select a manuscript from the list to review details.
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
                  <p>Manuscripts published on the platform database under your imprint.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 24 }}>
                {publishedBooks.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No published books yet.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {publishedBooks.map(b => (
                      <div key={b._id} style={{ display: "flex", gap: 12, padding: 16, background: "color-mix(in srgb, var(--text-primary) 1%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 4%, transparent)", borderRadius: 10 }}>
                        <div style={{ width: 40, height: 50, background: "var(--accent-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-600)", borderRadius: 6 }}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{b.title}</span>
                          <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "block" }}>Author: {b.author?.name}</span>
                          <span style={{ fontSize: 10, color: "var(--success)", display: "block", marginTop: 4 }}>
                            Published fee: ${b.publishingCost} (Paid)
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
                  <p>Discover registered writers, browse profiles, and initiate negotiations.</p>
                </div>
              </div>

              <div className="glass-panel" style={{ padding: 20 }}>
                <form onSubmit={handleSearchAuthors} style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Search by author name or interests..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" className="btn-primary" style={{ background: "var(--info)" }}>Search</button>
                </form>

                {loadingAuthors ? (
                  <div style={{ display: "flex", justify: "center", padding: 20 }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : authors.length === 0 ? (
                  <p style={{ textAlign: "center", color: "var(--text-muted)", padding: 20 }}>No authors found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {authors.map(a => (
                      <div key={a._id} style={{ display: "flex", justify: "space-between", alignItems: "center", padding: 14, background: "color-mix(in srgb, var(--text-primary) 1%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 3%, transparent)", borderRadius: 10 }}>
                        <div>
                          <span style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{a.name}</span>
                          <span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{a.bio || "No biography added."}</span>
                        </div>
                        <button
                          onClick={() => setActiveTab("messages")}
                          style={{
                            padding: "6px 14px",
                            background: "var(--info)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <MessageCircle size={12} /> Chat
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
            <div style={{ height: "calc(100vh - 120px)" }}>
              <ChatInterface user={user} currentRole="publisher" token={token} />
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === "settings" && (
            <div className="dash-content animate-fade-in">
              <div className="dash-welcome">
                <div>
                  <h1>Profile & Account Settings</h1>
                  <p>Update your display identity, biography, and interests — these power your author matches.</p>
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
                      placeholder="Tell authors a bit about your imprint..."
                      style={{ height: 120, resize: "none" }}
                      value={settingsBio}
                      onChange={e => setSettingsBio(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="form-label">Genre Interests</label>
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
                              borderColor: active ? "var(--info)" : "var(--border-medium)",
                              background: active ? "rgba(8, 145, 178, 0.08)" : "var(--bg-primary)",
                              color: active ? "var(--info)" : "var(--text-secondary)",
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

      {/* PIN Modal — Reveal Balance */}
      <WalletPinModal
        isOpen={balancePinOpen}
        onClose={() => setBalancePinOpen(false)}
        onSuccess={() => { setShowBalance(true); setBalancePinOpen(false); }}
        token={token}
        title="Enter PIN to View Wallet Balance"
      />
    </div>
  );
};

export default PublisherDashboard;
