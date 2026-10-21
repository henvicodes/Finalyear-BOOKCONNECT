import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Star, User, Calendar, Languages, RefreshCw, Lock } from "lucide-react";
import { useBook, useChapters, useChapterContent } from "../../hooks/useBooks";
import api from "../../utils/api";
import "../../styles/BookDetail.css";

// "english" is included so books originally written in another language
// (per their `language` field) can be translated back to English too —
// this isn't a one-way "translate out of English" tool.
const TRANSLATE_LANGUAGES = [
  "english", "hindi", "marathi", "bengali", "tamil", "telugu", "gujarati",
  "kannada", "malayalam", "punjabi", "spanish", "french", "german", "chinese", "japanese", "arabic",
];

const BookDetail = () => {
  const { id } = useParams();
  const [selectedChapterId, setSelectedChapterId] = useState(null);
  const [targetLanguage, setTargetLanguage] = useState("hindi");
  const [translatedText, setTranslatedText] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState("");

  const { book, loading: bookLoading, error: bookError } = useBook(id);
  const { chapters } = useChapters(id);
  const {
    chapter: selectedChapter,
    loading: contentLoading,
    requiresPurchase,
  } = useChapterContent(id, selectedChapterId);

  // Every language is always offered, including English — the Book model
  // defaults `language` to "english" for any book that never had it set
  // explicitly, so filtering out "the book's own language" would silently
  // hide English from almost every book on the platform. Genuinely
  // translating a book into its own language is caught server-side with a
  // clear error instead (see translateError below).
  const availableLanguages = TRANSLATE_LANGUAGES;

  // Reset any translated view whenever the chapter changes.
  useEffect(() => {
    setTranslatedText(null);
    setTranslateError("");
  }, [selectedChapterId]);

  const handleChapterClick = (chapterId) => {
    setSelectedChapterId(chapterId);
  };

  const handleTranslate = async () => {
    if (!selectedChapter?.content) return;
    setTranslating(true);
    setTranslateError("");
    try {
      const { data } = await api.post("/api/ai/translate", {
        text: selectedChapter.content,
        targetLanguage,
        sourceLanguage: book?.language,
      });
      if (data.success) {
        setTranslatedText(data.translatedText);
      }
    } catch (err) {
      setTranslateError(err.response?.data?.message || "Translation failed. Please try again.");
    } finally {
      setTranslating(false);
    }
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
                ) : requiresPurchase ? (
                  <div className="chapter-content-paywall">
                    <Lock size={28} />
                    <h3>This is a paid book</h3>
                    <p>
                      Purchase "{book.title}" for ${requiresPurchase.price} to read this chapter.
                    </p>
                    <Link to="/dashboard" className="chapter-translate-btn">
                      Go to your Reader Dashboard to purchase
                    </Link>
                  </div>
                ) : (
                  selectedChapter && (
                    <>
                      <div className="chapter-content-header">
                        <h3 className="chapter-content-title">
                          Chapter {selectedChapter.order}: {selectedChapter.title}
                        </h3>

                        <div className="chapter-translate-bar">
                          <Languages size={14} />
                          <select
                            value={targetLanguage}
                            onChange={(e) => { setTargetLanguage(e.target.value); setTranslatedText(null); }}
                          >
                            {availableLanguages.map((lang) => (
                              <option key={lang} value={lang}>
                                {lang.charAt(0).toUpperCase() + lang.slice(1)}
                              </option>
                            ))}
                          </select>
                          {translatedText ? (
                            <button onClick={() => setTranslatedText(null)} className="chapter-translate-btn">
                              Show Original
                            </button>
                          ) : (
                            <button onClick={handleTranslate} disabled={translating} className="chapter-translate-btn">
                              <RefreshCw size={12} className={translating ? "spin" : ""} />
                              {translating ? "Translating..." : "Translate"}
                            </button>
                          )}
                        </div>
                      </div>

                      {translateError && <p className="chapter-translate-error">{translateError}</p>}

                      <div className="chapter-content-text">
                        {(translatedText || selectedChapter.content)
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
