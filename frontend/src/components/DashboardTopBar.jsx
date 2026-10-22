import React, { useState, useEffect, useRef } from "react";
import { Menu, Search, ChevronDown } from "lucide-react";
import "../styles/dashTopbar.css";

/**
 * Top bar for a dashboard: menu button (phones), the current page title, a search box,
 * and a profile menu. The look comes from the shared `.dash-topbar` styles.
 *
 * Props:
 *   title        text shown on the left (the current tab)
 *   user         the logged-in user (name, role, profilePicture)
 *   onMenu       opens the sidebar drawer on phones
 *   onSearch     (text) => void, called when the search box is submitted
 *   searchHint   placeholder for the search box
 *   menuItems    [{ label, icon, onClick, danger? }] shown in the profile menu
 */
const DashboardTopBar = ({ title, user, onMenu, onSearch, searchHint = "Search…", menuItems = [] }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // close the profile menu on an outside click or Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const submit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(query.trim());
  };

  const hasPhoto = user?.profilePicture && user.profilePicture !== "default-avatar.png";

  return (
    <header className="dash-topbar dtb">
      <button className="menu-btn" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <h2 className="dtb-title">{title}</h2>

      {onSearch && (
        <form className="dtb-search" onSubmit={submit} role="search">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchHint} aria-label="Search" />
        </form>
      )}

      <div className="dtb-right" ref={wrapRef}>
        <button className="dtb-profile" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
          <span className="dtb-avatar">
            {hasPhoto ? <img src={user.profilePicture} alt="" /> : user?.name?.[0]?.toUpperCase()}
          </span>
          <span className="dtb-who">
            <strong>{user?.name}</strong>
            <em>{user?.role}</em>
          </span>
          <ChevronDown size={14} />
        </button>

        {open && (
          <div className="dtb-menu" role="menu">
            {menuItems.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                className={item.danger ? "danger" : ""}
                onClick={() => { setOpen(false); item.onClick(); }}
              >
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
};

export default DashboardTopBar;
