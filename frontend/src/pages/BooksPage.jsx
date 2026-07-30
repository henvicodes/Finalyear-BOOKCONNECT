import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Star, Search } from "lucide-react";
import api from "../utils/api";
import "../styles/BooksPage.css";

const BooksPage = () => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const genres = [
    "all",
    "fiction",
    "non-fiction",
    "science",
    "technology",
    "poetry",
    "drama",
    "history",
    "biography",
    "mystery",
    "romance",
    "thriller",
    "fantasy",
    "horror",
    "children",
  ];

  useEffect(() => {
    fetchBooks();
  }, [pagination.page, selectedGenre, searchTerm]);

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: "published",
        page: pagination.page,
        limit: 12,
      });

      if (selectedGenre && selectedGenre !== "all") {
        params.append("genre", selectedGenre);
      }
      if (searchTerm) {
        params.append("search", searchTerm);
      }

      const { data } = await api.get(`/api/books?${params}`);
      if (data.success) {
        setBooks(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load books");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchBooks();
  };

  const handleGenreChange = (genre) => {
    setSelectedGenre(genre);
    setPagination({ ...pagination, page: 1 });
  };

  const handlePageChange = (newPage) => {
    setPagination({ ...pagination, page: newPage });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="books-page">
      <div className="container">
        <h1 className="books-page-title">All Books</h1>

        {/* Search and Filters */}
        <div className="books-filters">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by title, author, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
            <button type="submit" className="search-btn">
              Search
            </button>
          </form>

          <div className="genre-filters">
            {genres.map((genre) => (
              <button
                key={genre}
                className={`genre-filter-btn ${
                  selectedGenre === genre ? "active" : ""
                }`}
                onClick={() => handleGenreChange(genre)}
              >
                {genre === "all" ? "All Genres" : genre}
              </button>
            ))}
          </div>
        </div>

        {/* Books Grid */}
        {loading ? (
          <div className="books-loading">
            <div className="loading-spinner"></div>
            <p>Loading amazing books...</p>
          </div>
        ) : error ? (
          <div className="books-error">
            <p>{error}</p>
            <button onClick={fetchBooks} className="retry-btn">
              Try Again
            </button>
          </div>
        ) : books.length === 0 ? (
          <div className="books-empty">
            <BookOpen size={48} />
            <h3>No books found</h3>
            <p>Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <>
            <div className="books-grid">
              {books.map((book) => (
                <Link
                  to={`/books/${book._id}`}
                  key={book._id}
                  className="book-card"
                >
                  <div className="book-card-cover">
                    {book.coverImage &&
                    book.coverImage !== "default-cover.jpg" ? (
                      <img src={book.coverImage} alt={book.title} />
                    ) : (
                      <div className="book-card-cover-placeholder">
                        <BookOpen size={32} />
                      </div>
                    )}
                  </div>
                  <div className="book-card-info">
                    <h3 className="book-card-title">{book.title}</h3>
                    <p className="book-card-author">
                      by {book.author?.name || "Unknown"}
                    </p>
                    {book.averageRating > 0 && (
                      <div className="book-card-rating">
                        <Star size={14} className="star-filled" />
                        <span>{book.averageRating}</span>
                        <span className="book-card-reviews">
                          ({book.totalRatings}{" "}
                          {book.totalRatings === 1 ? "review" : "reviews"})
                        </span>
                      </div>
                    )}
                    <span className="book-card-genre">{book.genre}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <div className="pagination-pages">
                  {Array.from(
                    { length: Math.min(5, pagination.pages) },
                    (_, i) => {
                      let pageNum;
                      if (pagination.pages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.pages - 2) {
                        pageNum = pagination.pages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`pagination-page ${
                            pagination.page === pageNum ? "active" : ""
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    },
                  )}
                </div>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BooksPage;
