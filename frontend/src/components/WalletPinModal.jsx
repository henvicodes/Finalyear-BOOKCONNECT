import React, { useState } from "react";
import axios from "axios";
import { Lock, ShieldCheck, X, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

import { API_URL } from "../config";
const BASE_URL = API_URL;

const WalletPinModal = ({ isOpen, onClose, onSuccess, token, title = "Enter 4-Digit Security PIN" }) => {
  const [pin, setPin] = useState("");
  const [isSetupMode, setIsSetupMode] = useState(false);
  // "Forgot PIN" resets must prove identity with the account password; the very
  // first PIN (none set yet) does not need it.
  const [isReset, setIsReset] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handlePinChange = (e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(val);
    setError("");
  };

  const handleVerifyOrSet = async (e) => {
    e.preventDefault();
    if (pin.length !== 4) {
      setError("Please enter a complete 4-digit PIN");
      return;
    }
    if (isSetupMode && isReset && !password) {
      setError("Enter your account password to reset the PIN");
      return;
    }

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSetupMode) {
        // Set new 4-digit PIN
        const { data } = await axios.post(
          `${BASE_URL}/api/blockchain/set-pin`,
          isReset ? { pin, password } : { pin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setSuccessMsg("PIN set successfully!");
          setTimeout(() => {
            setIsSetupMode(false);
            setIsReset(false);
            setPassword("");
            setSuccessMsg("");
            onSuccess(pin);
          }, 800);
        }
      } else {
        // Verify PIN
        const { data } = await axios.post(
          `${BASE_URL}/api/blockchain/verify-pin`,
          { pin },
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (data.success && data.verified) {
          onSuccess(pin);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Verification failed.";
      if (err.response?.data?.hasPin === false) {
        setIsSetupMode(true);
        setIsReset(false);
        setError("No PIN configured yet. Please set your 4-digit PIN below.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(15, 23, 42, 0.75)",
      backdropFilter: "blur(8px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20
    }}>
      <div style={{
        background: "var(--bg-primary)",
        border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
        borderRadius: 20,
        width: "100%",
        maxWidth: 380,
        padding: 28,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        position: "relative",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)"
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer"
          }}
        >
          <X size={20} />
        </button>

        {/* Icon & Title */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: "50%",
            background: "var(--accent-50)",
            border: "1px solid var(--accent-200)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            color: "var(--accent-600)"
          }}>
            {isSetupMode ? <KeyRound size={26} /> : <Lock size={26} />}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0" }}>
            {isSetupMode ? (isReset ? "Reset Security PIN" : "Setup 4-Digit Security PIN") : title}
          </h3>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            {isSetupMode
              ? (isReset
                  ? "Enter your account password, then choose a new 4-digit PIN"
                  : "Create a 4-digit PIN to secure your wallet balance & authorize transactions")
              : "Enter your PIN to verify authorization"}
          </p>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
            This PIN protects your balance and approves payments. It is not your login password.
          </p>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-bg)",
            border: "1px solid var(--danger-border)",
            color: "var(--danger)",
            fontSize: 12,
            padding: "10px 12px",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: "var(--success-bg)",
            border: "1px solid var(--success-border)",
            color: "var(--success)",
            fontSize: 12,
            padding: "10px 12px",
            borderRadius: 8,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}>
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* PIN Form */}
        <form onSubmit={handleVerifyOrSet}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 24 }}>
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                style={{
                  width: 44,
                  height: 48,
                  borderRadius: 12,
                  background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                  border: pin.length > idx ? "2px solid var(--accent-600)" : "1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "var(--accent-700)"
                }}
              >
                {pin.length > idx ? "•" : ""}
              </div>
            ))}
          </div>

          {isSetupMode && isReset && (
            <input
              type="password"
              placeholder="Your account password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                marginBottom: 16,
                borderRadius: 10,
                border: "1px solid color-mix(in srgb, var(--text-primary) 15%, transparent)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
          )}

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handlePinChange}
            autoFocus={!(isSetupMode && isReset)}
            style={{
              position: "absolute",
              opacity: 0,
              pointerEvents: "none"
            }}
          />

          {/* Quick Keypad */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, "Clear", 0, "⌫"].map((btn, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (btn === "Clear") setPin("");
                  else if (btn === "⌫") setPin(prev => prev.slice(0, -1));
                  else if (pin.length < 4) setPin(prev => prev + btn);
                }}
                style={{
                  padding: "12px 0",
                  borderRadius: 10,
                  background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
                  color: "var(--text-primary)",
                  fontSize: 16,
                  fontWeight: "600",
                  cursor: "pointer"
                }}
              >
                {btn}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            style={{
              width: "100%",
              padding: "12px",
              background: "linear-gradient(135deg, var(--accent-600) 0%, var(--accent-700) 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontWeight: "bold",
              fontSize: 14,
              cursor: loading || pin.length !== 4 ? "not-allowed" : "pointer",
              opacity: loading || pin.length !== 4 ? 0.6 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <ShieldCheck size={18} />
            <span>{isSetupMode ? (isReset ? "Reset Security PIN" : "Set Security PIN") : "Verify & Proceed"}</span>
          </button>

          {!isSetupMode && (
            <button
              type="button"
              onClick={() => { setIsSetupMode(true); setIsReset(true); setPin(""); setPassword(""); setError(""); }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 11,
                width: "100%",
                marginTop: 12,
                cursor: "pointer",
                textDecoration: "underline"
              }}
            >
              Forgot or reset Security PIN?
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default WalletPinModal;
