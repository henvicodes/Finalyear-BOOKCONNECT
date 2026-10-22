import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, RefreshCw, MessageCircle, Sparkles } from "lucide-react";
import api from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import "../../styles/RecommendationsPage.css";

const ROLE_LABEL = { author: "Author", publisher: "Publisher", reader: "Reader" };

const MatchCard = ({ match }) => {
  const { user: u, score, reason } = match;
  return (
    <div className="match-card">
      <div className="match-card-top">
        <div className="match-avatar">
          {u.profilePicture && u.profilePicture !== "default-avatar.png" ? (
            <img src={u.profilePicture} alt={u.name} />
          ) : (
            <span>{u.name?.charAt(0)?.toUpperCase() || "U"}</span>
          )}
        </div>
        <div className="match-info">
          <span className="match-name">{u.name}</span>
          <span className="match-role">{ROLE_LABEL[u.role] || u.role}</span>
        </div>
        {score !== null && (
          <span className="match-score" title="Cosine similarity between your profiles">
            {Math.round(score * 100)}%
          </span>
        )}
      </div>
      <p className="match-bio">{u.bio || reason}</p>
      {u.interests?.length > 0 && (
        <div className="match-tags">
          {u.interests.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      )}
      <Link to="/dashboard" className="match-message-btn">
        <MessageCircle size={14} /> Message
      </Link>
    </div>
  );
};

const ReaderWriterMatchingPage = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMatches = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/matching");
      if (data.success) {
        setItems(data.data);
        setPersonalized(data.personalized);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  return (
    <div className="recs-page">
      <div className="container">
        <div className="recs-header">
          <div className="recs-header-icon">
            {personalized ? <Sparkles size={22} /> : <Users size={22} />}
          </div>
          <div>
            <h1>Reader-Writer Matching</h1>
            <p>
              {personalized
                ? `Profile-similarity matches ranked for you as a ${user?.role || "member"} — your bio, interests, and reading/publishing history against theirs.`
                : "Add a bio or a few interests to your profile to get ranked matches with authors, readers, and publishers."}
            </p>
          </div>
          <button className="recs-refresh-btn" onClick={fetchMatches} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="recs-loading">
            <div className="spinner" />
            <p>Scoring profiles against yours...</p>
          </div>
        ) : error ? (
          <div className="recs-empty">
            <p>{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="recs-empty">
            <Users size={40} />
            <h3>No matches yet</h3>
            <p>Check back once more people have joined BookConnect.</p>
          </div>
        ) : (
          <div className="match-grid">
            {items.map((m) => (
              <MatchCard key={m.user._id} match={m} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReaderWriterMatchingPage;
