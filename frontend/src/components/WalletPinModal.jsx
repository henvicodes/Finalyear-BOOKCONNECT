import React, { useState } from "react";
import axios from "axios";
import { Lock, ShieldCheck, X, KeyRound, AlertCircle, CheckCircle } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const WalletPinModal = ({ isOpen, onClose, onSuccess, token, title = "Enter 4-Digit Security PIN" }) => {
  const [pin, setPin] = useState("");
  const [isSetupMode, setIsSetupMode] = useState(false);
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

    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (isSetupMode) {
        // Set new 4-digit PIN
        const { data } = await axios.post(
          `${BASE_URL}/api/blockchain/set-pin`,
          { pin },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (data.success) {
          setSuccessMsg("PIN set successfully!");
          setTimeout(() => {
            setIsSetupMode(false);
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
        background: "#1e293b",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 20,
        width: "100%",
        maxWidth: 380,
        padding: 28,
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        position: "relative",
        color: "#f8fafc",
        fontFamily: "'Sora', sans-serif"
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
            color: "#94a3b8",
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
            background: "rgba(124, 58, 237, 0.15)",
            border: "1px solid rgba(124, 58, 237, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 12px",
            color: "#a78bfa"
          }}>
            {isSetupMode ? <KeyRound size={26} /> : <Lock size={26} />}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 6px 0" }}>
            {isSetupMode ? "Setup 4-Digit Security PIN" : title}
          </h3>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
            {isSetupMode
              ? "Create a 4-digit PIN to secure your wallet balance & authorize transactions"
              : "Enter your PIN to verify authorization"}
          </p>
        </div>

        {error && (
          <div style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#fca5a5",
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
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#6ee7b7",
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
                  background: "rgba(255, 255, 255, 0.05)",
                  border: pin.length > idx ? "2px solid #7c3aed" : "1px solid rgba(255, 255, 255, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: "bold",
                  color: "#a78bfa"
                }}
              >
                {pin.length > idx ? "•" : ""}
              </div>
            ))}
          </div>

          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handlePinChange}
            autoFocus
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
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  color: "#f8fafc",
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
              background: "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
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
            <span>{isSetupMode ? "Set Security PIN" : "Verify & Proceed"}</span>
          </button>

          {!isSetupMode && (
            <button
              type="button"
              onClick={() => { setIsSetupMode(true); setPin(""); setError(""); }}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
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
