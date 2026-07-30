import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Star, User, Calendar } from "lucide-react";
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
  };

  if (bookLoading) return <div className="loading">Loading book...</div>;
  if (bookError) return <div className="error">{bookError}</div>;
  if (!book) return <div className="error">Book not found</div>;

  return (
    <div className="book-detail-page">
      <div className="container">
        <Link to="/books" className="back-link">
          <ArrowLeft size={16} /> Back to Books
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
            <h1 className="book-detail-title">{book.title}</h1>
            <div className="book-detail-meta">
              <span className="book-detail-author">
                <User size={14} /> by {book.author?.name}
              </span>
              <span className="book-detail-genre">{book.genre}</span>
            </div>
            {book.averageRating > 0 && (
              <div className="book-detail-rating">
                <Star size={16} className="star-filled" />
                <span>{book.averageRating}</span>
                <span>({book.totalRatings} ratings)</span>
              </div>
            )}
            <p className="book-detail-description">{book.description}</p>
            <div className="book-detail-stats">
              <span>{book.totalReads?.toLocaleString()} reads</span>
              <span>•</span>
              <span>{book.language}</span>
              {book.createdAt && (
                <>
                  <span>•</span>
                  <span>
                    <Calendar size={14} /> Published{" "}
                    {new Date(book.createdAt).toLocaleDateString()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {chapters.length > 0 && (
          <div className="book-chapters-section">
            <h2 className="chapters-title">Chapters ({chapters.length})</h2>
            <div className="chapters-list">
              {chapters.map((chapter) => (
                <button
                  key={chapter._id}
                  className={`chapter-item ${
                    selectedChapterId === chapter._id ? "active" : ""
                  }`}
                  onClick={() => handleChapterClick(chapter._id)}
                >
                  <span className="chapter-number">
                    Chapter {chapter.order}
                  </span>
                  <span className="chapter-title">{chapter.title}</span>
                </button>
              ))}
            </div>

            {selectedChapterId && (
              <div className="chapter-content">
                {contentLoading ? (
                  <div className="chapter-content-loading">
                    Loading chapter content...
                  </div>
                ) : (
                  selectedChapter && (
                    <>
                      <h3 className="chapter-content-title">
                        Chapter {selectedChapter.order}: {selectedChapter.title}
                      </h3>
                      <div className="chapter-content-text">
                        {selectedChapter.content
                          .split("\n")
                          .map((paragraph, idx) => (
                            <p key={idx}>{paragraph}</p>
                          ))}
                      </div>
                    </>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookDetail;
