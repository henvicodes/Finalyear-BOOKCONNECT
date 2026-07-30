import React, { useRef, useState } from "react";
import { Camera, X, Check, Loader } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/ProfilePictureUpload.css";

const ProfilePictureUpload = ({ onSuccess }) => {
  const { user, uploadProfilePicture } = useAuth();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const currentPic =
    preview ||
    (user?.profilePicture !== "default-avatar.png"
      ? user?.profilePicture
      : null);

  //  File selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setSaved(false);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be under 2 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  // Save
  const handleSave = async () => {
    if (!preview) return;
    setLoading(true);
    setError("");
    const result = await uploadProfilePicture(preview);
    setLoading(false);
    if (result.success) {
      setSaved(true);
      setPreview(null);
      if (onSuccess) onSuccess(result.profilePicture);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError(result.error || "Upload failed.");
    }
  };

  // Discard preview
  const handleDiscard = () => {
    setPreview(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="pp-upload">
      {/* Avatar display */}
      <div
        className="pp-avatar"
        onClick={() => !loading && fileRef.current.click()}
        title="Change profile picture"
      >
        {currentPic ? (
          <img src={currentPic} alt={user?.name} />
        ) : (
          <span className="pp-initials">{initials}</span>
        )}

        {/* Camera overlay */}
        <div className="pp-overlay">
          <Camera size={20} />
          <span>Change</span>
        </div>

        {/* Saved tick */}
        {saved && (
          <div className="pp-saved-badge">
            <Check size={14} />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Controls shown only when a new image is staged */}
      {preview && (
        <div className="pp-actions">
          <button
            className="pp-btn pp-btn--save"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? (
              <Loader size={14} className="pp-spin" />
            ) : (
              <Check size={14} />
            )}
            {loading ? "Saving..." : "Save photo"}
          </button>
          <button
            className="pp-btn pp-btn--discard"
            onClick={handleDiscard}
            disabled={loading}
          >
            <X size={14} />
            Discard
          </button>
        </div>
      )}

      {error && <p className="pp-error">{error}</p>}

      {/* Helper text */}
      {!preview && (
        <p className="pp-hint">Click your avatar to change photo · Max 2 MB</p>
      )}
    </div>
  );
};

export default ProfilePictureUpload;
