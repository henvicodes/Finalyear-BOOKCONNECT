import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Shield, Users, BookOpen, BarChart2, DollarSign, Star, FileText,
  Sparkles, Trash2, Edit3, CheckCircle, XCircle, Search, Filter,
  ArrowUpRight, Lock, Unlock, RefreshCw, Eye, BookMarked, Upload,
  Activity, Layers, Settings, LogOut, ChevronRight, Check, X,
  AlertTriangle, Building, CreditCard, MessageSquare, ShieldCheck
} from "lucide-react";
import "./AdminDashboard.css";

// Import role-specific components for the Role Studio
import {
  AuthorOverview,
  AuthorMyBooks,
  AuthorUploadBook,
  AuthorAIAssistant
} from "./AuthorDashboard";
import PublisherDashboard from "./PublisherDashboard";
import ReaderDashboard from "./ReaderDashboard";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const AdminDashboard = ({ user, token, onLogout }) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Masquerade / Persona Mode: "admin" | "author" | "publisher" | "reader"
  const [personaMode, setPersonaMode] = useState("admin");

  // Stats State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Users State
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userVerifyFilter, setUserVerifyFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState({});

  // Books State
  const [books, setBooks] = useState([]);
  const [bookSearch, setBookSearch] = useState("");
  const [bookStatusFilter, setBookStatusFilter] = useState("all");
  const [bookGenreFilter, setBookGenreFilter] = useState("all");
  const [selectedBook, setSelectedBook] = useState(null);
  const [editBookModalOpen, setEditBookModalOpen] = useState(false);
  const [editBookData, setEditBookData] = useState({});
  const [inspectBookModalOpen, setInspectBookModalOpen] = useState(false);

  // Submissions & Publishers State
  const [submissions, setSubmissions] = useState([]);
  const [publisherTab, setPublisherTab] = useState("submissions");

  // Transactions State
  const [transactions, setTransactions] = useState([]);
  const [txTypeFilter, setTxTypeFilter] = useState("all");

  // Reviews State
  const [reviews, setReviews] = useState([]);

  // Fetch initial data
  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (activeTab === "overview") fetchStats();
    if (activeTab === "users") fetchUsers();
    if (activeTab === "books") fetchBooks();
    if (activeTab === "publishers") fetchSubmissions();
    if (activeTab === "transactions") fetchTransactions();
    if (activeTab === "reviews") fetchReviews();
  }, [activeTab]);

  // ─── API Call Helpers ──────────────────────────────────────────────────────
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/admin/stats`, authHeaders);
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error("fetchStats error:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userRoleFilter !== "all") params.append("role", userRoleFilter);
      if (userVerifyFilter !== "all") params.append("isVerified", userVerifyFilter === "verified" ? "true" : "false");
      if (userSearch) params.append("search", userSearch);

      const { data } = await axios.get(`${BASE_URL}/api/admin/users?${params.toString()}`, authHeaders);
      if (data.success) setUsers(data.data);
    } catch (err) {
      console.error("fetchUsers error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (bookStatusFilter !== "all") params.append("status", bookStatusFilter);
      if (bookGenreFilter !== "all") params.append("genre", bookGenreFilter);
      if (bookSearch) params.append("search", bookSearch);

      const { data } = await axios.get(`${BASE_URL}/api/admin/books?${params.toString()}`, authHeaders);
      if (data.success) setBooks(data.data);
    } catch (err) {
      console.error("fetchBooks error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/admin/submissions`, authHeaders);
      if (data.success) setSubmissions(data.data);
    } catch (err) {
      console.error("fetchSubmissions error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (txTypeFilter !== "all") params.append("type", txTypeFilter);

      const { data } = await axios.get(`${BASE_URL}/api/admin/transactions?${params.toString()}`, authHeaders);
      if (data.success) setTransactions(data.data);
    } catch (err) {
      console.error("fetchTransactions error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${BASE_URL}/api/admin/reviews`, authHeaders);
      if (data.success) setReviews(data.data);
    } catch (err) {
      console.error("fetchReviews error:", err);
    } finally {
      setLoading(false);
    }
  };

  // ─── User Actions ──────────────────────────────────────────────────────────
  const handleToggleVerifyUser = async (u) => {
    try {
      const updatedVerify = !u.isVerified;
      const { data } = await axios.put(
        `${BASE_URL}/api/admin/users/${u._id}`,
        { isVerified: updatedVerify },
        authHeaders
      );
      if (data.success) {
        setUsers(users.map(item => item._id === u._id ? { ...item, isVerified: updatedVerify } : item));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to toggle verification");
    }
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;
    try {
      const { data } = await axios.put(
        `${BASE_URL}/api/admin/users/${selectedUser._id}`,
        editUserData,
        authHeaders
      );
      if (data.success) {
        alert("User details updated successfully!");
        setEditUserModalOpen(false);
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async (userId, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete user "${name}"?`)) return;
    try {
      const { data } = await axios.delete(`${BASE_URL}/api/admin/users/${userId}`, authHeaders);
      if (data.success) {
        alert("User deleted successfully!");
        setUsers(users.filter(u => u._id !== userId));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete user");
    }
  };

  // ─── Book Actions ──────────────────────────────────────────────────────────
  const handleQuickStatusChange = async (bookId, newStatus) => {
    try {
      const { data } = await axios.put(
        `${BASE_URL}/api/admin/books/${bookId}`,
        { status: newStatus },
        authHeaders
      );
      if (data.success) {
        setBooks(books.map(b => b._id === bookId ? { ...b, status: newStatus } : b));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update book status");
    }
  };

  const handleSaveBookEdit = async () => {
    if (!selectedBook) return;
    try {
      const { data } = await axios.put(
        `${BASE_URL}/api/admin/books/${selectedBook._id}`,
        editBookData,
        authHeaders
      );
      if (data.success) {
        alert("Book updated successfully!");
        setEditBookModalOpen(false);
        fetchBooks();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update book");
    }
  };

  const handleDeleteBook = async (bookId, title) => {
    if (!window.confirm(`Are you sure you want to delete book "${title}"?`)) return;
    try {
      const { data } = await axios.delete(`${BASE_URL}/api/admin/books/${bookId}`, authHeaders);
      if (data.success) {
        alert("Book deleted successfully!");
        setBooks(books.filter(b => b._id !== bookId));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete book");
    }
  };

  // ─── Publisher & Review Actions ────────────────────────────────────────────
  const handleVerifyPublisher = async (publisherId, isVerified) => {
    try {
      const { data } = await axios.put(
        `${BASE_URL}/api/admin/publishers/${publisherId}/verify`,
        { isVerified },
        authHeaders
      );
      if (data.success) {
        alert(data.message);
        fetchUsers();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Verification failed");
    }
  };

  const handleDeleteReview = async (bookId, reviewId) => {
    if (!window.confirm("Delete this review from platform?")) return;
    try {
      const { data } = await axios.delete(
        `${BASE_URL}/api/admin/reviews/${bookId}/${reviewId}`,
        authHeaders
      );
      if (data.success) {
        alert("Review removed!");
        setReviews(reviews.filter(r => r._id !== reviewId));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete review");
    }
  };

  // ─── Persona Switcher (All-Access Delegation) ──────────────────────────────
  if (personaMode === "author") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <div className="admin-masquerade-banner" style={{ margin: 0, borderRadius: 0 }}>
          <div className="masquerade-info">
            <Sparkles size={20} color="#c084fc" />
            <div>
              <div className="masquerade-title">🎭 Admin Mode: Author Studio View Active</div>
              <div className="masquerade-desc">You are interacting with the full author suite as Administrator.</div>
            </div>
          </div>
          <button className="btn-admin-primary" onClick={() => setPersonaMode("admin")}>
            ← Return to Admin Console
          </button>
        </div>
        <div style={{ padding: 24 }}>
          <AuthorMyBooks
            books={books}
            loading={loading}
            setActive={() => {}}
            setEditingBookId={() => {}}
            onPayCost={() => {}}
          />
        </div>
      </div>
    );
  }

  if (personaMode === "publisher") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div className="admin-masquerade-banner" style={{ margin: 0, borderRadius: 0 }}>
          <div className="masquerade-info">
            <Building size={20} color="#38bdf8" />
            <div>
              <div className="masquerade-title">🎭 Admin Mode: Publisher Dashboard Active</div>
              <div className="masquerade-desc">You are viewing the publishing house operations with Master Access.</div>
            </div>
          </div>
          <button className="btn-admin-primary" onClick={() => setPersonaMode("admin")}>
            ← Return to Admin Console
          </button>
        </div>
        <PublisherDashboard user={user} token={token} onLogout={onLogout} />
      </div>
    );
  }

  if (personaMode === "reader") {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div className="admin-masquerade-banner" style={{ margin: 0, borderRadius: 0 }}>
          <div className="masquerade-info">
            <BookMarked size={20} color="#34d399" />
            <div>
              <div className="masquerade-title">🎭 Admin Mode: Reader Experience Active</div>
              <div className="masquerade-desc">All books in library unlocked with Super-Admin VIP privileges.</div>
            </div>
          </div>
          <button className="btn-admin-primary" onClick={() => setPersonaMode("admin")}>
            ← Return to Admin Console
          </button>
        </div>
        <ReaderDashboard user={user} token={token} onLogout={onLogout} />
      </div>
    );
  }

  // ─── Render Admin Tabs ─────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div>
            {/* Persona Switcher Banner */}
            <div className="admin-masquerade-banner">
              <div className="masquerade-info">
                <ShieldCheck size={22} color="#a855f7" />
                <div>
                  <div className="masquerade-title">Role Masquerade & Multi-Access Switcher</div>
                  <div className="masquerade-desc">
                    Instantly simulate and control any user role on BookConnect with master privileges.
                  </div>
                </div>
              </div>
              <div className="masquerade-actions">
                <button className="btn-role-tab active" onClick={() => setPersonaMode("admin")}>Admin Hub</button>
                <button className="btn-role-tab" onClick={() => setPersonaMode("author")}>Author Studio</button>
                <button className="btn-role-tab" onClick={() => setPersonaMode("publisher")}>Publisher Desk</button>
                <button className="btn-role-tab" onClick={() => setPersonaMode("reader")}>Reader VIP</button>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="admin-kpi-grid">
              <div className="admin-kpi-card">
                <div className="admin-kpi-icon" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}>
                  <Users size={24} />
                </div>
                <div className="admin-kpi-info">
                  <div className="admin-kpi-label">Total Users</div>
                  <div className="admin-kpi-value">{stats?.users?.total ?? "—"}</div>
                  <div className="admin-kpi-sub">
                    <span>{stats?.users?.readers ?? 0} Readers</span> · 
                    <span>{stats?.users?.authors ?? 0} Authors</span> · 
                    <span>{stats?.users?.publishers ?? 0} Pubs</span>
                  </div>
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
                  <BookOpen size={24} />
                </div>
                <div className="admin-kpi-info">
                  <div className="admin-kpi-label">Books & Manuscripts</div>
                  <div className="admin-kpi-value">{stats?.books?.total ?? "—"}</div>
                  <div className="admin-kpi-sub">
                    <span style={{ color: "#34d399" }}>{stats?.books?.published ?? 0} Published</span> · 
                    <span style={{ color: "#fbbf24" }}>{stats?.books?.underReview ?? 0} In Review</span>
                  </div>
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-icon" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                  <DollarSign size={24} />
                </div>
                <div className="admin-kpi-info">
                  <div className="admin-kpi-label">Financial Volume</div>
                  <div className="admin-kpi-value">${(stats?.financials?.totalVolume ?? 0).toLocaleString()}</div>
                  <div className="admin-kpi-sub">
                    <span>{stats?.financials?.totalTransactions ?? 0} Completed Ledger Txs</span>
                  </div>
                </div>
              </div>

              <div className="admin-kpi-card">
                <div className="admin-kpi-icon" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                  <Star size={24} />
                </div>
                <div className="admin-kpi-info">
                  <div className="admin-kpi-label">Platform Rating</div>
                  <div className="admin-kpi-value">⭐ {stats?.engagement?.avgPlatformRating ?? "5.0"}</div>
                  <div className="admin-kpi-sub">
                    <span>Across {stats?.engagement?.totalReviews ?? 0} Reader Reviews</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Tables */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24 }}>
              {/* Recent Users */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-title"><Users size={18} color="#ef4444" /> Recent Registrations</div>
                  <button className="btn-secondary" onClick={() => setActiveTab("users")}>View All</button>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Role</th>
                        <th>Wallet</th>
                        <th>Verified</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.recent?.users?.map((u) => (
                        <tr key={u._id}>
                          <td>
                            <div className="table-user-cell">
                              <div className="table-user-avatar">
                                {u.name?.[0]?.toUpperCase()}
                              </div>
                              <div className="table-user-info">
                                <span className="table-user-name">{u.name}</span>
                                <span className="table-user-email">{u.email}</span>
                              </div>
                            </div>
                          </td>
                          <td><span className={`badge-role ${u.role}`}>{u.role}</span></td>
                          <td>${(u.walletBalance || 0).toFixed(2)}</td>
                          <td>{u.isVerified ? <CheckCircle size={15} color="#34d399" /> : <XCircle size={15} color="#64748b" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Books */}
              <div className="admin-card">
                <div className="admin-card-header">
                  <div className="admin-card-title"><BookOpen size={18} color="#8b5cf6" /> Recent Books & Manuscripts</div>
                  <button className="btn-secondary" onClick={() => setActiveTab("books")}>View All</button>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Author</th>
                        <th>Status</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.recent?.books?.map((b) => (
                        <tr key={b._id}>
                          <td>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{b.title}</div>
                            <div style={{ fontSize: 11, color: "#64748b", textTransform: "capitalize" }}>{b.genre}</div>
                          </td>
                          <td>{b.author?.name || "Unknown"}</td>
                          <td><span className={`badge-status ${b.status}`}>{b.status}</span></td>
                          <td>{b.isPaid ? `$${b.price}` : "Free"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        );

      case "users":
        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title"><Users size={20} color="#ef4444" /> Users Management ({users.length})</div>
              <div className="admin-card-actions">
                <div className="admin-search-wrap">
                  <Search size={14} className="admin-search-icon" />
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchUsers()}
                    className="admin-search-input"
                  />
                </div>
                <select
                  className="admin-select"
                  value={userRoleFilter}
                  onChange={(e) => { setUserRoleFilter(e.target.value); }}
                >
                  <option value="all">All Roles</option>
                  <option value="reader">Readers</option>
                  <option value="author">Authors</option>
                  <option value="publisher">Publishers</option>
                  <option value="admin">Admins</option>
                </select>
                <select
                  className="admin-select"
                  value={userVerifyFilter}
                  onChange={(e) => { setUserVerifyFilter(e.target.value); }}
                >
                  <option value="all">All Verification</option>
                  <option value="verified">Verified Only</option>
                  <option value="unverified">Unverified</option>
                </select>
                <button className="btn-admin-primary" onClick={fetchUsers}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Wallet Balance</th>
                    <th>Activity / Items</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <div className="table-user-cell">
                          <div className="table-user-avatar">
                            {u.profilePicture && u.profilePicture !== "default-avatar.png"
                              ? <img src={u.profilePicture} alt={u.name} />
                              : u.name?.[0]?.toUpperCase()}
                          </div>
                          <div className="table-user-info">
                            <span className="table-user-name">{u.name}</span>
                            <span className="table-user-email">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`badge-role ${u.role}`}>{u.role}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleVerifyUser(u)}
                          style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                          title="Click to toggle verification status"
                        >
                          {u.isVerified ? (
                            <span style={{ color: "#34d399", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                              <ShieldCheck size={16} /> Verified
                            </span>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                              <Shield size={16} /> Unverified
                            </span>
                          )}
                        </button>
                      </td>
                      <td>
                        <strong>${(u.walletBalance || 0).toFixed(2)}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          {u.role === "author" && `${u.authoredBooksCount || 0} books`}
                          {u.role === "publisher" && `${u.publishedBooksCount || 0} published`}
                          {u.role === "reader" && `${u.libraryCount || 0} in library`}
                          {u.role === "admin" && "Super Master"}
                        </span>
                      </td>
                      <td>
                        <div className="action-btn-group">
                          <button
                            className="btn-icon-action"
                            title="Edit User Details / Role"
                            onClick={() => {
                              setSelectedUser(u);
                              setEditUserData({
                                name: u.name,
                                email: u.email,
                                role: u.role,
                                walletBalance: u.walletBalance || 0,
                                isVerified: u.isVerified || false,
                                bio: u.bio || ""
                              });
                              setEditUserModalOpen(true);
                            }}
                          >
                            <Edit3 size={15} />
                          </button>
                          {u._id !== user?._id && (
                            <button
                              className="btn-icon-action danger"
                              title="Delete User"
                              onClick={() => handleDeleteUser(u._id, u.name)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loading && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "32px", color: "#64748b" }}>
                        No users found matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "books":
        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title"><BookOpen size={20} color="#8b5cf6" /> Books & Manuscripts Direct Control ({books.length})</div>
              <div className="admin-card-actions">
                <div className="admin-search-wrap">
                  <Search size={14} className="admin-search-icon" />
                  <input
                    type="text"
                    placeholder="Search title, genre..."
                    value={bookSearch}
                    onChange={(e) => setBookSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && fetchBooks()}
                    className="admin-search-input"
                  />
                </div>
                <select
                  className="admin-select"
                  value={bookStatusFilter}
                  onChange={(e) => { setBookStatusFilter(e.target.value); }}
                >
                  <option value="all">All Statuses</option>
                  <option value="published">Published</option>
                  <option value="under_review">Under Review</option>
                  <option value="cost_proposed">Cost Proposed</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
                <button className="btn-admin-primary" onClick={fetchBooks}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Book Details</th>
                    <th>Author</th>
                    <th>Publisher</th>
                    <th>Status</th>
                    <th>Pricing</th>
                    <th>Ratings / Reads</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {books.map((b) => (
                    <tr key={b._id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <img
                            src={b.coverImage || "https://picsum.photos/seed/book/80/120"}
                            alt={b.title}
                            style={{ width: 34, height: 48, objectFit: "cover", borderRadius: 4 }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: "#fff" }}>{b.title}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "capitalize" }}>{b.genre}</div>
                          </div>
                        </div>
                      </td>
                      <td>{b.author?.name || "Unknown"}</td>
                      <td>{b.publisher?.name || <span style={{ color: "#64748b" }}>Self-Published</span>}</td>
                      <td>
                        <span className={`badge-status ${b.status}`}>{b.status}</span>
                      </td>
                      <td>
                        {b.isPaid ? <strong>${b.price}</strong> : <span style={{ color: "#34d399" }}>Free</span>}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                          ⭐ {b.averageRating || 0} ({b.totalRatings || 0}) · 👁️ {b.totalReads || 0}
                        </span>
                      </td>
                      <td>
                        <div className="action-btn-group">
                          <button
                            className="btn-icon-action"
                            title="Inspect Full Content (Free VIP Access)"
                            onClick={() => {
                              setSelectedBook(b);
                              setInspectBookModalOpen(true);
                            }}
                          >
                            <Eye size={15} />
                          </button>
                          {b.status !== "published" ? (
                            <button
                              className="btn-icon-action success"
                              title="Instant Publish"
                              onClick={() => handleQuickStatusChange(b._id, "published")}
                            >
                              <CheckCircle size={15} />
                            </button>
                          ) : (
                            <button
                              className="btn-icon-action"
                              title="Revert to Draft"
                              onClick={() => handleQuickStatusChange(b._id, "draft")}
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                          <button
                            className="btn-icon-action"
                            title="Edit Book Details"
                            onClick={() => {
                              setSelectedBook(b);
                              setEditBookData({
                                title: b.title,
                                genre: b.genre,
                                price: b.price || 0,
                                isPaid: b.isPaid || false,
                                status: b.status,
                                description: b.description || "",
                                publishingCost: b.publishingCost || 0
                              });
                              setEditBookModalOpen(true);
                            }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            className="btn-icon-action danger"
                            title="Delete Book"
                            onClick={() => handleDeleteBook(b._id, b.title)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "publishers":
        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title"><Building size={20} color="#0ea5e9" /> Publisher Center & Submissions</div>
              <div className="admin-card-actions">
                <button
                  className={`btn-secondary ${publisherTab === "submissions" ? "btn-admin-primary" : ""}`}
                  onClick={() => setPublisherTab("submissions")}
                >
                  Manuscript Submissions ({submissions.length})
                </button>
                <button
                  className={`btn-secondary ${publisherTab === "verifications" ? "btn-admin-primary" : ""}`}
                  onClick={() => setPublisherTab("verifications")}
                >
                  Publisher Verifications
                </button>
              </div>
            </div>

            {publisherTab === "submissions" ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Manuscript</th>
                      <th>Author</th>
                      <th>Target Publisher</th>
                      <th>Status</th>
                      <th>Proposed Cost</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((s) => (
                      <tr key={s._id}>
                        <td>
                          <strong>{s.title}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{s.genre}</div>
                        </td>
                        <td>{s.author?.name}</td>
                        <td>{s.publisher?.name || "Pending Selection"}</td>
                        <td><span className={`badge-status ${s.status}`}>{s.status}</span></td>
                        <td>${s.publishingCost || 0}</td>
                        <td>
                          <div className="action-btn-group">
                            <button
                              className="btn-icon-action"
                              title="Inspect Manuscript"
                              onClick={() => { setSelectedBook(s); setInspectBookModalOpen(true); }}
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              className="btn-icon-action success"
                              title="Force Approve & Publish"
                              onClick={() => handleQuickStatusChange(s._id, "published")}
                            >
                              <CheckCircle size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {submissions.length === 0 && (
                      <tr>
                        <td colSpan="6" style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                          No manuscripts currently pending publisher review.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Publisher</th>
                      <th>Doc Proof</th>
                      <th>Blockchain Hash</th>
                      <th>Verification Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.filter(u => u.role === "publisher").map((p) => (
                      <tr key={p._id}>
                        <td>
                          <strong>{p.name}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{p.email}</div>
                        </td>
                        <td>
                          {p.publisherVerification?.documentLink ? (
                            <a
                              href={p.publisherVerification.documentLink}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#38bdf8", textDecoration: "underline", fontSize: 12 }}
                            >
                              View Legal Proof
                            </a>
                          ) : (
                            <span style={{ color: "#64748b", fontSize: 12 }}>No document uploaded</span>
                          )}
                        </td>
                        <td>
                          <code style={{ fontSize: 11, color: "#a78bfa" }}>
                            {p.publisherVerification?.blockchainHash || p.blockchainWallet?.address || "Unregistered"}
                          </code>
                        </td>
                        <td>
                          {p.isVerified ? (
                            <span style={{ color: "#34d399", fontSize: 12, fontWeight: 700 }}>VERIFIED</span>
                          ) : (
                            <span style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700 }}>PENDING</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-admin-primary"
                            onClick={() => handleVerifyPublisher(p._id, !p.isVerified)}
                          >
                            {p.isVerified ? "Revoke Verification" : "Approve & Verify"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );

      case "transactions":
        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title"><CreditCard size={20} color="#10b981" /> Financial & Blockchain Ledger ({transactions.length})</div>
              <div className="admin-card-actions">
                <select
                  className="admin-select"
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                >
                  <option value="all">All Types</option>
                  <option value="book_purchase">Book Purchases</option>
                  <option value="publishing_fee">Publishing Fees</option>
                  <option value="p2p_transfer">P2P Transfers</option>
                </select>
                <button className="btn-admin-primary" onClick={fetchTransactions}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tx Hash</th>
                    <th>Type</th>
                    <th>Sender</th>
                    <th>Receiver</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx._id}>
                      <td>
                        <code style={{ fontSize: 11, color: "#38bdf8" }}>
                          {tx.txHash ? `${tx.txHash.slice(0, 10)}...${tx.txHash.slice(-8)}` : "Internal Ledger"}
                        </code>
                      </td>
                      <td>
                        <span style={{ textTransform: "capitalize", fontWeight: 600 }}>
                          {tx.type.replace("_", " ")}
                        </span>
                      </td>
                      <td>{tx.sender?.name || "System"}</td>
                      <td>{tx.receiver?.name || "System"}</td>
                      <td><strong style={{ color: "#10b981" }}>${(tx.amount || 0).toFixed(2)}</strong></td>
                      <td>
                        <span className="badge-status published">{tx.status}</span>
                      </td>
                      <td style={{ fontSize: 12, color: "#94a3b8" }}>
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                        No transactions found in platform ledger.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "reviews":
        return (
          <div className="admin-card">
            <div className="admin-card-header">
              <div className="admin-card-title"><MessageSquare size={20} color="#f59e0b" /> Reviews & Content Moderation ({reviews.length})</div>
              <button className="btn-admin-primary" onClick={fetchReviews}><RefreshCw size={14} /> Refresh</button>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Book</th>
                    <th>Reviewer</th>
                    <th>Rating</th>
                    <th>Review Comment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r._id}>
                      <td>
                        <strong>{r.bookTitle}</strong>
                        <div style={{ fontSize: 11, color: "#64748b" }}>by {r.authorName}</div>
                      </td>
                      <td>{r.user?.name || "Anonymous"}</td>
                      <td>
                        <span style={{ color: "#fbbf24", fontWeight: 700 }}>
                          {"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}
                        </span>
                      </td>
                      <td style={{ maxWidth: 360, color: "#e2e8f0", fontSize: 13 }}>
                        "{r.review || "No written review text provided."}"
                      </td>
                      <td>
                        <button
                          className="btn-icon-action danger"
                          title="Remove Review"
                          onClick={() => handleDeleteReview(r.bookId, r._id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reviews.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                        No reader reviews on the platform yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="admin-wrapper">
      {/* ─── Sidebar ────────────────────────────────────────────────────────── */}
      <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <div className="admin-logo-box">
            <div className="admin-logo-icon"><Shield size={22} /></div>
            <div className="admin-logo-text">
              <span>BookConnect</span>
              <span className="admin-badge-super">ADMIN CONSOLE</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ display: "none", background: "none", border: "none", color: "#94a3b8" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-sidebar-user">
          <div className="admin-sidebar-avatar">
            {user?.profilePicture && user.profilePicture !== "default-avatar.png"
              ? <img src={user.profilePicture} alt={user.name} />
              : user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="admin-user-details">
            <span className="admin-user-name">{user?.name}</span>
            <span className="admin-user-role"><ShieldCheck size={12} /> Master Admin</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          <div className="admin-nav-category">Main Management</div>
          <button
            className={`admin-nav-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => { setActiveTab("overview"); setSidebarOpen(false); }}
          >
            <BarChart2 size={17} /><span>Command Center</span>
          </button>
          <button
            className={`admin-nav-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => { setActiveTab("users"); setSidebarOpen(false); }}
          >
            <Users size={17} /><span>Users (All Roles)</span>
            {stats?.users?.total !== undefined && <span className="nav-badge">{stats.users.total}</span>}
          </button>
          <button
            className={`admin-nav-btn ${activeTab === "books" ? "active" : ""}`}
            onClick={() => { setActiveTab("books"); setSidebarOpen(false); }}
          >
            <BookOpen size={17} /><span>Books & Manuscripts</span>
            {stats?.books?.total !== undefined && <span className="nav-badge">{stats.books.total}</span>}
          </button>

          <div className="admin-nav-category">Publishers & Operations</div>
          <button
            className={`admin-nav-btn ${activeTab === "publishers" ? "active" : ""}`}
            onClick={() => { setActiveTab("publishers"); setSidebarOpen(false); }}
          >
            <Building size={17} /><span>Publisher Center</span>
          </button>
          <button
            className={`admin-nav-btn ${activeTab === "transactions" ? "active" : ""}`}
            onClick={() => { setActiveTab("transactions"); setSidebarOpen(false); }}
          >
            <CreditCard size={17} /><span>Blockchain Ledger</span>
          </button>
          <button
            className={`admin-nav-btn ${activeTab === "reviews" ? "active" : ""}`}
            onClick={() => { setActiveTab("reviews"); setSidebarOpen(false); }}
          >
            <MessageSquare size={17} /><span>Reviews & Moderation</span>
          </button>

          <div className="admin-nav-category">Multi-Role Masquerade</div>
          <button className="admin-nav-btn" onClick={() => setPersonaMode("author")}>
            <Sparkles size={17} /><span>Author Studio</span>
          </button>
          <button className="admin-nav-btn" onClick={() => setPersonaMode("publisher")}>
            <Building size={17} /><span>Publisher Desk</span>
          </button>
          <button className="admin-nav-btn" onClick={() => setPersonaMode("reader")}>
            <BookMarked size={17} /><span>Reader VIP Library</span>
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-logout-btn" onClick={onLogout}>
            <LogOut size={16} /><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Content ───────────────────────────────────────────────────── */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button className="admin-mobile-toggle" onClick={() => setSidebarOpen(true)}>
              <Layers size={22} />
            </button>
            <div className="admin-breadcrumb">
              <span>Admin Console</span>
              <ChevronRight size={14} />
              <span className="admin-breadcrumb-title" style={{ textTransform: "capitalize" }}>{activeTab}</span>
            </div>
          </div>
          <div className="admin-topbar-right">
            <div className="admin-mode-pill">
              <span className="admin-mode-dot" />
              <span>Full Master Control</span>
            </div>
          </div>
        </header>

        <div className="admin-body">
          {renderTabContent()}
        </div>
      </div>

      {/* ─── Edit User Modal ─────────────────────────────────────────────────── */}
      {editUserModalOpen && selectedUser && (
        <div className="admin-modal-overlay" onClick={() => setEditUserModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title"><Edit3 size={18} /> Edit User: {selectedUser.name}</div>
              <button className="admin-modal-close" onClick={() => setEditUserModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-form-label">Full Name</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={editUserData.name || ""}
                  onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Email Address</label>
                <input
                  type="email"
                  className="admin-form-input"
                  value={editUserData.email || ""}
                  onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Platform Role</label>
                <select
                  className="admin-form-select"
                  value={editUserData.role || "reader"}
                  onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                >
                  <option value="reader">Reader</option>
                  <option value="author">Author</option>
                  <option value="publisher">Publisher</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Wallet Balance ($)</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={editUserData.walletBalance || 0}
                  onChange={(e) => setEditUserData({ ...editUserData, walletBalance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Verification Status</label>
                <select
                  className="admin-form-select"
                  value={editUserData.isVerified ? "true" : "false"}
                  onChange={(e) => setEditUserData({ ...editUserData, isVerified: e.target.value === "true" })}
                >
                  <option value="true">Verified</option>
                  <option value="false">Unverified</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Bio</label>
                <textarea
                  rows="3"
                  className="admin-form-textarea"
                  value={editUserData.bio || ""}
                  onChange={(e) => setEditUserData({ ...editUserData, bio: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="btn-secondary" onClick={() => setEditUserModalOpen(false)}>Cancel</button>
              <button className="btn-admin-primary" onClick={handleSaveUserEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Book Modal ─────────────────────────────────────────────────── */}
      {editBookModalOpen && selectedBook && (
        <div className="admin-modal-overlay" onClick={() => setEditBookModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title"><Edit3 size={18} /> Edit Book: {selectedBook.title}</div>
              <button className="admin-modal-close" onClick={() => setEditBookModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-form-group">
                <label className="admin-form-label">Book Title</label>
                <input
                  type="text"
                  className="admin-form-input"
                  value={editBookData.title || ""}
                  onChange={(e) => setEditBookData({ ...editBookData, title: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Status</label>
                <select
                  className="admin-form-select"
                  value={editBookData.status || "draft"}
                  onChange={(e) => setEditBookData({ ...editBookData, status: e.target.value })}
                >
                  <option value="draft">Draft</option>
                  <option value="under_review">Under Review</option>
                  <option value="cost_proposed">Cost Proposed</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Genre</label>
                <select
                  className="admin-form-select"
                  value={editBookData.genre || "fiction"}
                  onChange={(e) => setEditBookData({ ...editBookData, genre: e.target.value })}
                >
                  <option value="fiction">Fiction</option>
                  <option value="non-fiction">Non-Fiction</option>
                  <option value="science">Science</option>
                  <option value="technology">Technology</option>
                  <option value="history">History</option>
                  <option value="poetry">Poetry</option>
                  <option value="drama">Drama</option>
                  <option value="thriller">Thriller</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Price ($)</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={editBookData.price || 0}
                  onChange={(e) => setEditBookData({ ...editBookData, price: parseFloat(e.target.value) || 0, isPaid: parseFloat(e.target.value) > 0 })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Publishing Fee / Cost ($)</label>
                <input
                  type="number"
                  className="admin-form-input"
                  value={editBookData.publishingCost || 0}
                  onChange={(e) => setEditBookData({ ...editBookData, publishingCost: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Description</label>
                <textarea
                  rows="3"
                  className="admin-form-textarea"
                  value={editBookData.description || ""}
                  onChange={(e) => setEditBookData({ ...editBookData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-modal-footer">
              <button className="btn-secondary" onClick={() => setEditBookModalOpen(false)}>Cancel</button>
              <button className="btn-admin-primary" onClick={handleSaveBookEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Inspect Content Modal (VIP Reader Access) ────────────────────────── */}
      {inspectBookModalOpen && selectedBook && (
        <div className="admin-modal-overlay" onClick={() => setInspectBookModalOpen(false)}>
          <div className="admin-modal" style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <div className="admin-modal-title">
                <Eye size={18} color="#34d399" /> Free Admin Content Inspection: {selectedBook.title}
              </div>
              <button className="admin-modal-close" onClick={() => setInspectBookModalOpen(false)}><X size={18} /></button>
            </div>
            <div className="admin-modal-body">
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
                <img
                  src={selectedBook.coverImage || "https://picsum.photos/seed/book/100/150"}
                  alt={selectedBook.title}
                  style={{ width: 80, height: 115, objectFit: "cover", borderRadius: 8 }}
                />
                <div>
                  <h3 style={{ margin: "0 0 6px 0", color: "#fff" }}>{selectedBook.title}</h3>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>
                    Author: {selectedBook.author?.name || "Unknown"} · Status: <strong>{selectedBook.status}</strong>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                    Genre: {selectedBook.genre} · Price: {selectedBook.isPaid ? `$${selectedBook.price}` : "Free"}
                  </div>
                </div>
              </div>

              <div style={{ background: "#0f172a", padding: 18, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <h4 style={{ margin: "0 0 8px 0", color: "#cbd5e1" }}>Description</h4>
                <p style={{ margin: 0, fontSize: 13.5, color: "#94a3b8", lineHeight: 1.6 }}>
                  {selectedBook.description || "No description provided."}
                </p>
              </div>

              {selectedBook.content && (
                <div style={{ background: "#0f172a", padding: 18, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#cbd5e1" }}>Raw Manuscript Content</h4>
                  <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 13, color: "#cbd5e1", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {selectedBook.content}
                  </div>
                </div>
              )}

              {selectedBook.chapters && selectedBook.chapters.length > 0 && (
                <div style={{ background: "#0f172a", padding: 18, borderRadius: 10, border: "1px solid rgba(255, 255, 255, 0.08)" }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#cbd5e1" }}>Chapters ({selectedBook.chapters.length})</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedBook.chapters.map((ch, idx) => (
                      <div key={idx} style={{ padding: 10, background: "rgba(255, 255, 255, 0.03)", borderRadius: 6 }}>
                        <div style={{ fontWeight: 600, color: "#f8fafc", fontSize: 13 }}>{ch.title}</div>
                        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, maxHeight: 80, overflowY: "hidden" }}>
                          {ch.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="admin-modal-footer">
              <button className="btn-secondary" onClick={() => setInspectBookModalOpen(false)}>Close</button>
              {selectedBook.status !== "published" && (
                <button
                  className="btn-admin-primary"
                  onClick={() => {
                    handleQuickStatusChange(selectedBook._id, "published");
                    setInspectBookModalOpen(false);
                  }}
                >
                  Publish This Book Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
