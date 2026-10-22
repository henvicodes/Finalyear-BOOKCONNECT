import React, { useState, useEffect } from "react";
import { Sparkles, RefreshCw, TrendingUp } from "lucide-react";
import api from "../../utils/api";
import BookCard from "../../components/books/BookCard";
import "../../styles/RecommendationsPage.css";

const PersonalizedRecommendationsPage = () => {
  const [items, setItems] = useState([]);
  const [personalized, setPersonalized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRecommendations = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/api/recommendations");
      if (data.success) {
        setItems(data.data);
        setPersonalized(data.personalized);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="recs-page">
      <div className="container">
        <div className="recs-header">
          <div className="recs-header-icon">
            {personalized ? <Sparkles size={22} /> : <TrendingUp size={22} />}
          </div>
          <div>
            <h1>{personalized ? "Picked for you" : "Trending on BookConnect"}</h1>
            <p>
              {personalized
                ? "Ranked by how closely each book's genre, tags, and description match your reading history and interests."
                : "Rate or purchase a few books and we'll start tailoring this list to your taste."}
            </p>
          </div>
          <button className="recs-refresh-btn" onClick={fetchRecommendations} disabled={loading}>
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="recs-loading">
            <div className="spinner" />
            <p>Scoring books against your profile...</p>
          </div>
        ) : error ? (
          <div className="recs-empty">
            <p>{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="recs-empty">
            <Sparkles size={40} />
            <h3>No recommendations yet</h3>
            <p>Purchase or rate a few books to help us learn what you like.</p>
          </div>
        ) : (
          <div className="recs-grid">
            {items.map(({ book, score, reason }) => (
              <div key={book._id} className="recs-card-wrap">
                <BookCard book={book} />
                <div className="recs-reason">
                  <span>{reason}</span>
                  {score !== null && (
                    <span className="recs-score" title="Cosine similarity between your taste profile and this book">
                      {Math.round(score * 100)}% match
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalizedRecommendationsPage;
