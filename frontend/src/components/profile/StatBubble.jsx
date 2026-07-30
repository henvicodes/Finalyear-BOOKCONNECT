import React from "react";
import "../../styles/ProfilePage.css";

const StatBubble = ({ icon, value, label, color = "indigo" }) => (
  <div className={`stat-bubble stat-bubble--${color}`}>
    <div className="stat-bubble-icon">{icon}</div>
    <div className="stat-bubble-value">{value}</div>
    <div className="stat-bubble-label">{label}</div>
  </div>
);

export default StatBubble;
