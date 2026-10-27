import React, { useState, useEffect } from "react";
import { Mail, Clock, AlertCircle, RefreshCw } from "lucide-react";
import "../styles/OTPVerification.css";

const OTPVerification = ({ email, onVerify, onResend, onCancel, devOtp }) => {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(600); // 10 minutes in seconds
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prevTimer) => {
        if (prevTimer <= 1) {
          clearInterval(interval);
          setCanResend(true);
          return 0;
        }
        return prevTimer - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleChange = (element, index) => {
    if (isNaN(element.value)) return;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (element.value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        document.getElementById(`otp-${index - 1}`).focus();
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const otpString = otp.join("");

    if (otpString.length !== 6) {
      setError("Please enter complete 6-digit OTP");
      return;
    }

    setIsVerifying(true);
    try {
      setError("");
      await onVerify(otpString);
    } catch (err) {
      setError(err.message || "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setIsResending(true);
    try {
      setError("");
      await onResend();
      setTimer(600);
      setCanResend(false);
      setOtp(["", "", "", "", "", ""]);
    } catch (err) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  };

  const handleAutoFill = () => {
    if (!devOtp) return;
    const digits = devOtp.toString().slice(0, 6).split("");
    while (digits.length < 6) digits.push("");
    setOtp(digits);
    setError("");
  };

  return (
    <div className="otp-verification-overlay">
      <div className="otp-verification-modal">
        <div className="otp-header">
          <div className="otp-icon">
            <Mail size={32} />
          </div>
          <h2>Verify Your Email</h2>
          <p>
            We've sent a verification code to
            <br />
            <strong>{email}</strong>
          </p>
        </div>

        {devOtp && (
          <div
            style={{
              background: "#eff6ff",
              border: "1px dashed #3b82f6",
              borderRadius: "8px",
              padding: "10px 14px",
              margin: "12px 0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "13px",
              color: "#1d4ed8",
            }}
          >
            <span>
              <strong>OTP Code:</strong>{" "}
              <code
                style={{
                  background: "#dbeafe",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  letterSpacing: "1px",
                }}
              >
                {devOtp}
              </code>
            </span>
            <button
              type="button"
              onClick={handleAutoFill}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "5px",
                padding: "4px 10px",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              Auto-fill
            </button>
          </div>
        )}

        {error && (
          <div className="otp-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="otp-input-group">
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(e.target, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="otp-input"
                autoFocus={index === 0}
              />
            ))}
          </div>

          <div className="otp-timer">
            <Clock size={16} />
            <span>{formatTime(timer)} remaining</span>
          </div>

          <button type="submit" className="btn-verify" disabled={isVerifying}>
            {isVerifying ? "Verifying..." : "Verify Email"}
          </button>
        </form>

        <div className="otp-footer">
          <p>Didn't receive the code?</p>
          <button
            onClick={handleResend}
            className={`btn-resend ${!canResend ? "disabled" : ""}`}
            disabled={!canResend || isResending}
          >
            <RefreshCw size={16} className={isResending ? "spin" : ""} />
            {isResending ? "Sending..." : "Resend Code"}
          </button>
        </div>

        <button onClick={onCancel} className="btn-cancel">
          Go Back
        </button>
      </div>
    </div>
  );
};

export default OTPVerification;
