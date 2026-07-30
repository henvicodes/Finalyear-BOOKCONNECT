import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../utils/api";
import ChapterManager from "../components/books/ChapterManager";
import "../styles/EditBookPage.css";

const EditBookPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [book, setBook] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    genre: "",
    language: "english",
    isPaid: false,
    price: 0,
    tags: [],
    status: "draft",
    coverImage: "",
  });
  const [tagInput, setTagInput] = useState("");

  const genres = [
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
    fetchBook();
  }, [id]);

  const fetchBook = async () => {
    try {
      const { data } = await api.get(`/api/books/${id}`);
      if (data.success) {
        setBook(data.data);
        setFormData({
          title: data.data.title,
          description: data.data.description,
          genre: data.data.genre,
          language: data.data.language,
          isPaid: data.data.isPaid,
          price: data.data.price,
          tags: data.data.tags || [],
          status: data.data.status,
          coverImage: data.data.coverImage,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load book");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleAddTag = (e) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags.includes(tagInput.trim())) {
        setFormData({
          ...formData,
          tags: [...formData.tags, tagInput.trim()],
        });
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data } = await api.put(`/api/books/${id}`, formData);
      if (data.success) {
        setSuccess("Book updated successfully!");
        setTimeout(() => {
          setSuccess("");
        }, 3000);
        fetchBook();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update book");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (
      window.confirm(
        "Are you sure you want to publish this book? It will be visible to everyone.",
      )
    ) {
      setSaving(true);
      try {
        const { data } = await api.post(`/api/books/${id}/publish`);
        if (data.success) {
          setSuccess("Book published successfully!");
          fetchBook();
        }
      } catch (err) {
        setError(err.response?.data?.message || "Failed to publish book");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        "Are you sure you want to delete this book? This action cannot be undone.",
      )
    ) {
      setSaving(true);
      try {
        await api.delete(`/api/books/${id}`);
        navigate("/profile");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete book");
        setSaving(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="edit-book-page">
        <div className="container">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="edit-book-page">
        <div className="container">
          <div className="error-message">Book not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-book-page">
      <div className="container">
        <div className="edit-book-header">
          <button onClick={() => navigate("/profile")} className="back-btn">
            ← Back to Profile
          </button>
          <h1 className="edit-book-title">Edit Book: {book.title}</h1>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="edit-book-content">
          {/* Book Information Form */}
          <div className="edit-book-form-section">
            <h2>Book Information</h2>
            <form onSubmit={handleSubmit} className="edit-book-form">
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description *</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  rows="6"
                  className="form-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="genre">Genre *</label>
                  <select
                    id="genre"
                    name="genre"
                    value={formData.genre}
                    onChange={handleChange}
                    required
                    className="form-select"
                  >
                    <option value="">Select a genre</option>
                    {genres.map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="language">Language</label>
                  <input
                    type="text"
                    id="language"
                    name="language"
                    value={formData.language}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="under_review">Under Review</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      name="isPaid"
                      checked={formData.isPaid}
                      onChange={handleChange}
                    />
                    This is a paid book
                  </label>
                </div>
              </div>

              {formData.isPaid && (
                <div className="form-group">
                  <label htmlFor="price">Price (₹)</label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    min="0"
                    step="1"
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="tags">Tags (Press Enter to add)</label>
                <input
                  type="text"
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="form-input"
                  placeholder="e.g., fiction, bestseller, award-winning"
                />
                <div className="tags-list">
                  {formData.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="tag-remove"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button type="submit" disabled={saving} className="btn-save">
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {book.status !== "published" && (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={saving}
                    className="btn-publish"
                  >
                    Publish Book
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="btn-delete-book"
                >
                  Delete Book
                </button>
              </div>
            </form>
          </div>

          {/* Chapter Management Section */}
          <div className="edit-book-chapters-section">
            <h2>Manage Chapters</h2>
            <ChapterManager
              bookId={id}
              chapters={book.chapters || []}
              onChapterUpdate={fetchBook}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditBookPage;
