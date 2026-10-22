import React, { useState } from "react";
import { Compass, X } from "lucide-react";
import { GUIDE } from "../content/helpContent";
import "../styles/help.css";

/**
 * First-visit card on each dashboard Overview: the normal order of things in
 * four steps, a button into the full guide, and a way to dismiss it for good.
 * "Dismissed" is remembered per user + role in localStorage (and the page
 * still works if storage is blocked — the banner just reappears).
 */
const WelcomeBanner = ({ role, userId, onOpenGuide }) => {
  const key = `bookconnect-welcome-${role}-${userId || "anon"}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === "1";
    } catch {
      return false;
    }
  });

  if (hidden) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* storage blocked — fine, it will just show again next visit */
    }
    setHidden(true);
  };

  const guide = GUIDE[role] || GUIDE.reader;

  return (
    <aside className="welcome-banner" aria-label="Welcome tour">
      <button type="button" className="welcome-banner-close" onClick={dismiss} aria-label="Dismiss welcome message">
        <X size={16} />
      </button>
      <div className="welcome-banner-head">
        <Compass size={20} aria-hidden="true" />
        <strong>New here? This is how it works</strong>
      </div>
      <ol className="welcome-banner-steps">
        {guide.journey.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <div className="welcome-banner-actions">
        <button type="button" className="welcome-banner-primary" onClick={onOpenGuide}>
          Show me where everything is
        </button>
        <button type="button" className="welcome-banner-secondary" onClick={dismiss}>
          Got it, hide this
        </button>
      </div>
    </aside>
  );
};

export default WelcomeBanner;
