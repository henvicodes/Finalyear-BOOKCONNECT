import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Users,
  Star,
  TrendingUp,
  PenTool,
  Shield,
  Edit,
} from "lucide-react";
import StatBubble from "./StatBubble.jsx";
import InterestTag from "./InterestTag.jsx";
import WalletCard from "./WalletCard.jsx";
import { useMyBooks } from "../../hooks/useBooks.js";
import "../../styles/ProfilePage.css";

const BookRow = ({ book }) => {
  const navigate = useNavigate();

  const handleBookClick = () => {
    navigate(`/books/${book._id}`);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    navigate(`/edit-book/${book._id}`);
  };

  return (
    <div className="book-list-item clickable" onClick={handleBookClick}>
      <div className="book-cover-placeholder">
        {book.coverImage && book.coverImage !== "default-cover.jpg" ? (
          <img
            src={book.coverImage}
            alt={book.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "4px",
            }}
          />
        ) : (
          <BookOpen size={18} />
        )}
      </div>
      <div className="book-list-info">
        <span className="book-list-title">{book.title}</span>
        <span
          className="book-list-meta"
          style={{ textTransform: "capitalize" }}
        >
          {book.genre}
          {book.totalReads > 0 &&
            ` · ${book.totalReads.toLocaleString()} reads`}
          {book.averageRating > 0 && ` · ★ ${book.averageRating}`}
        </span>
      </div>
      <div className="book-list-actions">
        <span className={`status-badge status-badge--${book.status}`}>
          {book.status.replace("_", " ")}
        </span>
        <button
          onClick={handleEditClick}
          className="btn-edit-book"
          title="Edit Book"
        >
          <Edit size={16} />
        </button>
      </div>
    </div>
  );
};

const BookSkeleton = () => (
  <div className="book-list-item" style={{ opacity: 0.5 }}>
    <div
      className="book-cover-placeholder"
      style={{ background: "var(--bg-tertiary)" }}
    />
    <div className="book-list-info">
      <div
        style={{
          height: 12,
          background: "var(--bg-tertiary)",
          borderRadius: 4,
          width: "60%",
          marginBottom: 6,
        }}
      />
      <div
        style={{
          height: 10,
          background: "var(--bg-tertiary)",
          borderRadius: 4,
          width: "40%",
        }}
      />
    </div>
  </div>
);

const AuthorProfileContent = ({ user }) => {
  const { books, loading, error } = useMyBooks();

  const published = books.filter((b) => b.status === "published");
  const totalReads = books.reduce((s, b) => s + (b.totalReads || 0), 0);
  const ratedBooks = books.filter((b) => b.averageRating > 0);
  const avgRating = ratedBooks.length
    ? (
        ratedBooks.reduce((s, b) => s + b.averageRating, 0) / ratedBooks.length
      ).toFixed(1)
    : "—";

  const formatReads = (n) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  return (
    <>
      <div className="profile-stats-row">
        <StatBubble
          icon={<BookOpen size={20} />}
          value={String(published.length)}
          label="Published"
          color="indigo"
        />
        <StatBubble
          icon={<Users size={20} />}
          value="—"
          label="Followers"
          color="pink"
        />
        <StatBubble
          icon={<TrendingUp size={20} />}
          value={formatReads(totalReads)}
          label="Total Reads"
          color="teal"
        />
        <StatBubble
          icon={<Star size={20} />}
          value={avgRating}
          label="Avg Rating"
          color="yellow"
        />
      </div>

      {user?.interests?.length > 0 && (
        <section className="profile-section">
          <h3 className="profile-section-title">
            <PenTool size={16} /> Writing Genres
          </h3>
          <div className="tags-row">
            {user.interests.map((i) => (
              <InterestTag key={i} label={i} />
            ))}
          </div>
        </section>
      )}

      <section className="profile-section">
        <div className="section-header-row">
          <h3 className="profile-section-title">
            <BookOpen size={16} /> My Books
          </h3>
          <Link to="/upload-book" className="btn-section-action">
            + New Book
          </Link>
        </div>

        <div className="book-list">
          {loading && [1, 2, 3].map((k) => <BookSkeleton key={k} />)}

          {error && (
            <p style={{ color: "var(--accent-danger)", fontSize: "0.85rem" }}>
              {error}
            </p>
          )}

          {!loading && !error && books.length === 0 && (
            <div className="empty-books">
              <BookOpen
                size={28}
                style={{ color: "var(--text-muted)", marginBottom: "0.5rem" }}
              />
              <p>
                No books yet.{" "}
                <Link to="/upload-book">Upload your first book →</Link>
              </p>
            </div>
          )}

          {!loading &&
            books.map((book) => <BookRow key={book._id} book={book} />)}
        </div>
      </section>

      <section className="profile-section">
        <h3 className="profile-section-title">
          <Shield size={16} /> Blockchain Ownership
        </h3>
        <WalletCard user={user} />
      </section>
    </>
  );
};

export default AuthorProfileContent;
