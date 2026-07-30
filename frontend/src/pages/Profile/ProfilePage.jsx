import React, { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";
import { Edit2, Globe, Calendar, CheckCircle } from "lucide-react";
import ProfilePictureUpload from "../../components/profile/ProfilePictureUpload.jsx";
import ReaderProfileContent from "../../components/profile/ReaderProfileContent.jsx";
import AuthorProfileContent from "../../components/profile/AuthorProfileContent.jsx";
import PublisherProfileContent from "../../components/profile/PublisherProfileContent.jsx";
import api from "../../utils/api.js";
import "../../styles/ProfilePage.css";

const ProfilePage = () => {
  const { user, isAuthor, isPublisher, isReader, updateProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(user);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchFreshProfile = async () => {
      try {
        const { data } = await api.get("api/auth/profile");
        if (data.success) {
          setProfile(data.data);
          updateProfile({
            name: data.data.name,
            bio: data.data.bio,
            interests: data.data.interests,
          });
        }
      } catch (_) {
      } finally {
        setProfileLoading(false);
      }
    };
    fetchFreshProfile();
  }, []);

  // Merge fresh profile back when picture is saved
  const handlePictureSaved = (newUrl) => {
    setProfile((prev) => ({ ...prev, profilePicture: newUrl }));
  };

  const getRoleColor = () => {
    if (isAuthor) return "#059669";
    if (isPublisher) return "#7c3aed";
    return "#2563eb";
  };

  const getRoleLabel = () => {
    if (isAuthor) return "Author";
    if (isPublisher) return "Publisher";
    return "Reader";
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
        month: "short",
        year: "numeric",
      })
    : "Jan 2026";

  // Show the best available profile data
  const displayUser = { ...user, ...profile };

  return (
    <div className="profile-page">
      {/* Cover / hero  */}
      <div
        className="profile-cover"
        style={{
          background: `linear-gradient(135deg, ${getRoleColor()}18 0%, ${getRoleColor()}32 100%)`,
        }}
      >
        <div className="profile-cover-inner container">
          {/* Avatar with upload */}
          <ProfilePictureUpload onSuccess={handlePictureSaved} />

          {/* User info */}
          <div className="profile-hero-info">
            <div className="profile-name-row">
              <h1 className="profile-name">{displayUser?.name}</h1>
              {displayUser?.isVerified && (
                <CheckCircle size={20} className="profile-verified" />
              )}
            </div>

            <span
              className="profile-role-badge"
              style={{ background: getRoleColor() }}
            >
              {getRoleLabel()}
            </span>

            {displayUser?.bio && (
              <p className="profile-bio">{displayUser.bio}</p>
            )}

            {!profileLoading && !displayUser?.bio && (
              <p
                className="profile-bio"
                style={{ fontStyle: "italic", opacity: 0.6 }}
              >
                No bio yet.{" "}
                <button
                  onClick={() => navigate("/profile/edit")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary-color)",
                    cursor: "pointer",
                    fontStyle: "normal",
                    fontWeight: 600,
                  }}
                >
                  Add one →
                </button>
              </p>
            )}

            <div className="profile-meta-row">
              <span className="profile-meta-item">
                <Calendar size={13} /> Joined {memberSince}
              </span>
              <span className="profile-meta-item">
                <Globe size={13} /> {displayUser?.email}
              </span>
            </div>
          </div>

          {/* Edit profile button */}
          <button
            className="btn-edit-profile"
            onClick={() => navigate("/profile/edit")}
          >
            <Edit2 size={15} />
            Edit Profile
          </button>
          <button
              className="btn-logout-profile"
              onClick={logout}
          >
              Logout
          </button>
        </div>
      </div>

      {/*  Role content  */}
      <div className="container profile-body">
        {isReader && <ReaderProfileContent user={displayUser} />}
        {isAuthor && <AuthorProfileContent user={displayUser} />}
        {isPublisher && <PublisherProfileContent user={displayUser} />}
      </div>
    </div>
  );
};

export default ProfilePage;
