import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";
import StatBubble from "./StatBubble.jsx";
import VerificationBanner from "./VerificationBanner.jsx";
import { useBooks } from "../../hooks/useBooks.js";
import "../../styles/ProfilePage.css";

const PublisherProfileContent = ({ user }) => {
  const navigate = useNavigate();
  const { books: publishedBooks, loading } = useBooks({
    status: "published",
    limit: 6,
    sort: "-createdAt",
  });

  return (
    <>
      {/* Stats */}
      <div className="profile-stats-row">
        <StatBubble
          icon={<Users size={20} />}
          value="4"
          label="Authors"
          color="indigo"
        />
        <StatBubble
          icon={<BookOpen size={20} />}
          value={String(publishedBooks.length || "—")}
          label="Published"
          color="teal"
        />
        <StatBubble
          icon={<Clock size={20} />}
          value="2"
          label="Active"
          color="pink"
        />
        <StatBubble
          icon={<TrendingUp size={20} />}
          value="₹2.4K"
          label="Royalties"
          color="yellow"
        />
      </div>

      {/* Verification Component */}
      {user?.isVerified && <VerificationBanner />}

      {/* Active catalog */}
      <section className="profile-section">
        <div className="section-header-row">
          <h3 className="profile-section-title">
            <BookOpen size={16} /> Publication Catalog
          </h3>
          <Link to="/publisher/requests" className="btn-section-action">
            Review Submissions
          </Link>
        </div>

        <div className="project-list">
          {loading && (
            <p style={{ color: "#64748b", fontSize: 14 }}>Loading...</p>
          )}
          {!loading && publishedBooks.length === 0 && (
            <p style={{ color: "#64748b", fontSize: 14 }}>
              No books in catalog yet.
            </p>
          )}
          {!loading &&
            publishedBooks.map((book) => (
              <div
                key={book._id}
                className="project-item"
                onClick={() => navigate(`/books/${book._id}`)}
                style={{ cursor: "pointer" }}
              >
                <div className="project-info">
                  <span className="project-title">{book.title}</span>
                  <span className="project-meta">
                    by {book.author?.name || "Unknown Author"} · {book.genre}
                  </span>
                </div>
                <span className="phase-badge phase--published">Published</span>
              </div>
            ))}
        </div>
      </section>

      {/* Authors Network CTA */}
      <section className="profile-section">
        <div className="section-header-row">
          <h3 className="profile-section-title">
            <Users size={16} /> Authors Network
          </h3>
          <Link to="/publisher/discover" className="btn-section-action">
            Discover +
          </Link>
        </div>
        <div className="authors-network-placeholder">
          <div className="placeholder-icon">
            <Users size={32} />
          </div>
          <h4>Expand your catalog</h4>
          <p>
            Discover talented authors on the platform and invite them to publish
            with you.
          </p>
        </div>
      </section>
    </>
  );
};

export default PublisherProfileContent;
