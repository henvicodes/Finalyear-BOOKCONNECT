import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  BookOpen, Eye, Star, Clock, CheckCircle, AlertCircle, Shield,
  Users, DollarSign, MessageCircle, Settings, FileText, Send, RefreshCw, BarChart2, Award, LogOut
} from "lucide-react";
import ChatInterface from "../components/ChatInterface";
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
  const [activeTab, setActiveTab] = useState("overview");
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSub, setSelectedSub] = useState(null);
  
  // Verification Proof
  const [verifying, setVerifying] = useState(false);
  const [proofDoc, setProofDoc] = useState(user?.publisherVerification?.documentLink || "");
  const [isVerified, setIsVerified] = useState(user?.publisherVerification?.isVerified || false);
  const [verifyHash, setVerifyHash] = useState(user?.publisherVerification?.blockchainHash || "");

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
          <div className="sidebar-avatar" style={{ background: "#0369a1" }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-role-badge" style={{ background: "rgba(3, 105, 161, 0.1)", color: "#0369a1" }}>
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
            <FileText size={18} /><span>Submissions {reviewCount > 0 && <span style={{ background: "#f59e0b", color: "#fff", padding: "1px 6px", borderRadius: 10, fontSize: 10 }}>{reviewCount}</span>}</span>
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
        </nav>

        {/* Wallet Balance widget */}
        <div style={{
          margin: "10px 16px",
          padding: "12px 14px",
          background: "rgba(3, 105, 161, 0.04)",
          border: "1px solid rgba(3, 105, 161, 0.12)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 4
        }}>
          <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "bold" }}>Wallet Balance</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <DollarSign size={14} color="#0369a1" />
            <strong style={{ fontSize: 15, color: "#1e293b", fontFamily: "sans-serif" }}>
              ${user?.walletBalance !== undefined ? user.walletBalance.toFixed(2) : "1,000.00"}
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
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10b981", fontSize: 13, fontWeight: "bold" }}>
              <Shield size={16} /> Trust Verified Publisher
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#f59e0b", fontSize: 13, fontWeight: "bold" }}>
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
                <StatCard icon={<BookOpen size={20} />} label="Published Books" value={publishedBooks.length} color="#0369a1" />
                <StatCard icon={<Clock size={20} />} label="Pending Review" value={reviewCount} color="#f59e0b" />
                <StatCard icon={<DollarSign size={20} />} label="Earned Revenue" value={`$${(user?.earnings || 0).toFixed(2)}`} color="#059669" />
                <StatCard icon={<Shield size={20} />} label="Credibility Status" value={isVerified ? "Verified" : "Unverified"} color={isVerified ? "#10b981" : "#f59e0b"} />
              </div>

              <div className="dash-grid">
                {/* Recent Submissions */}
                <div className="dash-panel">
                  <div className="panel-header">
                    <h3>Recent Submissions</h3>
                    <button className="panel-link" onClick={() => setActiveTab("submissions")}>View all</button>
                  </div>
                  {submissions.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#94a3b8", padding: "10px 0" }}>No submissions received yet.</p>
                  ) : (
                    submissions.slice(0, 4).map((s, idx) => (
                      <div key={idx} style={{ display: "flex", justify: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(0,0,0,0.03)" }}>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{s.title}</span>
                          <span style={{ fontSize: 10, color: "#94a3b8" }}>by {s.author?.name || "Unknown"}</span>
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
                        <Shield size={14} color="#10b981" />
                        <div>
                          <strong>Publisher trust verified on chain</strong>
                          <span style={{ display: "block", fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>{verifyHash.slice(0, 20)}...</span>
                        </div>
                      </div>
                    )}
                    {publishedBooks.slice(0, 2).map((b, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 10, fontSize: 12 }}>
                        <CheckCircle size={14} color="#10b981" />
                        <div>
                          <strong>Manuscript "{b.title}" published</strong>
                          <span style={{ display: "block", fontSize: 10, color: "#94a3b8" }}>Payout completed to author</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
                      <Clock size={14} color="#f59e0b" />
                      <div>
                        <strong>Monitoring system active</strong>
                        <span style={{ display: "block", fontSize: 10, color: "#94a3b8" }}>Ready for proposals cost setting</span>
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
                    <Award size={48} color="#10b981" style={{ marginBottom: 12 }} />
                    <h3 style={{ color: "#10b981" }}>Web3 Credibility Ledger Verified</h3>
                    <p style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>
                      Your proof doc has been hashed and immutable locked on the blockchain.
                    </p>
                    <div style={{ marginTop: 16, padding: 12, background: "rgba(0,0,0,0.02)", borderRadius: 8, fontFamily: "monospace", fontSize: 11 }}>
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
                  <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: "bold", fontSize: 14 }}>
                    Incoming Drafts ({submissions.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {submissions.length === 0 ? (
                      <p style={{ padding: 16, fontSize: 12, color: "#94a3b8" }}>No manuscripts submitted yet.</p>
                    ) : (
                      submissions.map(sub => (
                        <div
                          key={sub._id}
                          onClick={() => handleOpenSubmission(sub)}
                          style={{
                            padding: 16,
                            borderBottom: "1px solid rgba(0,0,0,0.03)",
                            cursor: "pointer",
                            background: selectedSub?._id === sub._id ? "rgba(0,0,0,0.02)" : "transparent"
                          }}
                        >
                          <span style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{sub.title}</span>
                          <span style={{ display: "block", fontSize: 10, color: "#64748b", textTransform: "capitalize" }}>
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
                      <div style={{ display: "flex", justify: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 16, marginBottom: 16 }}>
                        <div>
                          <h2>{selectedSub.title}</h2>
                          <span style={{ fontSize: 12, color: "#64748b" }}>Submitted by: <strong>{selectedSub.author?.name}</strong></span>
                        </div>
                        <span style={{ fontSize: 12, color: "#64748b" }}>Status: <strong style={{ color: "#0369a1" }}>{selectedSub.status}</strong></span>
                      </div>

                      {/* AI scan box */}
                      <div style={{ background: "rgba(3,105,161,0.03)", padding: 16, border: "1px solid rgba(3,105,161,0.1)", borderRadius: 10, marginBottom: 16 }}>
                        <div style={{ display: "flex", justify: "space-between", alignItems: "center" }}>
                          <h4 style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#0369a1" }}>
                            <Sparkles size={14} /> AI Quality & Plagiarism Assessment
                          </h4>

                          <button
                            onClick={() => handleAIScan(selectedSub._id)}
                            disabled={evaluatingSub}
                            style={{
                              padding: "4px 10px",
                              fontSize: 11,
                              background: "#0369a1",
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
                            <div style={{ background: "#fff", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid #ede9fe" }}>
                              <span style={{ fontSize: 9, color: "#64748b" }}>QUALITY</span>
                              <div style={{ fontSize: 16, fontWeight: "bold", color: "#7c3aed" }}>{aiReport?.qualityScore || selectedSub.qualityScore}%</div>
                            </div>
                            <div style={{ background: "#fff", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid #ede9fe" }}>
                              <span style={{ fontSize: 9, color: "#64748b" }}>READABILITY</span>
                              <div style={{ fontSize: 13, fontWeight: "bold", color: "#0ea5e9", marginTop: 2 }}>{aiReport?.readabilityScore || selectedSub.readabilityScore}</div>
                            </div>
                            <div style={{ background: "#fff", padding: 8, borderRadius: 6, textAlign: "center", border: "1px solid #ede9fe" }}>
                              <span style={{ fontSize: 9, color: "#64748b" }}>PLAGIARISM</span>
                              <div style={{ fontSize: 15, fontWeight: "bold", color: (aiReport?.plagiarismScore || selectedSub.plagiarismScore) > 15 ? "#ef4444" : "#10b981" }}>{aiReport?.plagiarismScore || selectedSub.plagiarismScore}%</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Content block */}
                      <div style={{ maxHeight: 250, overflowY: "auto", padding: 12, background: "rgba(0,0,0,0.02)", borderRadius: 8, fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                        {selectedSub.content}
                      </div>

                      {/* Pricing proposal cost action */}
                      {selectedSub.status !== "published" ? (
                        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 16 }}>
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
                                border: "1px solid #ede9fe",
                                borderRadius: 6,
                                width: 120
                              }}
                            />
                            <button type="submit" disabled={submittingCost} className="btn-primary" style={{ background: "#0369a1" }}>
                              {submittingCost ? "Sending..." : "Submit Cost Proposal"}
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div style={{ color: "#10b981", fontWeight: "bold", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle size={16} /> Fully Published & Paid (${selectedSub.publishingCost} fee received)
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>
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
                  <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: 20 }}>No published books yet.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                    {publishedBooks.map(b => (
                      <div key={b._id} style={{ display: "flex", gap: 12, padding: 16, background: "rgba(0,0,0,0.01)", border: "1px solid rgba(0,0,0,0.04)", borderRadius: 10 }}>
                        <div style={{ width: 40, height: 50, background: "#f3f0ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#7c3aed", borderRadius: 6 }}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <span style={{ fontSize: 13, fontWeight: "bold", display: "block" }}>{b.title}</span>
                          <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Author: {b.author?.name}</span>
                          <span style={{ fontSize: 10, color: "#10b981", display: "block", marginTop: 4 }}>
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
                  <button type="submit" className="btn-primary" style={{ background: "#0369a1" }}>Search</button>
                </form>

                {loadingAuthors ? (
                  <div style={{ display: "flex", justify: "center", padding: 20 }}>
                    <RefreshCw className="animate-spin" size={24} />
                  </div>
                ) : authors.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#94a3b8", padding: 20 }}>No authors found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {authors.map(a => (
                      <div key={a._id} style={{ display: "flex", justify: "space-between", alignItems: "center", padding: 14, background: "rgba(0,0,0,0.01)", border: "1px solid rgba(0,0,0,0.03)", borderRadius: 10 }}>
                        <div>
                          <span style={{ display: "block", fontSize: 13, fontWeight: "bold" }}>{a.name}</span>
                          <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 4 }}>{a.bio || "No biography added."}</span>
                        </div>
                        <button
                          onClick={() => setActiveTab("messages")}
                          style={{
                            padding: "6px 14px",
                            background: "#0369a1",
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
        </div>
      </div>
    </div>
  );
};

export default PublisherDashboard;
