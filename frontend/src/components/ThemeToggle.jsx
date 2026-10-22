import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

/**
 * Reusable light/dark theme switch.
 * variant="switch" — a labeled pill switch, for Settings panels.
 * variant="icon"   — a compact icon-only button, for the Navbar dropdown.
 */
const ThemeToggle = ({ variant = "switch", className = "" }) => {
  const { isDark, toggleTheme } = useTheme();

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={className}
        onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
        <span>{isDark ? "Light mode" : "Dark mode"}</span>
      </button>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "0.875rem 1rem",
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-md)"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-md)",
            background: "var(--accent-50)",
            color: "var(--accent-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          {isDark ? <Moon size={16} /> : <Sun size={16} />}
        </div>
        <div>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--text-primary)" }}>
            Appearance
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
            {isDark ? "Dark mode is on" : "Light mode is on"}
          </div>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle dark mode"
        onClick={toggleTheme}
        style={{
          width: 44,
          height: 24,
          borderRadius: "var(--radius-full)",
          border: "none",
          padding: 3,
          cursor: "pointer",
          background: isDark ? "var(--accent-500)" : "var(--gray-300)",
          display: "flex",
          alignItems: "center",
          justifyContent: isDark ? "flex-end" : "flex-start",
          transition: "background var(--transition-fast)",
          flexShrink: 0
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "var(--shadow-sm)",
            transition: "transform var(--transition-fast)"
          }}
        />
      </button>
    </div>
  );
};

export default ThemeToggle;
