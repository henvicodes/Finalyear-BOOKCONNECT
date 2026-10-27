import React, { useState } from "react";
import { ArrowRight, MapPin, Search, HelpCircle } from "lucide-react";
import { GUIDE, GLOSSARY } from "../content/helpContent";
import "../styles/help.css";

/**
 * "Help & Guide" page — shown as a tab inside each role's dashboard.
 * Answers three questions: what's the normal order of things (journey),
 * where is each feature (cards, with a "take me there" button), and what do
 * the unfamiliar words mean (glossary).
 *
 * onGo({ tab }) switches a dashboard tab; onGo({ path }) goes to a page.
 */
const FeatureGuide = ({ role, onGo }) => {
  const guide = GUIDE[role] || GUIDE.reader;
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const features = q
    ? guide.features.filter((f) =>
        `${f.title} ${f.text} ${f.where} ${f.keywords || ""}`.toLowerCase().includes(q)
      )
    : guide.features;
  const terms = q
    ? GLOSSARY.filter((g) => `${g.term} ${g.text}`.toLowerCase().includes(q))
    : GLOSSARY;

  return (
    <div className="dash-content animate-fade-in help-guide">
      <div className="dash-welcome">
        <div>
          <h1>{guide.title}</h1>
          <p>{guide.intro}</p>
        </div>
      </div>

      <section className="help-section" aria-labelledby="help-journey">
        <h2 id="help-journey">The usual order of things</h2>
        <ol className="help-journey">
          {guide.journey.map((step, i) => (
            <li key={i}>
              <span className="help-journey-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="help-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Looking for something? e.g. translate, wallet, rate, publish"
          aria-label="Search the guide"
        />
      </div>

      <section className="help-section" aria-labelledby="help-where">
        <h2 id="help-where">Where is everything?</h2>
        {features.length === 0 ? (
          <p className="help-empty">
            Nothing matches "{query}". Try a simpler word, or ask the AI assistant in Messages.
          </p>
        ) : (
          <div className="help-grid">
            {features.map((f) => {
              const Icon = f.icon || HelpCircle;
              return (
                <article className="help-card" key={f.title}>
                  <div className="help-card-head">
                    <span className="help-card-icon"><Icon size={18} aria-hidden="true" /></span>
                    <h3>{f.title}</h3>
                  </div>
                  <p>{f.text}</p>
                  <div className="help-card-where">
                    <MapPin size={12} aria-hidden="true" /> {f.where}
                  </div>
                  <button
                    type="button"
                    className="help-card-go"
                    onClick={() => onGo(f.tab ? { tab: f.tab } : { path: f.path })}
                  >
                    Take me there <ArrowRight size={14} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="help-section" aria-labelledby="help-words">
        <h2 id="help-words">Words you'll see</h2>
        {terms.length === 0 ? (
          <p className="help-empty">No matching words.</p>
        ) : (
          <div className="help-glossary">
            {terms.map((g) => (
              <details key={g.term}>
                <summary>{g.term}</summary>
                <p>{g.text}</p>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default FeatureGuide;
