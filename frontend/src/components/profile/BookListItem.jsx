import React from "react";
import { BookOpen, Star } from "lucide-react";
import "../../styles/ProfilePage.css";

const BookListItem = ({ book, showStatus = false, showRating = true }) => {
  const renderRating = () => {
    if (!showRating || !book.rating) return null;

    return (
      <div className="book-list-rating">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={12}
            className={i < book.rating ? "star-filled" : "star-empty"}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="book-list-item">
      <div className="book-cover-placeholder">
        <BookOpen size={18} />
      </div>
      <div className="book-list-info">
        <span className="book-list-title">{book.title}</span>
        {book.author && (
          <span className="book-list-author">by {book.author}</span>
        )}
        <span className="book-list-meta">
          {book.genre}
          {book.date && ` · ${book.date}`}
          {book.reads && ` · ${book.reads} reads`}
          {book.rating && showRating && !book.author && ` · ★ ${book.rating}`}
        </span>
      </div>
      {showStatus && book.status && (
        <span className={`status-badge status-badge--${book.status}`}>
          {book.status}
        </span>
      )}
      {renderRating()}
    </div>
  );
};

export default BookListItem;
