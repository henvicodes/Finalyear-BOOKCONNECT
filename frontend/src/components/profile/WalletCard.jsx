import React from "react";
import { Link } from "react-router-dom";
import { Wallet, CheckCircle } from "lucide-react";
import "../../styles/ProfilePage.css";

const WalletCard = ({ user }) => {
  return (
    <div
      className={`wallet-card ${
        user?.blockchainWallet?.isLinked ? "wallet-card--linked" : ""
      }`}
    >
      <div className="wallet-card-left">
        <Wallet size={22} />
        <div>
          <span className="wallet-label">
            {user?.blockchainWallet?.isLinked
              ? "Wallet Connected"
              : "No Wallet Linked"}
          </span>
          <span className="wallet-sub">
            {user?.blockchainWallet?.isLinked
              ? user.blockchainWallet.address?.slice(0, 16) + "..."
              : "Link a crypto wallet to verify ownership"}
          </span>
        </div>
      </div>
      {user?.blockchainWallet?.isLinked ? (
        <CheckCircle size={20} className="wallet-check" />
      ) : (
        <Link to="/blockchain/verify" className="btn-wallet-link">
          Link Wallet
        </Link>
      )}
    </div>
  );
};

export default WalletCard;
