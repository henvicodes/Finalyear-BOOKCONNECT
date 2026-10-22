import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { Bot, X, Send, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import "../styles/aiWidget.css";

import { API_URL } from "../config";
const BASE_URL = API_URL;
const AI_BOT_ID = "0000000000000000000000aa";

// The sender can come back as a populated object or a bare id string.
const senderId = (m) => m.sender?._id || m.sender;

/**
 * A floating assistant for every dashboard (reader, author, publisher, admin).
 * It talks to the same assistant as the Messages tab, so the conversation is shared.
 */
const AiAssistantWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [starters, setStarters] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [history, suggestions] = await Promise.all([
        axios.get(`${BASE_URL}/api/messages/${AI_BOT_ID}`),
        axios.get(`${BASE_URL}/api/messages/ai/starters`),
      ]);
      setMessages(history.data.data || []);
      setStarters(suggestions.data.data || []);
      setError("");
    } catch {
      setError("Could not load the assistant. Is the server running?");
    } finally {
      setLoaded(true);
    }
  }, []);

  // Load on first open only (the panel stays mounted afterwards, so it keeps its place).
  useEffect(() => {
    if (open && !loaded) load();
  }, [open, loaded, load]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, sending]);

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setSending(true);
    setError("");
    const temp = { _id: `temp-${Date.now()}`, sender: user?._id, content, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, temp]);
    try {
      const { data } = await axios.post(`${BASE_URL}/api/messages/ai`, { content });
      setMessages((prev) => [...prev.filter((m) => m._id !== temp._id), data.data, data.aiResponse]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m._id !== temp._id));
      setInput(content);
      setError(err.response?.data?.message || "The assistant could not answer. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {!open && (
        <button className="aiw-fab" onClick={() => setOpen(true)} aria-label="Open the BookConnect assistant" title="Ask the assistant">
          <Bot size={22} />
        </button>
      )}

      {open && (
        <section className="aiw-panel" role="dialog" aria-label="BookConnect assistant">
          <header className="aiw-head">
            <span className="aiw-avatar"><Bot size={18} /></span>
            <div className="aiw-title">
              <strong>BookConnect Assistant</strong>
              <span>Help for {user.role}s</span>
            </div>
            <button className="aiw-close" onClick={() => setOpen(false)} aria-label="Close the assistant"><X size={18} /></button>
          </header>

          <div className="aiw-body">
            {!loaded && <p className="aiw-note">Loading…</p>}
            {loaded && messages.length === 0 && (
              <div className="aiw-welcome">
                <Sparkles size={20} />
                <p>Hi {user.name?.split(" ")[0]}! Ask me how anything in BookConnect works.</p>
              </div>
            )}

            {messages.map((m, i) => {
              const mine = senderId(m) !== AI_BOT_ID;
              return (
                <div key={m._id || i} className={`aiw-row ${mine ? "mine" : "bot"}`}>
                  <div className={`aiw-bubble ${mine ? "mine" : "bot"}`}>{m.content}</div>
                </div>
              );
            })}

            {sending && (
              <div className="aiw-row bot">
                <div className="aiw-bubble bot aiw-typing" aria-label="The assistant is typing"><i /><i /><i /></div>
              </div>
            )}
            {error && <p className="aiw-error">{error}</p>}
            <div ref={endRef} />
          </div>

          {loaded && messages.length < 3 && starters.length > 0 && (
            <div className="aiw-starters">
              {starters.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={sending}>{q}</button>
              ))}
            </div>
          )}

          <form className="aiw-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the assistant…"
              maxLength={2000}
              aria-label="Your question"
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send"><Send size={16} /></button>
          </form>
        </section>
      )}
    </>
  );
};

export default AiAssistantWidget;
