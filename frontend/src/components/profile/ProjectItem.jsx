import React from "react";
import { ChevronRight } from "lucide-react";
import "../../styles/ProfilePage.css";

const ProjectItem = ({ project }) => (
  <div className="project-item">
    <div className="project-info">
      <span className="project-title">{project.title}</span>
      <span className="project-meta">
        {project.authors} author{project.authors > 1 ? "s" : ""}
      </span>
    </div>
    <span
      className={`phase-badge phase--${project.phase
        .toLowerCase()
        .replace(" ", "-")}`}
    >
      {project.phase}
    </span>
    <ChevronRight size={16} className="project-arrow" />
  </div>
);

export default ProjectItem;
