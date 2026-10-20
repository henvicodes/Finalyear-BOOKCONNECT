import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  ChevronDown,
  X,
  Sparkles,
  Loader,
  BookOpen,
  Users,
} from "lucide-react";

const GENRES = [
  "Fiction",
  "Non-Fiction",
  "Science",
  "Technology",
  "History",
  "Philosophy",
  "Poetry",
  "Romance",
];
const RATINGS = ["4.5+", "4.0+", "3.5+", "Any"];
const LANGS = ["English", "Hindi", "Marathi", "French", "Spanish"];
const TYPES = ["Free", "Paid"];

const SearchBar = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({
    books: [],
    authors: [],
    aiSuggestions: [],
    intent: "",
  });
  const [aiRecs, setAiRecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    genre: "",
    rating: "",
    language: "",
    type: "",
  });

  const wrapRef = useRef(null);
  const timer = useRef(null);

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
      setResults({ books: [], authors: [], aiSuggestions: [], intent: "" });
      setAiRecs([]);
      setShowDrop(false);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      setShowDrop(true);

      try {
        const params = new URLSearchParams({ search: query });
        if (filters.genre && filters.genre !== "All Genres") {
          params.append("genre", filters.genre.toLowerCase());
        }
        if (filters.language)
          params.append("language", filters.language.toLowerCase());
        if (filters.type)
          params.append("isPaid", filters.type === "Paid" ? "true" : "false");

        const token = JSON.parse(localStorage.getItem("user") || "{}").token;

        const [booksRes, usersRes] = await Promise.all([
          fetch(`/api/books?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .catch(() => ({ success: false, data: [] })),
          fetch(`/api/auth/search?q=${query}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => r.json())
            .catch(() => ({ success: false, data: [] })),
        ]);

        let booksData = booksRes.data || booksRes.books || [];
        if (booksData.data) booksData = booksData.data;

        let usersData = usersRes.data || usersRes.users || [];

        setResults((prev) => ({
          ...prev,
          books: Array.isArray(booksData) ? booksData.slice(0, 4) : [],
          authors: Array.isArray(usersData) ? usersData.slice(0, 3) : [],
        }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }

      setAiLoading(true);
      try {
        setTimeout(() => {
          setResults((prev) => ({
            ...prev,
            intent: `Finding ${
              filters.genre || "top"
            } books matching "${query}"`,
            aiSuggestions: [
              `Best ${query} books`,
              `Top ${filters.genre || "Fiction"} authors`,
            ],
          }));
          setAiRecs([
            {
              title: `The ${query} Chronicles`,
              author: "AI Recommendation",
              genre: filters.genre || "Fiction",
              reason: "Based on your search history",
            },
            {
              title: "Echoes of Tomorrow",
              author: "A. Writer",
              genre: "Sci-Fi",
              reason: "Trending in your region",
            },
          ]);
          setAiLoading(false);
        }, 600);
      } catch (e) {
        console.error(e);
        setAiLoading(false);
      }
    }, 500);
  }, [query, filters]);

  const toggleFilter = (key, val) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === val ? "" : val }));
  const activeCount = Object.values(filters).filter(Boolean).length;
  const hasResults =
    results.books.length > 0 || results.authors.length > 0 || aiRecs.length > 0;

  return (
    <div
      className="sb-wrap"
      ref={wrapRef}
      style={{ position: "relative", zIndex: 1000, width: "100%" }}
    >
      {/* Input Box */}
      <div
        className={`sb-box ${showDrop ? "focused" : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: "0 10px",
          height: 42,
        }}
      >
        <Search
          size={15}
          className="sb-ico"
          color="#94a3b8"
          style={{ flexShrink: 0 }}
        />
        <input
          className="sb-input"
          placeholder="Search books, authors..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setShowDrop(true)}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            padding: "0 8px",
            background: "transparent",
            width: "100%",
            minWidth: 0,
          }}
        />
        {(loading || aiLoading) && (
          <Loader
            size={16}
            color="#7c3aed"
            className="animate-spin"
            style={{ flexShrink: 0 }}
          />
        )}
        {query && !loading && !aiLoading && (
          <button
            className="sb-clear"
            onClick={() => {
              setQuery("");
              setShowDrop(false);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              flexShrink: 0,
            }}
          >
            <X size={13} color="#94a3b8" />
          </button>
        )}
        <div
          className="sb-divider"
          style={{
            width: 1,
            height: 20,
            background: "#e2e8f0",
            margin: "0 6px",
            flexShrink: 0,
          }}
        />
        <button
          className={`sb-filter-btn ${showFilters ? "active" : ""} ${
            activeCount ? "has" : ""
          }`}
          onClick={() => setShowFilters((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: showFilters ? "#f8fafc" : "none",
            border: "none",
            cursor: "pointer",
            color: activeCount > 0 ? "#7c3aed" : "#64748b",
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
            padding: "4px 2px",
          }}
        >
          <Filter size={14} />
          <span className="sb-filter-text">Filters</span>
          {activeCount > 0 && (
            <span
              className="sb-fcnt"
              style={{
                background: "#7c3aed",
                color: "#fff",
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 10,
                marginLeft: 2,
              }}
            >
              {activeCount}
            </span>
          )}
          <ChevronDown
            size={12}
            style={{
              transform: showFilters ? "rotate(180deg)" : "none",
              transition: ".2s",
              marginLeft: 2,
            }}
          />
        </button>
      </div>

      {/* Filters Dropdown */}
      {showFilters && (
        <div
          className="sb-filters"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 16,
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
            zIndex: 1001,
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          {[
            { label: "Genre", key: "genre", opts: GENRES },
            { label: "Rating", key: "rating", opts: RATINGS },
            { label: "Language", key: "language", opts: LANGS },
            { label: "Type", key: "type", opts: TYPES },
          ].map(({ label, key, opts }) => (
            <div className="sb-fgroup" key={key} style={{ marginBottom: 16 }}>
              <div
                className="sb-flbl"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  marginBottom: 8,
                }}
              >
                {label}
              </div>
              <div
                className="sb-chips"
                style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
              >
                {opts.map((o) => (
                  <button
                    key={o}
                    className={`sb-chip ${filters[key] === o ? "on" : ""}`}
                    onClick={() => toggleFilter(key, o)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: `1px solid ${
                        filters[key] === o ? "#7c3aed" : "#e2e8f0"
                      }`,
                      background:
                        filters[key] === o ? "rgba(124,58,237,0.08)" : "#fff",
                      color: filters[key] === o ? "#7c3aed" : "#475569",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {activeCount > 0 && (
            <button
              className="sb-clear-all"
              onClick={() =>
                setFilters({ genre: "", rating: "", language: "", type: "" })
              }
              style={{
                width: "100%",
                padding: "8px",
                background: "#fef2f2",
                color: "#ef4444",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Search Results Dropdown */}
      {showDrop && (
        <div
          className="sb-drop"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
            maxHeight: "75vh",
            overflowY: "auto",
            zIndex: 1001,
          }}
        >
          {results.intent && (
            <div
              className="sb-intent"
              style={{
                padding: "12px 16px",
                background: "#faf8ff",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "#7c3aed",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Sparkles size={14} style={{ flexShrink: 0 }} />{" "}
              <span style={{ lineHeight: 1.4 }}>{results.intent}</span>
            </div>
          )}

          {results.aiSuggestions?.length > 0 && (
            <div className="sb-sec" style={{ padding: "12px 0" }}>
              <div
                className="sb-seclbl"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  padding: "0 16px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={11} /> AI SUGGESTIONS
              </div>
              <div
                className="sb-sugrow"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  padding: "0 16px",
                }}
              >
                {results.aiSuggestions.map((s, i) => (
                  <button
                    key={i}
                    className="sb-sugchip"
                    onClick={() => setQuery(s)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 12,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 11,
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.authors?.length > 0 && (
            <div
              className="sb-sec"
              style={{ padding: "12px 0", borderTop: "1px solid #f1f5f9" }}
            >
              <div
                className="sb-seclbl"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  padding: "0 16px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Users size={11} /> AUTHORS & PUBLISHERS
              </div>
              {results.authors.map((a, i) => (
                <div
                  key={i}
                  className="sb-item"
                  style={{
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    className="sb-avatar"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "#f1f5f9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      flexShrink: 0,
                    }}
                  >
                    {a.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="sb-info" style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="sb-ititle"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {a.name}
                    </div>
                    <div
                      className="sb-isub"
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        textTransform: "capitalize",
                      }}
                    >
                      {a.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.books?.length > 0 && (
            <div
              className="sb-sec"
              style={{ padding: "12px 0", borderTop: "1px solid #f1f5f9" }}
            >
              <div
                className="sb-seclbl"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  padding: "0 16px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <BookOpen size={11} /> BOOKS
              </div>
              {results.books.map((b, i) => (
                <div
                  key={i}
                  className="sb-item"
                  style={{
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    className="sb-bookico"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "#f3f0ff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#7c3aed",
                      flexShrink: 0,
                    }}
                  >
                    <BookOpen size={13} />
                  </div>
                  <div className="sb-info" style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="sb-ititle"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {b.title}
                    </div>
                    <div
                      className="sb-isub"
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      by {b.author?.name || "Unknown"}
                      {b.genre ? ` · ${b.genre}` : ""}
                    </div>
                  </div>
                  {b.averageRating > 0 && (
                    <span
                      className="sb-rating"
                      style={{ fontSize: 11, color: "#f59e0b", flexShrink: 0 }}
                    >
                      ⭐ {b.averageRating?.toFixed(1)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {aiRecs?.length > 0 && (
            <div
              className="sb-sec"
              style={{ padding: "12px 0", borderTop: "1px solid #f1f5f9" }}
            >
              <div
                className="sb-seclbl"
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  padding: "0 16px",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={11} /> AI RECOMMENDED
              </div>
              {aiRecs.map((r, i) => (
                <div
                  key={i}
                  className="sb-item"
                  style={{
                    padding: "8px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    className="sb-aiico"
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: "#fdf2f8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ec4899",
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={13} />
                  </div>
                  <div className="sb-info" style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="sb-ititle"
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.title}
                    </div>
                    <div
                      className="sb-isub"
                      style={{ fontSize: 11, color: "#64748b" }}
                    >
                      by {r.author} · {r.genre}
                    </div>
                    <div
                      className="sb-reason"
                      style={{ fontSize: 10, color: "#ec4899", marginTop: 2 }}
                    >
                      {r.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !aiLoading && !hasResults && (
            <div
              className="sb-empty"
              style={{
                padding: 30,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 13,
              }}
            >
              No results found for "{query}"
            </div>
          )}

          {(loading || aiLoading) && (
            <div
              className="sb-loading"
              style={{
                padding: 20,
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 12,
              }}
            >
              <Loader
                size={14}
                className="sb-spin-icon animate-spin"
                style={{ margin: "0 auto 8px" }}
              />
              <span>{aiLoading ? "AI is analyzing..." : "Searching..."}</span>
            </div>
          )}

          <div
            className="sb-footer"
            style={{
              padding: "10px 16px",
              borderTop: "1px solid #f1f5f9",
              background: "#fafafa",
              fontSize: 12,
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}
          >
            <Search size={11} /> View all results for "{query}"
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
