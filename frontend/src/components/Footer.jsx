import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Github, Twitter, Linkedin, Mail } from "lucide-react";
import "../styles/Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        {/* Brand Section */}
        <div className="footer-section brand-section">
          <Link to="/" className="footer-logo">
            <BookOpen size={24} color="#a78bfa" />
            <span>BookConnect</span>
          </Link>
          <p>
            Blockchain-enabled AI-powered digital publishing platform for secure
            and intelligent knowledge exchange.
          </p>
        </div>

        {/* Quick Links */}
        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/books">Browse Books</Link>
            </li>
            <li>
              <Link to="/about">About Us</Link>
            </li>
            <li>
              <Link to="/register">Get Started</Link>
            </li>
          </ul>
        </div>

        {/* For Authors */}
        <div className="footer-section">
          <h3>For Authors</h3>
          <ul>
            <li>
              <Link to="/dashboard">Publish Your Book</Link>
            </li>
            <li>
              <Link to="/about">AI Writing Assistant</Link>
            </li>
            <li>
              <Link to="/about">Blockchain Verification</Link>
            </li>
            <li>
              <Link to="/dashboard">Author Royalties</Link>
            </li>
          </ul>
        </div>

        {/* Connect With Us */}
        <div className="footer-section">
          <h3>Connect With Us</h3>
          <div className="social-links">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="social-btn"
              aria-label="GitHub"
            >
              <Github size={18} />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              className="social-btn"
              aria-label="Twitter"
            >
              <Twitter size={18} />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              className="social-btn"
              aria-label="LinkedIn"
            >
              <Linkedin size={18} />
            </a>
            <a
              href="mailto:hello@bookconnect.com"
              className="social-btn"
              aria-label="Email"
            >
              <Mail size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          &copy; {new Date().getFullYear()} BookConnect. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
