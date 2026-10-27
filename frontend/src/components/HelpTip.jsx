import React, { useId, useRef } from "react";
import { HelpCircle } from "lucide-react";
import "../styles/help.css";

const BUBBLE_WIDTH = 260;
const EDGE_GAP = 8;

/**
 * A small "?" that explains something in plain language.
 * Works with mouse (hover), keyboard (Tab to it) and touch (tap) — the bubble
 * is shown by CSS on :hover / :focus-within, and Escape closes it.
 *
 * The bubble is positioned relative to the SCREEN (position: fixed) and
 * clamped inside the viewport each time it opens, so it can never be cut off
 * by a sidebar, card or modal that has overflow: hidden, nor run off the edge.
 *
 *   <HelpTip title="Security PIN" text="A 4-digit code that ..." />
 */
const HelpTip = ({ title, text }) => {
  const id = useId();
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const place = () => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const b = btn.getBoundingClientRect();
    const width = Math.min(BUBBLE_WIDTH, window.innerWidth - EDGE_GAP * 2);
    const left = Math.max(EDGE_GAP, Math.min(b.left + b.width / 2 - width / 2, window.innerWidth - width - EDGE_GAP));
    pop.style.width = `${width}px`;
    pop.style.left = `${left}px`;
    pop.style.top = `${b.bottom + 8}px`;
    // Once it is visible we know its height: flip above the "?" if it would
    // run off the bottom of the screen.
    requestAnimationFrame(() => {
      const h = pop.offsetHeight;
      if (b.bottom + 8 + h > window.innerHeight - EDGE_GAP && b.top - 8 - h > EDGE_GAP) {
        pop.style.top = `${b.top - 8 - h}px`;
      }
    });
  };

  return (
    <span className="help-tip" onMouseEnter={place} onFocus={place}>
      <button
        ref={btnRef}
        type="button"
        className="help-tip-btn"
        aria-label={`What is this? ${title || ""}`.trim()}
        aria-describedby={id}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); place(); }}
        onKeyDown={(e) => { if (e.key === "Escape") e.currentTarget.blur(); }}
      >
        <HelpCircle size={14} />
      </button>
      <span ref={popRef} role="tooltip" id={id} className="help-tip-pop">
        {title && <strong>{title}</strong>}
        {text}
      </span>
    </span>
  );
};

export default HelpTip;
