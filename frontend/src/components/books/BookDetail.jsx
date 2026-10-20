import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Star,
  User,
  Calendar,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { useBook, useChapters, useChapterContent } from "../../hooks/useBooks";
import "../../styles/BookDetail.css";

const BookDetail = () => {
  const { id } = useParams();
  const [selectedChapterId, setSelectedChapterId] = useState(null);

  const { book, loading: bookLoading, error: bookError } = useBook(id);
  const { chapters, loading: chaptersLoading } = useChapters(id);
  const {
    chapter: selectedChapter,
    loading: contentLoading,
  } = useChapterContent(id, selectedChapterId);

  const handleChapterClick = (chapterId) => {
    setSelectedChapterId(chapterId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToBook = () => {
    setSelectedChapterId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (bookLoading) return <div className="loading">Loading book...</div>;
  if (bookError) return <div className="error">{bookError}</div>;
  if (!book) return <div className="error">Book not found</div>;

  const currentChapterIndex = chapters.findIndex(
    (c) => c._id === selectedChapterId,
  );
  const prevChapter =
    currentChapterIndex > 0 ? chapters[currentChapterIndex - 1] : null;
  const nextChapter =
    currentChapterIndex !== -1 && currentChapterIndex < chapters.length - 1
      ? chapters[currentChapterIndex + 1]
      : null;

  // ── Reading Mode ──────────────────────────────────────────────────────────
  if (selectedChapterId) {
    return (
      <div className="reading-mode-page">
        <div className="reading-mode-container">
          <button
            onClick={handleBackToBook}
            className="back-link reading-back-btn"
          >
            <ArrowLeft size={18} /> Back to Book Details
          </button>

          {contentLoading ? (
            <div className="chapter-content-loading">
              <div className="loading-spinner"></div>
              <p>Loading chapter...</p>
            </div>
          ) : (
            selectedChapter && (
              <article className="reading-content">
                <header className="reading-header">
                  <span className="reading-book-title">{book.title}</span>
                  <h1 className="reading-chapter-title">
                    Chapter {selectedChapter.order}
                  </h1>
                  <h2 className="reading-chapter-subtitle">
                    {selectedChapter.title}
                  </h2>
                </header>

                <div className="reading-text">
                  {selectedChapter.content.split("\n").map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                <footer className="reading-footer">
                  <div className="chapter-navigation">
                    <button
                      onClick={() =>
                        prevChapter && handleChapterClick(prevChapter._id)
                      }
                      className={`btn-chapter-nav ${
                        !prevChapter ? "disabled" : ""
                      }`}
                      disabled={!prevChapter}
                    >
                      <ChevronLeft size={18} />
                      Previous Chapter
                    </button>
                    <button
                      onClick={() =>
                        nextChapter && handleChapterClick(nextChapter._id)
                      }
                      className={`btn-chapter-nav ${
                        !nextChapter ? "disabled" : ""
                      }`}
                      disabled={!nextChapter}
                    >
                      Next Chapter
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </footer>
              </article>
            )
          )}
        </div>
      </div>
    );
  }

  // ── Book Details Mode ─────────────────────────────────────────────────────
  return (
    <div className="book-detail-page">
      {/* Immersive Header Section */}
      <div className="book-hero-section">
        <div className="container">
          <Link to="/books" className="back-link">
            <ArrowLeft size={16} /> Back to Library
          </Link>

          <div className="book-detail-header">
            <div className="book-detail-cover">
              {book.coverImage && book.coverImage !== "default-cover.jpg" ? (
                <img src={book.coverImage} alt={book.title} />
              ) : (
                <div className="book-detail-cover-placeholder">
                  <BookOpen size={48} />
                </div>
              )}
            </div>

            <div className="book-detail-info">
              <div className="book-detail-meta">
                <span className="book-detail-genre">{book.genre}</span>
                {book.averageRating > 0 && (
                  <div className="book-detail-rating">
                    <Star size={16} className="star-filled" />
                    <span>{book.averageRating}</span>
                    <span className="rating-count">
                      ({book.totalRatings} ratings)
                    </span>
                  </div>
                )}
              </div>

              <h1 className="book-detail-title">{book.title}</h1>

              <div className="book-detail-author-row">
                <span className="book-detail-author">
                  <User size={16} /> by {book.author?.name}
                </span>
              </div>

              <p className="book-detail-description">{book.description}</p>

              <div className="book-detail-stats">
                <span>
                  <BookOpen size={14} /> {book.totalReads?.toLocaleString()}{" "}
                  reads
                </span>
                <span className="stat-divider">•</span>
                <span>{book.language}</span>
                {book.createdAt && (
                  <>
                    <span className="stat-divider">•</span>
                    <span>
                      <Calendar size={14} />{" "}
                      {new Date(book.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Elegant Table of Contents Section */}
      <div className="container">
        {chapters.length > 0 && (
          <div className="book-chapters-section">
            <div className="chapters-header">
              <h2 className="chapters-title">Table of Contents</h2>
              <span className="chapters-count">{chapters.length} Chapters</span>
            </div>

            <div className="chapters-list">
              {chapters.map((chapter, index) => (
                <button
                  key={chapter._id}
                  className="chapter-item"
                  onClick={() => handleChapterClick(chapter._id)}
                >
                  <div className="chapter-item-left">
                    <span className="chapter-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="chapter-text-content">
                      <span className="chapter-title">{chapter.title}</span>
                    </div>
                  </div>
                  <div className="chapter-item-right">
                    <span className="chapter-action-text">Read Chapter</span>
                    <ChevronRight size={18} className="chapter-arrow" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookDetail;
