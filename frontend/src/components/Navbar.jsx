import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen, Menu, X, User, ChevronDown, Settings, LogOut,
  Search, Filter, Sparkles, Loader, Users
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const GENRES = ["Fiction","Non-Fiction","Science","Technology","History","Poetry","Romance","Thriller"];
const TYPES  = ["Free","Paid"];

// ── Search Bar ────────────────────────────────────────────────────────────────
const SearchBar = () => {
  const [query, setQuery]             = useState("");
  const [books, setBooks]             = useState([]);
  const [authors, setAuthors]         = useState([]);
  const [aiRecs, setAiRecs]           = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [intent, setIntent]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [aiLoading, setAiLoading]     = useState(false);
  const [showDrop, setShowDrop]       = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters]         = useState({ genre: "", type: "" });
  const navigate = useNavigate();
  const wrapRef  = useRef(null);
  const timer    = useRef(null);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setShowDrop(false);
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setBooks([]); setAuthors([]); setAiRecs([]);
      setAiSuggestions([]); setIntent("");
      setShowDrop(false); return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true); setShowDrop(true);
      try {
        const params = new URLSearchParams({ search: query, limit: 4 });
        if (filters.genre) params.append("genre", filters.genre.toLowerCase());
        if (filters.type)  params.append("isPaid", filters.type === "Paid" ? "true" : "false");
        const token = JSON.parse(localStorage.getItem("user") || "{}").token;
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const [booksRes, usersRes] = await Promise.all([
          fetch(`${BASE_URL}/api/books?${params}`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
          fetch(`${BASE_URL}/api/auth/search?q=${query}`, { headers }).then(r => r.json()).catch(() => ({ data: [] })),
        ]);
        setBooks(booksRes.data?.slice(0, 4) || []);
        setAuthors(usersRes.data?.slice(0, 3) || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }

      // AI recommendations
      setAiLoading(true);
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 500,
            messages: [{
              role: "user",
              content: `You are a book recommendation assistant for BookConnect, an Indian digital publishing platform.
User searched: "${query}". Filters: ${JSON.stringify(filters)}.
Reply ONLY valid JSON (no markdown):
{"intent":"one sentence what user wants","suggestions":["s1","s2","s3"],"recommendations":[{"title":"T","author":"A","genre":"G","reason":"R"},{"title":"T","author":"A","genre":"G","reason":"R"}]}`
            }]
          })
        });
        const data   = await res.json();
        const text   = data.content?.[0]?.text?.replace(/```json|```/g, "").trim() || "{}";
        const parsed = JSON.parse(text);
        setIntent(parsed.intent || "");
        setAiSuggestions(parsed.suggestions || []);
        setAiRecs(parsed.recommendations || []);
      } catch (e) { console.error(e); }
      finally { setAiLoading(false); }
    }, 500);
  }, [query, filters]);

  const toggleFilter = (key, val) =>
    setFilters(prev => ({ ...prev, [key]: prev[key] === val ? "" : val }));

  const activeCount = Object.values(filters).filter(Boolean).length;
  const hasResults  = books.length > 0 || authors.length > 0 || aiRecs.length > 0;

  const handleBookClick = (bookId) => {
    navigate(`/books/${bookId}`);
    setShowDrop(false); setQuery("");
  };

  const handleSearchAll = () => {
    navigate(`/books?search=${encodeURIComponent(query)}`);
    setShowDrop(false);
  };

  return (
    <div className="sb-wrap" ref={wrapRef}>
      {/* Input row */}
      <div className={`sb-box ${showDrop ? "focused" : ""}`}>
        <Search size={14} className="sb-ico" />
        <input
          className="sb-input"
          placeholder="Search books, authors, genres..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setShowDrop(true)}
          onKeyDown={e => e.key === "Enter" && handleSearchAll()}
        />
        {(loading || aiLoading) && <span className="sb-spin" />}
        {query && !loading && !aiLoading && (
          <button className="sb-clear" onClick={() => { setQuery(""); setShowDrop(false); }}>
            <X size={12} />
          </button>
        )}
        <div className="sb-divider" />
        <button
          className={`sb-filter-btn ${showFilters ? "active" : ""} ${activeCount ? "has" : ""}`}
          onClick={() => setShowFilters(p => !p)}
        >
          <Filter size={11} /> Filters
          {activeCount > 0 && <span className="sb-fcnt">{activeCount}</span>}
          <ChevronDown size={10} style={{ transform: showFilters ? "rotate(180deg)" : "none", transition: ".2s" }} />
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="sb-filters">
          <div className="sb-fgroup">
            <div className="sb-flbl">Genre</div>
            <div className="sb-chips">
              {GENRES.map(o => (
                <button key={o} className={`sb-chip ${filters.genre === o ? "on" : ""}`} onClick={() => toggleFilter("genre", o)}>{o}</button>
              ))}
            </div>
          </div>
          <div className="sb-fgroup">
            <div className="sb-flbl">Type</div>
            <div className="sb-chips">
              {TYPES.map(o => (
                <button key={o} className={`sb-chip ${filters.type === o ? "on" : ""}`} onClick={() => toggleFilter("type", o)}>{o}</button>
              ))}
            </div>
          </div>
          {activeCount > 0 && (
            <button className="sb-clear-all" onClick={() => setFilters({ genre: "", type: "" })}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Dropdown results */}
      {showDrop && (
        <div className="sb-drop">
          {intent && (
            <div className="sb-intent"><Sparkles size={11} /><span>{intent}</span></div>
          )}

          {aiSuggestions.length > 0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><Sparkles size={10} /> AI suggestions</div>
              <div className="sb-sugrow">
                {aiSuggestions.map((s, i) => (
                  <button key={i} className="sb-sugchip" onClick={() => setQuery(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {authors.length > 0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><Users size={10} /> Authors & Publishers</div>
              {authors.map((a, i) => (
                <div key={i} className="sb-item">
                  <div className="sb-avatar">{a.name?.charAt(0).toUpperCase()}</div>
                  <div className="sb-info">
                    <div className="sb-ititle">{a.name}</div>
                    <div className="sb-isub">{a.role}</div>
                  </div>
                  <span className="sb-badge-a">{a.role}</span>
                </div>
              ))}
            </div>
          )}

          {books.length > 0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><BookOpen size={10} /> Books</div>
              {books.map((b, i) => (
                <div key={i} className="sb-item sb-item-click" onClick={() => handleBookClick(b._id)}>
                  <div className="sb-bookico">
                    {b.coverImage && b.coverImage !== "default-cover.jpg"
                      ? <img src={b.coverImage} alt={b.title} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 4 }} />
                      : <BookOpen size={13} />}
                  </div>
                  <div className="sb-info">
                    <div className="sb-ititle">{b.title}</div>
                    <div className="sb-isub">
                      by {b.author?.name || "Unknown"}{b.genre ? ` · ${b.genre}` : ""}{b.isPaid ? " · Paid" : " · Free"}
                    </div>
                  </div>
                  {b.averageRating > 0 && <span className="sb-rating">⭐ {b.averageRating?.toFixed(1)}</span>}
                </div>
              ))}
            </div>
          )}

          {aiRecs.length > 0 && (
            <div className="sb-sec">
              <div className="sb-seclbl"><Sparkles size={10} /> AI recommended</div>
              {aiRecs.map((r, i) => (
                <div key={i} className="sb-item">
                  <div className="sb-aiico"><Sparkles size={13} /></div>
                  <div className="sb-info">
                    <div className="sb-ititle">{r.title}</div>
                    <div className="sb-isub">by {r.author} · {r.genre}</div>
                    <div className="sb-reason">{r.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !aiLoading && !hasResults && (
            <div className="sb-empty">No results found for "{query}"</div>
          )}

          {(loading || aiLoading) && (
            <div className="sb-loading">
              <Loader size={13} className="sb-spin-icon" />
              <span>{aiLoading ? "AI is thinking..." : "Searching..."}</span>
            </div>
          )}

          <button className="sb-footer" onClick={handleSearchAll}>
            <Search size={11} /> See all results for "{query}"
          </button>
        </div>
      )}
    </div>
  );
};

// ── Navbar ────────────────────────────────────────────────────────────────────
const Navbar = () => {
  const [isOpen, setIsOpen]       = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate    = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => { logout(); setProfileOpen(false); navigate("/"); };

  const getRoleBadgeColor = () => ({
    author: "#059669", publisher: "#7c3aed", reader: "#2563eb", admin: "#dc2626"
  }[user?.role] || "#2563eb");

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <BookOpen /><span>BookConnect</span>
        </Link>

        {/* Search bar — center */}
        <div className="navbar-search">
          <SearchBar />
        </div>

        <button className="mobile-menu-btn" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>

        <ul className={`navbar-menu ${isOpen ? "active" : ""}`}>
          <li><Link to="/"      onClick={() => setIsOpen(false)}>Home</Link></li>
          <li><Link to="/books" onClick={() => setIsOpen(false)}>Books</Link></li>
          <li><Link to="/about" onClick={() => setIsOpen(false)}>About</Link></li>

          {isAuthenticated ? (
            <>
              <li><Link to="/dashboard" onClick={() => setIsOpen(false)}>Dashboard</Link></li>
              <li className="profile-menu-item" ref={dropdownRef}>
                <button className="btn-profile-trigger" onClick={() => setProfileOpen(!profileOpen)}>
                  <div className="profile-avatar-sm">
                    {user?.profilePicture && user.profilePicture !== "default-avatar.png"
                      ? <img src={user.profilePicture} alt={user.name} />
                      : <span>{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>}
                  </div>
                  <span className="profile-name-short">{user?.name?.split(" ")[0]}</span>
                  <ChevronDown size={14} className={`chevron ${profileOpen ? "open" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="profile-dropdown">
                    <div className="dropdown-header">
                      <div className="dropdown-avatar">
                        {user?.profilePicture && user.profilePicture !== "default-avatar.png"
                          ? <img src={user.profilePicture} alt={user.name} />
                          : <span>{user?.name?.charAt(0)?.toUpperCase() || "U"}</span>}
                      </div>
                      <div className="dropdown-user-info">
                        <span className="dropdown-name">{user?.name}</span>
                        <span className="dropdown-role-badge" style={{ background: getRoleBadgeColor() }}>{user?.role}</span>
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <Link to="/profile" className="dropdown-item" onClick={() => { setProfileOpen(false); setIsOpen(false); }}>
                      <User size={15} /><span>My Profile</span>
                    </Link>
                    <Link to="/profile/edit" className="dropdown-item" onClick={() => { setProfileOpen(false); setIsOpen(false); }}>
                      <Settings size={15} /><span>Edit Profile</span>
                    </Link>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item danger" onClick={handleLogout}>
                      <LogOut size={15} /><span>Logout</span>
                    </button>
                  </div>
                )}
              </li>
            </>
          ) : (
            <>
              <li><Link to="/login"    onClick={() => setIsOpen(false)}><button className="btn-login">Login</button></Link></li>
              <li><Link to="/register" onClick={() => setIsOpen(false)}><button className="btn-register">Register</button></Link></li>
            </>
          )}
        </ul>
      </div>

      {/* Mobile search */}
      <div className="navbar-search-mobile">
        <SearchBar />
      </div>
    </nav>
  );
};

export default Navbar;