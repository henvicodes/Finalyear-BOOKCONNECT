import React from "react";
import { ChevronRight } from "lucide-react";
import "../../styles/ProfilePage.css";

const AuthorRosterItem = ({ author }) => (
  <div className="author-roster-item">
    <div className="author-roster-avatar">{author.name.charAt(0)}</div>
    <div className="author-roster-info">
      <span className="author-roster-name">{author.name}</span>
      <span className="author-roster-meta">
        {author.books} books · {author.genre}
      </span>
    </div>
    <ChevronRight size={16} className="project-arrow" />
  </div>
);

export default AuthorRosterItem;
