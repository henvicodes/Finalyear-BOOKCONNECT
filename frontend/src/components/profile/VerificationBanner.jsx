import React from "react";
import { Shield, CheckCircle } from "lucide-react";
import "../../styles/ProfilePage.css";

const VerificationBanner = () => (
  <div className="verification-banner">
    <Shield size={20} />
    <div>
      <span className="verification-title">Verified Publisher</span>
      <span className="verification-sub">
        Blockchain-verified identity since Jan 2026
      </span>
    </div>
    <CheckCircle size={20} className="verification-check" />
  </div>
);

export default VerificationBanner;
