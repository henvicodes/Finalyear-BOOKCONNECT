import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    localStorage.clear();
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          fontFamily: "'Sora', sans-serif",
          padding: "20px"
        }}>
          <div style={{
            background: "rgba(30, 41, 59, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            borderRadius: "20px",
            padding: "40px",
            maxWidth: "600px",
            width: "100%",
            boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            textAlign: "center"
          }}>
            <div style={{
              width: "64px",
              height: "64px",
              background: "rgba(239, 68, 68, 0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              color: "#ef4444"
            }}>
              <AlertTriangle size={32} />
            </div>
            
            <h2 style={{ color: "#f8fafc", fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
              Application Render Crash
            </h2>
            
            <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "24px" }}>
              React encountered a runtime rendering exception. You can inspect the error details below:
            </p>

            <div style={{
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
              padding: "16px",
              textAlign: "left",
              marginBottom: "24px",
              overflowX: "auto"
            }}>
              <span style={{
                color: "#f87171",
                fontSize: "12px",
                fontWeight: "bold",
                fontFamily: "monospace",
                display: "block",
                marginBottom: "6px"
              }}>
                {this.state.error && this.state.error.toString()}
              </span>
              <pre style={{
                color: "#94a3b8",
                fontSize: "11px",
                fontFamily: "monospace",
                margin: 0,
                whiteSpace: "pre-wrap"
              }}>
                {this.state.errorInfo?.componentStack?.slice(0, 300)}
              </pre>
            </div>

            <button
              onClick={this.handleReload}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "12px 24px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "opacity 0.15s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1.0"}
            >
              <RefreshCw size={16} />
              Reset Session & Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
