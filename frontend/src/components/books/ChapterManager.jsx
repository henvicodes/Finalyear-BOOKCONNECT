import React, { useState } from "react";
import api from "../../utils/api";
import "../../styles/ChapterManager.css";

const ChapterManager = ({ bookId, chapters, onChapterUpdate }) => {
  const [showForm, setShowForm] = useState(false);
  const [editingChapter, setEditingChapter] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    order: chapters.length + 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      setError("Title and content are required");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (editingChapter) {
        await api.put(
          `/api/books/${bookId}/chapters/${editingChapter._id}`,
          formData,
        );
        setSuccess("Chapter updated successfully!");
      } else {
        await api.post(`/api/books/${bookId}/chapters`, formData);
        setSuccess("Chapter added successfully!");
      }
      setTimeout(() => setSuccess(""), 3000);
      onChapterUpdate();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save chapter");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (chapterId, chapterTitle) => {
    if (
      window.confirm(
        `Are you sure you want to delete "${chapterTitle}"? This action cannot be undone.`,
      )
    ) {
      setLoading(true);
      try {
        await api.delete(`/api/books/${bookId}/chapters/${chapterId}`);
        setSuccess("Chapter deleted successfully!");
        setTimeout(() => setSuccess(""), 3000);
        onChapterUpdate();
      } catch (err) {
        setError(err.response?.data?.message || "Failed to delete chapter");
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingChapter(null);
    setFormData({ title: "", content: "", order: chapters.length + 1 });
    setError("");
  };

  const editChapter = (chapter) => {
    setEditingChapter(chapter);
    setFormData({
      title: chapter.title,
      content: chapter.content,
      order: chapter.order,
    });
    setShowForm(true);
    setError("");
  };

  const handleReorder = async (chapterId, newOrder) => {
    const chapter = chapters.find((c) => c._id === chapterId);
    if (chapter) {
      await handleSubmitEdit(chapterId, { ...chapter, order: newOrder });
    }
  };

  return (
    <div className="chapter-manager">
      <div className="chapter-manager-header">
        <div className="header-info">
          <h3>Chapters ({chapters.length})</h3>
          <p className="chapter-count-hint">Manage your book chapters</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn-add-chapter"
          disabled={loading}
        >
          {showForm ? "Cancel" : "+ Add Chapter"}
        </button>
      </div>

      {error && <div className="chapter-error">{error}</div>}
      {success && <div className="chapter-success">{success}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="chapter-form">
          <h4>{editingChapter ? "Edit Chapter" : "Add New Chapter"}</h4>

          <div className="form-group">
            <label>Chapter Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter chapter title"
              required
              className="form-input"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Chapter Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Write your chapter content here..."
              required
              rows="12"
              className="form-textarea"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Chapter Order (1 = first chapter)</label>
            <input
              type="number"
              value={formData.order}
              onChange={(e) =>
                setFormData({ ...formData, order: parseInt(e.target.value) })
              }
              min="1"
              max={chapters.length + 1}
              className="form-input"
              disabled={loading}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={resetForm}
              className="btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading
                ? "Saving..."
                : editingChapter
                ? "Update Chapter"
                : "Add Chapter"}
            </button>
          </div>
        </form>
      )}

      <div className="chapters-list">
        {chapters.length === 0 && !showForm && (
          <div className="chapters-list-empty">
            <BookOpen size={32} />
            <p>No chapters yet</p>
            <p className="empty-hint">
              Click "Add Chapter" to start writing your book
            </p>
          </div>
        )}

        {chapters
          .sort((a, b) => a.order - b.order)
          .map((chapter) => (
            <div key={chapter._id} className="chapter-manager-item">
              <div className="chapter-info">
                <span className="chapter-order">Chapter {chapter.order}</span>
                <span className="chapter-title">{chapter.title}</span>
              </div>
              <div className="chapter-actions">
                <button
                  onClick={() => editChapter(chapter)}
                  className="btn-edit"
                  disabled={loading}
                  title="Edit chapter"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(chapter._id, chapter.title)}
                  className="btn-delete"
                  disabled={loading}
                  title="Delete chapter"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default ChapterManager;
