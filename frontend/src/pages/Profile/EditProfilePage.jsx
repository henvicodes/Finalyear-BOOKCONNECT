import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft, User, Mail, FileText, Tag } from "lucide-react";
import ProfilePictureUpload from "../../components/profile/ProfilePictureUpload";
import "../../styles/EditProfilePage.css";

const INTEREST_OPTIONS = [
  "fiction",
  "non-fiction",
  "science",
  "technology",
  "poetry",
  "drama",
  "history",
  "biography",
];

const EditProfilePage = () => {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: user?.name || "",
    bio: user?.bio || "",
    interests: user?.interests || [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const toggleInterest = (interest) => {
    setFormData((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }
    setIsLoading(true);
    try {
      const result = await updateProfile(formData);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => navigate("/profile"), 1200);
      } else {
        setError(result.error || "Failed to update profile");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="edit-profile-page">
      <div className="edit-profile-container">
        <button className="btn-back" onClick={() => navigate("/profile")}>
          <ArrowLeft size={16} /> Back to Profile
        </button>

        <div className="edit-profile-card">
          <h2 className="edit-profile-title">Edit Profile</h2>

          {/* Profile picture upload */}
          <div className="edit-picture-section">
            <ProfilePictureUpload />
          </div>

          <div className="edit-divider" />

          {error && <div className="edit-error">{error}</div>}
          {success && (
            <div className="edit-success">Profile updated! Redirecting...</div>
          )}

          <form onSubmit={handleSubmit} className="edit-form">
            {/* Name */}
            <div className="edit-form-group">
              <label className="edit-label">
                <User size={14} /> Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="edit-input"
                placeholder="Your full name"
                maxLength={50}
              />
            </div>

            {/* Email - read only */}
            <div className="edit-form-group">
              <label className="edit-label">
                <Mail size={14} /> Email Address
              </label>
              <input
                type="email"
                value={user?.email || ""}
                className="edit-input edit-input--readonly"
                readOnly
                disabled
              />
              <span className="edit-hint">Email cannot be changed</span>
            </div>

            {/* Bio */}
            <div className="edit-form-group">
              <label className="edit-label">
                <FileText size={14} /> Bio
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                className="edit-textarea"
                placeholder="Write a short bio about yourself..."
                rows={4}
                maxLength={500}
              />
              <span className="edit-hint">{formData.bio.length}/500</span>
            </div>

            {/* Interests */}
            <div className="edit-form-group">
              <label className="edit-label">
                <Tag size={14} /> Interests / Genres
              </label>
              <div className="interests-grid">
                {INTEREST_OPTIONS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    className={`interest-toggle ${
                      formData.interests.includes(interest) ? "active" : ""
                    }`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="edit-form-actions">
              <button
                type="button"
                className="btn-cancel-edit"
                onClick={() => navigate("/profile")}
              >
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={isLoading}>
                {isLoading ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save size={15} /> Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditProfilePage;
