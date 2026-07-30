import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, Clock, TrendingUp } from "lucide-react";
import StatBubble from "./StatBubble.jsx";
import VerificationBanner from "./VerificationBanner.jsx";
import { useBooks } from "../../hooks/useBooks.js";
import "../../styles/ProfilePage.css";

const ProjectRow = ({ book }) => {
  const phase =
    book.status === "published"
      ? "Published"
      : book.status === "under_review"
      ? "In Review"
      : "Draft";

  const phaseClass = phase.toLowerCase().replace(" ", "-");

  return (
    <div className="project-item">
      <div className="project-info">
        <span className="project-title">{book.title}</span>
        <span className="project-meta">
          by {book.author?.name} · {book.genre}
        </span>
      </div>
      <span className={`phase-badge phase--${phaseClass}`}>{phase}</span>
    </div>
  );
};

const PublisherProfileContent = ({ user }) => {
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

      {/* Verification */}
      {user?.isVerified && <VerificationBanner />}

      {/* Active catalog - real books from DB */}
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
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Loading...
            </p>
          )}
          {!loading && publishedBooks.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              No books in catalog yet.
            </p>
          )}
          {!loading &&
            publishedBooks.map((book) => (
              <ProjectRow key={book._id} book={book} />
            ))}
        </div>
      </section>

      {/* Discover authors CTA */}
      <section className="profile-section">
        <div className="section-header-row">
          <h3 className="profile-section-title">
            <Users size={16} /> Authors Network
          </h3>
          <Link to="/publisher/discover" className="btn-section-action">
            Discover +
          </Link>
        </div>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px dashed var(--border-medium)",
            borderRadius: "var(--radius-lg)",
            padding: "1.5rem",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.875rem",
          }}
        >
          Discover talented authors on the platform and invite them to publish
          with you.
        </div>
      </section>
    </>
  );
};

export default PublisherProfileContent;
