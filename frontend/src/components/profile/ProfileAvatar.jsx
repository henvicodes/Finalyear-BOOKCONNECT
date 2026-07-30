import React from "react";
import "../../styles/ProfilePage.css";

const ProfileAvatar = ({ user, size = "lg" }) => {
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className={`profile-avatar profile-avatar--${size}`}>
      {user?.profilePicture && user.profilePicture !== "default-avatar.png" ? (
        <img src={user.profilePicture} alt={user.name} />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};

export default ProfileAvatar;
