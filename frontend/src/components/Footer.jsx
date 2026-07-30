import React from "react";
import { Link } from "react-router-dom";
import { BookOpen, Github, Twitter, Linkedin, Mail } from "lucide-react";
import "../styles/Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <BookOpen />
            LiteraryPlatform
          </h3>
          <p>
            Blockchain-enabled AI-powered digital publishing platform for secure
            and intelligent knowledge exchange.
          </p>
        </div>

        <div className="footer-section">
          <h3>Quick Links</h3>
          <ul>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/books">Books</Link>
            </li>
            <li>
              <Link to="/authors">Authors</Link>
            </li>
            <li>
              <Link to="/about">About Us</Link>
            </li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>For Authors</h3>
          <ul>
            <li>
              <Link to="/publish">Publish Your Book</Link>
            </li>
            <li>
              <Link to="/collaborate">Collaborative Writing</Link>
            </li>
            <li>
              <Link to="/blockchain">Blockchain Verification</Link>
            </li>
            <li>
              <Link to="/royalties">Royalties</Link>
            </li>
          </ul>
        </div>

        <div className="footer-section">
          <h3>Connect With Us</h3>
          <ul>
            <li>
              <a href="#">
                <Github style={{ marginRight: "8px" }} /> GitHub
              </a>
            </li>
            <li>
              <a href="#">
                <Twitter style={{ marginRight: "8px" }} /> Twitter
              </a>
            </li>
            <li>
              <a href="#">
                <Linkedin style={{ marginRight: "8px" }} /> LinkedIn
              </a>
            </li>
            <li>
              <a href="#">
                <Mail style={{ marginRight: "8px" }} /> Email
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; 2026 BookConnect. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
