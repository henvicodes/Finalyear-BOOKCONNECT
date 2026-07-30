import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Users, Star, Award, Clock, BookMarked } from "lucide-react";
import StatBubble from "./StatBubble.jsx";
import InterestTag from "./InterestTag.jsx";
import { useBooks } from "../../hooks/useBooks.js";
import "../../styles/ProfilePage.css";

// Wishlist cards
const WishlistCard = ({ book }) => (
  <div className="wishlist-card">
    <div className="wishlist-cover">
      {book.coverImage && book.coverImage !== "default-cover.jpg" ? (
        <img
          src={book.coverImage}
          alt={book.title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <BookOpen size={22} />
      )}
    </div>
    <span className="wishlist-title">{book.title}</span>
    <span className="wishlist-author">{book.author?.name || "Unknown"}</span>
  </div>
);

const AddWishlistCard = () => (
  <div className="wishlist-card wishlist-card--add">
    <span className="wishlist-add-icon">+</span>
    <span className="wishlist-title">Discover books</span>
  </div>
);

const ReaderProfileContent = ({ user }) => {
  // Show latest published books as "recommended reading" for this reader
  const { books: latestBooks, loading } = useBooks({
    status: "published",
    limit: 3,
    sort: "-createdAt",
  });

  // Books matching reader's interests as wishlist suggestions
  const firstInterest = user?.interests?.[0];
  const { books: genreBooks } = useBooks({
    status: "published",
    genre: firstInterest,
    limit: 3,
  });

  return (
    <>
      {/* Stats */}
      <div className="profile-stats-row">
        <StatBubble
          icon={<BookOpen size={20} />}
          value="23"
          label="Books Read"
          color="indigo"
        />
        <StatBubble
          icon={<Star size={20} />}
          value="15"
          label="Reviews"
          color="yellow"
        />
        <StatBubble
          icon={<Users size={20} />}
          value="8"
          label="Following"
          color="pink"
        />
        <StatBubble
          icon={<BookMarked size={20} />}
          value="12"
          label="Wishlist"
          color="teal"
        />
      </div>

      {/* Interests */}
      {user?.interests?.length > 0 && (
        <section className="profile-section">
          <h3 className="profile-section-title">
            <Award size={16} /> Reading Interests
          </h3>
          <div className="tags-row">
            {user.interests.map((i) => (
              <InterestTag key={i} label={i} />
            ))}
          </div>
        </section>
      )}

      {/* Recent reads - showing latest published books from DB as placeholder */}
      <section className="profile-section">
        <div className="section-header-row">
          <h3 className="profile-section-title">
            <Clock size={16} /> Recently Read
          </h3>
          <Link to="/books" className="see-all-link">
            Browse all →
          </Link>
        </div>

        <div className="book-list">
          {loading && (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Loading...
            </p>
          )}
          {!loading &&
            latestBooks.map((book) => (
              <div key={book._id} className="book-list-item">
                <div className="book-cover-placeholder">
                  {book.coverImage &&
                  book.coverImage !== "default-cover.jpg" ? (
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
                  <span className="book-list-author">
                    by {book.author?.name}
                  </span>
                  <span
                    className="book-list-meta"
                    style={{ textTransform: "capitalize" }}
                  >
                    {book.genre}
                    {book.averageRating > 0 && ` · ★ ${book.averageRating}`}
                  </span>
                </div>
                {book.averageRating > 0 && (
                  <div className="book-list-rating">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={
                          i < Math.round(book.averageRating)
                            ? "star-filled"
                            : "star-empty"
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </section>

      {/* Wishlist - show genre-matched books from DB */}
      <section className="profile-section">
        <h3 className="profile-section-title">
          <BookMarked size={16} /> Suggested for You
        </h3>
        <div className="wishlist-grid">
          {genreBooks.map((book) => (
            <WishlistCard key={book._id} book={book} />
          ))}
          <AddWishlistCard />
        </div>
      </section>
    </>
  );
};

export default ReaderProfileContent;
