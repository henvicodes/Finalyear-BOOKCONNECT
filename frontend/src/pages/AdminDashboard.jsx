import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  BookOpen, Users, Shield, BarChart2, DollarSign, Activity, ScrollText, LogOut,
  AlertCircle, CheckCircle, Search, FileWarning,
} from "lucide-react";
import ThemeToggle from "../components/ThemeToggle";
import HelpTip from "../components/HelpTip";
import "../styles/admin.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const errorOf = (err, fallback) => err.response?.data?.message || fallback;

// Verified evidence checklist + where to look each number up (official portals).
const LOOKUPS = {
  CIN: { label: "MCA company search", url: "https://www.mca.gov.in/" },
  LLPIN: { label: "MCA LLP search", url: "https://www.mca.gov.in/" },
  GSTIN: { label: "GST taxpayer search", url: "https://services.gst.gov.in/services/searchtp" },
  UDYAM: { label: "Udyam verification", url: "https://udyamregistration.gov.in/Udyam_Verify.aspx" },
  ISBN_PREFIX: { label: "ISBN agency (isbn.gov.in)", url: "https://isbn.gov.in/" },
};

const StatCard = ({ icon, label, value, color }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "1a", color }}>{icon}</div>
    <div className="stat-info">
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  </div>
);

const Pill = ({ tone = "", children }) => <span className={`admin-pill ${tone}`}>{children}</span>;

const Pager = ({ page, pages, onPage }) =>
  pages > 1 ? (
    <div className="admin-pager">
      <button className="admin-btn" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {pages}</span>
      <button className="admin-btn" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  ) : null;

const Heading = ({ title, text }) => (
  <div className="dash-welcome">
    <div>
      <h1>{title}</h1>
      <p>{text}</p>
    </div>
  </div>
);

// ───────────────────────── Overview ─────────────────────────
const Overview = ({ go }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(`${BASE_URL}/api/admin/overview`)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(errorOf(e, "Could not load the overview.")));
  }, []);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  const h = data.health;
  const attention = [
    { label: "Publishers waiting for verification", value: h.pendingVerifications, tab: "verification" },
    { label: "Manuscripts flagged for similarity", value: h.flaggedManuscripts, tab: "content", hint: "flagged" },
    { label: "Failed payments", value: h.failedPayments, tab: "health" },
    { label: "Awaiting a publisher's review", value: h.awaitingReview, tab: "health" },
    { label: "Offers waiting for the author", value: h.openOffers, tab: "health" },
    { label: "Declined submissions", value: h.declined, tab: "health" },
  ];
  const maxBooks = Math.max(1, ...Object.values(data.booksByStatus));

  return (
    <>
      <Heading title="Overview" text="A quick look at how the platform is doing and what needs you." />
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard icon={<Users size={20} />} label={`Users (+${data.newUsersThisWeek} this week)`} value={data.totalUsers} color="var(--info)" />
        <StatCard icon={<BookOpen size={20} />} label="Books" value={data.totalBooks} color="var(--accent-600)" />
        <StatCard icon={<DollarSign size={20} />} label={`Money moved (${data.totalTransactions} payments)`} value={money(data.totalMoneyMoved)} color="var(--success)" />
        <StatCard icon={<Shield size={20} />} label="Payments recorded on-chain" value={data.onChainTransactions} color="var(--warning)" />
      </div>

      <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Needs attention</h3>
      <div className="admin-grid">
        {attention.map((a) => (
          <button key={a.label} className={`admin-attention ${a.value > 0 ? "hot" : ""}`} onClick={() => go(a.tab, a.hint)}>
            <strong>{a.value}</strong>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div className="glass-panel admin-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Users by role</h3>
          {Object.entries(data.usersByRole).map(([role, n]) => (
            <div key={role} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", textTransform: "capitalize" }}>
              <span>{role}s</span><strong>{n}</strong>
            </div>
          ))}
          {data.suspendedUsers > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "var(--danger)" }}>
              <span>Suspended</span><strong>{data.suspendedUsers}</strong>
            </div>
          )}
        </div>

        <div className="glass-panel admin-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Books by status</h3>
          {Object.entries(data.booksByStatus).map(([status, n]) => (
            <div key={status} style={{ marginBottom: 8, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", textTransform: "capitalize", marginBottom: 3 }}>
                <span>{status.replace("_", " ")}</span><strong>{n}</strong>
              </div>
              <div className="admin-bar"><div style={{ width: `${(n / maxBooks) * 100}%` }} /></div>
            </div>
          ))}
        </div>

        <div className="glass-panel admin-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Money by type</h3>
          {Object.keys(data.moneyByType).length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No payments yet.</p>}
          {Object.entries(data.moneyByType).map(([type, m]) => (
            <div key={type} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", textTransform: "capitalize" }}>
              <span>{type.replace("_", " ")} ({m.count})</span><strong>{money(m.total)}</strong>
            </div>
          ))}
        </div>

        <div className="glass-panel admin-card">
          <h3 style={{ fontSize: 14, margin: "0 0 12px" }}>Recent sign-ups</h3>
          {data.recentUsers.map((u) => (
            <div key={u._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", gap: 8 }}>
              <span>{u.name} <Pill>{u.role}</Pill></span>
              <span style={{ color: "var(--text-muted)" }}>{when(u.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ───────────────────────── Users ─────────────────────────
const UsersTab = () => {
  const [filters, setFilters] = useState({ search: "", role: "", status: "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    axios.get(`${BASE_URL}/api/admin/users`, { params })
      .then((r) => { setRows(r.data.data); setPages(r.data.pages); setError(""); })
      .catch((e) => setError(errorOf(e, "Could not load users.")));
  }, [filters, page]);

  useEffect(() => {
    const t = setTimeout(load, 250); // small delay while typing in the search box
    return () => clearTimeout(t);
  }, [load]);

  const act = async (fn) => {
    try {
      await fn();
      load();
      setDetail(null);
    } catch (e) {
      alert(errorOf(e, "That didn't work."));
    }
  };

  const suspend = (u) => {
    const reason = window.prompt(`Suspend ${u.name}? They'll be signed out and unable to log in.\n\nReason (required):`);
    if (reason && reason.trim()) act(() => axios.put(`${BASE_URL}/api/admin/users/${u._id}/suspend`, { reason }));
  };
  const reinstate = (u) => act(() => axios.put(`${BASE_URL}/api/admin/users/${u._id}/unsuspend`, {}));
  const changeRole = (u) => {
    const role = window.prompt(`New role for ${u.name} (reader, author or publisher):`, u.role);
    if (role && role !== u.role) act(() => axios.put(`${BASE_URL}/api/admin/users/${u._id}/role`, { role: role.trim().toLowerCase() }));
  };
  const open = (u) =>
    axios.get(`${BASE_URL}/api/admin/users/${u._id}`).then((r) => setDetail(r.data.data)).catch((e) => alert(errorOf(e, "Could not open the user.")));

  const set = (key) => (e) => { setPage(1); setFilters((f) => ({ ...f, [key]: e.target.value })); };

  return (
    <>
      <Heading title="Users" text="Search people, suspend accounts that break the rules, and fix roles." />
      <div className="admin-toolbar">
        <div style={{ position: "relative" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
          <input className="input-field" style={{ paddingLeft: 30 }} placeholder="Search name or email" value={filters.search} onChange={set("search")} />
        </div>
        <select className="input-field" value={filters.role} onChange={set("role")}>
          <option value="">All roles</option>
          <option value="reader">Readers</option>
          <option value="author">Authors</option>
          <option value="publisher">Publishers</option>
          <option value="admin">Admins</option>
        </select>
        <select className="input-field" value={filters.status} onChange={set("status")}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="glass-panel admin-table-wrap" style={{ padding: 0 }}>
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-muted)" }}>No users match.</td></tr>}
            {rows.map((u) => (
              <tr key={u._id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <Pill tone={u.role === "admin" ? "info" : ""}>{u.role}</Pill>{" "}
                  {u.role === "publisher" && u.publisherVerification?.isVerified && <Pill tone="good">verified</Pill>}
                </td>
                <td>{u.isSuspended ? <Pill tone="bad">suspended</Pill> : <Pill tone="good">active</Pill>}</td>
                <td>{when(u.createdAt)}</td>
                <td>
                  <div className="admin-actions">
                    <button className="admin-btn" onClick={() => open(u)}>View</button>
                    {u.role !== "admin" && (u.isSuspended
                      ? <button className="admin-btn ok" onClick={() => reinstate(u)}>Reinstate</button>
                      : <button className="admin-btn danger" onClick={() => suspend(u)}>Suspend</button>)}
                    {u.role !== "admin" && <button className="admin-btn" onClick={() => changeRole(u)}>Change role</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />

      {detail && (
        <div className="glass-panel admin-card" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>{detail.name}</h3>
            <button className="admin-btn" onClick={() => setDetail(null)}>Close</button>
          </div>
          <dl className="admin-kv">
            <dt>Email</dt><dd>{detail.email} {detail.isEmailVerified ? <Pill tone="good">verified</Pill> : <Pill tone="warn">not verified</Pill>}</dd>
            <dt>Role</dt><dd>{detail.role}</dd>
            <dt>Joined</dt><dd>{when(detail.createdAt)}</dd>
            <dt>Books written</dt><dd>{detail.booksAuthored} ({detail.publishedBooks} published)</dd>
            <dt>Books bought</dt><dd>{detail.purchasedCount}</dd>
            <dt>Payments</dt><dd>{detail.transactions}</dd>
            <dt>Wallet balance</dt><dd>{money(detail.walletBalance)} (earned {money(detail.earnings)})</dd>
            <dt>Linked wallet</dt><dd style={{ fontFamily: "monospace" }}>{detail.walletAddress || "none"}</dd>
            {detail.isSuspended && <><dt>Suspended</dt><dd>{detail.suspendedReason} · {when(detail.suspendedAt)}</dd></>}
          </dl>
        </div>
      )}
    </>
  );
};

// ───────────────────────── Publisher verification ─────────────────────────
const VerificationTab = () => {
  const [status, setStatus] = useState("pending");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    axios.get(`${BASE_URL}/api/admin/publisher-verifications`, { params: { status } })
      .then((r) => { setRows(r.data.data); setError(""); })
      .catch((e) => setError(errorOf(e, "Could not load requests.")));
  }, [status]);
  useEffect(load, [load]);

  const approve = async (u) => {
    if (!window.confirm(`Approve ${u.publisherVerification.companyName}? Only do this after you've checked the number on the official register and the document.`)) return;
    try { await axios.post(`${BASE_URL}/api/admin/publisher-verifications/${u._id}/approve`, {}); load(); }
    catch (e) { alert(errorOf(e, "Could not approve.")); }
  };
  const reject = async (u) => {
    const reason = window.prompt("Why is this being rejected? (the publisher will see this)");
    if (!reason || !reason.trim()) return;
    try { await axios.post(`${BASE_URL}/api/admin/publisher-verifications/${u._id}/reject`, { reason }); load(); }
    catch (e) { alert(errorOf(e, "Could not reject.")); }
  };

  return (
    <>
      <Heading title="Publisher verification" text="Check that a publisher is a real, registered business before they get the Verified badge." />
      <div className="admin-toolbar">
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} className={`admin-btn ${status === s ? "ok" : ""}`} onClick={() => setStatus(s)} style={{ textTransform: "capitalize" }}>{s}</button>
        ))}
        <HelpTip
          title="How verification works"
          text="The publisher sends a company name, a registration number and a link to a document. The app only checks the number's format. You confirm it is real by looking it up on the official register and checking that the name matches the document."
        />
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {rows.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Nothing {status}.</p>}

      {rows.map((u) => {
        const v = u.publisherVerification;
        const lookup = LOOKUPS[v.registrationType];
        return (
          <div key={u._id} className="glass-panel admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>{v.companyName} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>· {u.name} ({u.email})</span></h3>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sent {when(v.submittedAt)}</span>
            </div>
            <dl className="admin-kv">
              <dt>Registration</dt><dd>{v.registrationType.replace("_", " ")}: <strong style={{ fontFamily: "monospace" }}>{v.registrationNumber}</strong></dd>
              <dt>Document</dt><dd><a href={v.documentLink} target="_blank" rel="noopener noreferrer">{v.documentLink}</a></dd>
              {v.websiteUrl && <><dt>Website</dt><dd><a href={v.websiteUrl} target="_blank" rel="noopener noreferrer">{v.websiteUrl}</a></dd></>}
              {v.notes && <><dt>Notes</dt><dd>{v.notes}</dd></>}
              {v.rejectionReason && <><dt>Rejected because</dt><dd>{v.rejectionReason}</dd></>}
              {v.reviewedAt && <><dt>Reviewed</dt><dd>{when(v.reviewedAt)}</dd></>}
              {v.blockchainHash && <><dt>Fingerprint</dt><dd style={{ fontFamily: "monospace", fontSize: 11 }}>{v.blockchainHash}</dd></>}
            </dl>
            {status === "pending" && (
              <>
                <ul className="admin-checklist">
                  <li>Look the number up{lookup && <> on the <a href={lookup.url} target="_blank" rel="noopener noreferrer">{lookup.label}</a></>} and check the registered name matches “{v.companyName}”.</li>
                  <li>Open the document: the name, number and address should match, and it shouldn't look edited.</li>
                  <li>Check the website (if given) shows the same business and a real contact address.</li>
                  <li>An ISBN alone does not prove a publisher is trustworthy; it only shows the number was issued.</li>
                </ul>
                <div className="admin-actions">
                  <button className="admin-btn ok" onClick={() => approve(u)}>Approve</button>
                  <button className="admin-btn danger" onClick={() => reject(u)}>Reject…</button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </>
  );
};

// ───────────────────────── Content moderation ─────────────────────────
const STATUS_TONE = { published: "good", archived: "bad", declined: "bad", draft: "", under_review: "warn", seen: "warn", cost_proposed: "info" };

const ContentTab = ({ initialFlagged }) => {
  const [filters, setFilters] = useState({ search: "", status: "", flagged: initialFlagged ? "true" : "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [threshold, setThreshold] = useState(20);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    axios.get(`${BASE_URL}/api/admin/books`, { params })
      .then((r) => { setRows(r.data.data); setPages(r.data.pages); setThreshold(r.data.plagiarismThreshold); setError(""); })
      .catch((e) => setError(errorOf(e, "Could not load books.")));
  }, [filters, page]);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const unpublish = async (b) => {
    const reason = window.prompt(`Unpublish "${b.title}"? Readers who bought it keep their record.\n\nReason (the author will see it):`);
    if (!reason || !reason.trim()) return;
    try { await axios.post(`${BASE_URL}/api/admin/books/${b._id}/unpublish`, { reason }); load(); }
    catch (e) { alert(errorOf(e, "Could not unpublish.")); }
  };
  const remove = async (b) => {
    const reason = window.prompt(`PERMANENTLY delete "${b.title}"? This can't be undone.\n\nReason (the author will see it):`);
    if (!reason || !reason.trim()) return;
    try { await axios.delete(`${BASE_URL}/api/admin/books/${b._id}`, { data: { reason } }); load(); }
    catch (e) { alert(errorOf(e, "Could not delete.")); }
  };
  const set = (key) => (e) => { setPage(1); setFilters((f) => ({ ...f, [key]: e.target.value })); };

  return (
    <>
      <Heading title="Content moderation" text="Find books and manuscripts that need action, and take them down with a reason." />
      <div className="admin-toolbar">
        <input className="input-field" placeholder="Search title" value={filters.search} onChange={set("search")} />
        <select className="input-field" value={filters.status} onChange={set("status")}>
          <option value="">Any status</option>
          {["published", "draft", "under_review", "seen", "cost_proposed", "declined", "archived"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={filters.flagged === "true"} onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, flagged: e.target.checked ? "true" : "" })); }} />
          Flagged for similarity (≥ {threshold}%)
          <HelpTip title="Similarity flag" text="The plagiarism scan compares a manuscript against other books on BookConnect only. A high score means it is very similar to another book here; it is a lead to check, not proof of copying." />
        </label>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="glass-panel admin-table-wrap" style={{ padding: 0 }}>
        <table className="admin-table">
          <thead><tr><th>Title</th><th>Author</th><th>Status</th><th>Price</th><th>Similarity</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ color: "var(--text-muted)" }}>No books match.</td></tr>}
            {rows.map((b) => (
              <tr key={b._id}>
                <td>{b.title}</td>
                <td>{b.author?.name || "—"}</td>
                <td><Pill tone={STATUS_TONE[b.status]}>{b.status.replace("_", " ")}</Pill></td>
                <td>{b.isPaid ? money(b.price) : "Free"}</td>
                <td>
                  {b.plagiarismScore == null ? "—" : (
                    <span title={(b.plagiarismMatches || []).map((m) => `${m.title} (${m.similarity}%)`).join(", ")}>
                      <Pill tone={b.plagiarismScore >= threshold ? "bad" : "good"}>{b.plagiarismScore}%</Pill>
                    </span>
                  )}
                </td>
                <td>{when(b.updatedAt)}</td>
                <td>
                  <div className="admin-actions">
                    {b.status === "published" && <button className="admin-btn danger" onClick={() => unpublish(b)}>Unpublish</button>}
                    <button className="admin-btn danger" onClick={() => remove(b)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
};

// ───────────────────────── Transactions ─────────────────────────
const TransactionsTab = () => {
  const [filters, setFilters] = useState({ type: "", status: "", onChain: "" });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = { page, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
    axios.get(`${BASE_URL}/api/admin/transactions`, { params })
      .then((r) => { setRows(r.data.data); setPages(r.data.pages); setTotal(r.data.total); setTotalAmount(r.data.totalAmount); setError(""); })
      .catch((e) => setError(errorOf(e, "Could not load payments.")));
  }, [filters, page]);

  const set = (key) => (e) => { setPage(1); setFilters((f) => ({ ...f, [key]: e.target.value })); };

  return (
    <>
      <Heading title="Payments" text="Every payment on the platform. This list is read-only." />
      <div className="admin-toolbar">
        <select className="input-field" value={filters.type} onChange={set("type")}>
          <option value="">All types</option>
          <option value="book_purchase">Book purchase</option>
          <option value="publishing_fee">Publishing fee</option>
          <option value="p2p_transfer">Transfer</option>
        </select>
        <select className="input-field" value={filters.status} onChange={set("status")}>
          <option value="">Any status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select className="input-field" value={filters.onChain} onChange={set("onChain")}>
          <option value="">On-chain or not</option>
          <option value="true">On-chain only</option>
          <option value="false">In-app only</option>
        </select>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{total} payments · {money(totalAmount)}</span>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="glass-panel admin-table-wrap" style={{ padding: 0 }}>
        <table className="admin-table">
          <thead><tr><th>When</th><th>Type</th><th>From</th><th>To</th><th>Amount</th><th>Status</th><th>On-chain</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ color: "var(--text-muted)" }}>No payments match.</td></tr>}
            {rows.map((t) => (
              <tr key={t._id}>
                <td>{when(t.createdAt)}</td>
                <td>{t.type.replace("_", " ")}</td>
                <td>{t.sender?.name || "—"}</td>
                <td>{t.receiver?.name || "—"}</td>
                <td>{money(t.amount)}</td>
                <td><Pill tone={t.status === "completed" ? "good" : t.status === "failed" ? "bad" : "warn"}>{t.status}</Pill></td>
                <td>
                  {t.onChain
                    ? <Pill tone="info">{t.network || "sepolia"}</Pill>
                    : <span style={{ color: "var(--text-muted)" }}>no</span>}
                  {t.onChain && t.txHash && <div style={{ fontFamily: "monospace", fontSize: 10, color: "var(--text-muted)" }}>{t.txHash.slice(0, 14)}…</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
};

// ───────────────────────── Health ─────────────────────────
const HealthTab = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    axios.get(`${BASE_URL}/api/admin/health`)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(errorOf(e, "Could not load health.")));
  }, []);

  if (error) return <p style={{ color: "var(--danger)" }}>{error}</p>;
  if (!data) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  const tiles = [
    ["Publishers awaiting verification", data.pendingVerifications],
    ["Awaiting a publisher's review", data.awaitingReview],
    ["Offers waiting for the author", data.openOffers],
    ["Declined submissions", data.declined],
    ["Failed payments", data.failedPayments],
    [`Flagged manuscripts (≥ ${data.plagiarismThreshold}%)`, data.flaggedManuscripts],
  ];

  return (
    <>
      <Heading title="Platform health" text="Things that are stuck or have gone wrong." />
      <div className="admin-grid">
        {tiles.map(([label, n]) => (
          <div key={label} className={`admin-attention ${n > 0 ? "hot" : ""}`} style={{ cursor: "default" }}>
            <strong>{n}</strong><span>{label}</span>
          </div>
        ))}
      </div>

      <div className="glass-panel admin-card">
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Submissions waiting more than 14 days</h3>
        {data.stuckSubmissions.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}><CheckCircle size={14} /> None. Nothing is stuck.</p>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Author</th><th>Publisher</th><th>Status</th><th>Last change</th></tr></thead>
            <tbody>
              {data.stuckSubmissions.map((b) => (
                <tr key={b._id}><td>{b.title}</td><td>{b.author?.name}</td><td>{b.publisher?.name}</td><td><Pill tone="warn">{b.status.replace("_", " ")}</Pill></td><td>{when(b.updatedAt)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="glass-panel admin-card">
        <h3 style={{ fontSize: 14, margin: "0 0 10px" }}>Failed payments</h3>
        {data.failedTransactions.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 6, alignItems: "center" }}><CheckCircle size={14} /> None.</p>
        ) : (
          <table className="admin-table">
            <thead><tr><th>When</th><th>Type</th><th>From</th><th>To</th><th>Amount</th></tr></thead>
            <tbody>
              {data.failedTransactions.map((t) => (
                <tr key={t._id}><td>{when(t.createdAt)}</td><td>{t.type.replace("_", " ")}</td><td>{t.sender?.name}</td><td>{t.receiver?.name}</td><td>{money(t.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

// ───────────────────────── Audit log ─────────────────────────
const AuditTab = () => {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    axios.get(`${BASE_URL}/api/admin/audit-log`, { params: { page } })
      .then((r) => { setRows(r.data.data); setPages(r.data.pages); })
      .catch((e) => setError(errorOf(e, "Could not load the log.")));
  }, [page]);

  return (
    <>
      <Heading title="Audit log" text="A permanent record of what admins did, and why." />
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="glass-panel admin-table-wrap" style={{ padding: 0 }}>
        <table className="admin-table">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>On</th><th>Details</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ color: "var(--text-muted)" }}>Nothing recorded yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r._id}>
                <td>{when(r.createdAt)}</td>
                <td>{r.admin?.name || "—"}</td>
                <td><Pill>{r.action}</Pill></td>
                <td>{r.targetLabel || r.targetId}</td>
                <td>{r.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
};

// ───────────────────────── Shell ─────────────────────────
const TABS = [
  { id: "overview", label: "Overview", icon: BarChart2 },
  { id: "users", label: "Users", icon: Users },
  { id: "verification", label: "Publisher verification", icon: Shield },
  { id: "content", label: "Content", icon: FileWarning },
  { id: "transactions", label: "Payments", icon: DollarSign },
  { id: "health", label: "Platform health", icon: Activity },
  { id: "audit", label: "Audit log", icon: ScrollText },
];

const AdminDashboard = ({ user, onLogout }) => {
  const [tab, setTab] = useState("overview");
  const [flaggedFirst, setFlaggedFirst] = useState(false);

  const go = (id, hint) => {
    setFlaggedFirst(hint === "flagged");
    setTab(id);
  };

  return (
    <div className="dashboard-wrapper">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo"><BookOpen size={22} /><span>BookConnect</span></div>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar" style={{ background: "var(--danger)" }}>{user?.name?.[0]?.toUpperCase()}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-role-badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>Admin</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {TABS.map(({ id, label, icon }) => (
            <button key={id} className={`sidebar-link ${tab === id ? "active" : ""}`} onClick={() => go(id)}>
              {React.createElement(icon, { size: 18 })}<span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="sidebar-logout" onClick={onLogout}><LogOut size={16} /><span>Sign out</span></button>
      </aside>

      <div className="dashboard-main">
        <header className="dash-topbar" style={{ justifyContent: "flex-end", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={14} /> Admin actions are recorded in the audit log
          </span>
          <ThemeToggle />
        </header>
        <div className="dash-content animate-fade-in">
          {tab === "overview" && <Overview go={go} />}
          {tab === "users" && <UsersTab />}
          {tab === "verification" && <VerificationTab />}
          {tab === "content" && <ContentTab key={String(flaggedFirst)} initialFlagged={flaggedFirst} />}
          {tab === "transactions" && <TransactionsTab />}
          {tab === "health" && <HealthTab />}
          {tab === "audit" && <AuditTab />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
