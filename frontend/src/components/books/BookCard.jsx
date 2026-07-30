import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Star } from "lucide-react";
import "../../styles/BookCard.css";

const BookCard = ({ book }) => {
  return (
    <Link to={`/books/${book._id}`} className="book-card">
      <div className="book-card-cover">
        {book.coverImage && book.coverImage !== "default-cover.jpg" ? (
          <img src={book.coverImage} alt={book.title} />
        ) : (
          <div className="book-card-cover-placeholder">
            <BookOpen size={32} />
          </div>
        )}
      </div>
      <div className="book-card-info">
        <h3 className="book-card-title">{book.title}</h3>
        <p className="book-card-author">by {book.author?.name || "Unknown"}</p>
        {book.averageRating > 0 && (
          <div className="book-card-rating">
            <Star size={14} className="star-filled" />
            <span>{book.averageRating}</span>
            <span className="book-card-reviews">({book.totalRatings})</span>
          </div>
        )}
        <span className="book-card-genre">{book.genre}</span>
      </div>
    </Link>
  );
};

export default BookCard;
