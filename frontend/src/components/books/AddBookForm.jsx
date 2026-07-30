import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateBook } from "../../hooks/useBooks";
import "../../styles/AddBookForm.css";

const AddBookForm = () => {
  const navigate = useNavigate();
  const { createBook, loading, error: apiError } = useCreateBook();
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    genre: "",
    language: "english",
    isPaid: false,
    price: 0,
    tags: [],
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
    if (!formData.title || !formData.description || !formData.genre) {
      setFormError("Please fill in all required fields");
      return;
    }

    setFormError("");
    const result = await createBook(formData);

    if (result.success) {
      navigate(`/books/${result.book._id}`);
    }
  };

  const displayError = formError || apiError;

  return (
    <div className="add-book-form-container">
      <h2 className="add-book-title">Add New Book</h2>
      {displayError && <div className="add-book-error">{displayError}</div>}
      <form onSubmit={handleSubmit} className="add-book-form">
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
            placeholder="Enter book title"
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
            placeholder="Describe your book..."
          />
        </div>

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
                {genre.charAt(0).toUpperCase() + genre.slice(1)}
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
            placeholder="e.g., English, Hindi, etc."
          />
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
          {formData.tags.length > 0 && (
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
          )}
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="btn-cancel"
          >
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? "Creating..." : "Create Book"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddBookForm;
