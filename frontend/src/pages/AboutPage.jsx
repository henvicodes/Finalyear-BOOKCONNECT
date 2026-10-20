import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Add this import
import {
  BookOpen,
  Shield,
  Sparkles,
  Users,
  Globe,
  Database,
  Code,
  Server,
  Cpu,
  Link as LinkIcon,
  Mail,
  Award,
  CheckCircle,
} from "lucide-react";
import "../styles/AboutPage.css";

const AboutPage = () => {
  const { user } = useAuth(); // Get user state

  const team = [
    { name: "Arpita Gupta", roll: "22", email: "arpitagupta2504@gmail.com" },
    { name: "Alfiya Inamdar", roll: "25", email: "alfiyaunamdar143@gmail.com" },
    { name: "Sarika Mahalnar", roll: "43", email: "sarikamahalnar@gmail.com" },
    { name: "Henvi Patel", roll: "53", email: "henvipatel05@gmail.com" },
  ];

  const modules = [
    {
      icon: <Sparkles size={24} />,
      title: "AI-Powered Writing",
      desc:
        "Real-time grammar correction, style refinement, and automated book summary generation.",
    },
    {
      icon: <Shield size={24} />,
      title: "Blockchain Ownership",
      desc:
        "Immutable SHA-256 content hashing to provide a tamper-evident copyright signature.",
    },
    {
      icon: <Users size={24} />,
      title: "Multi-Role Ecosystem",
      desc:
        "Dedicated, secure dashboards for Authors, Readers, Publishers, and Administrators.",
    },
    {
      icon: <Globe size={24} />,
      title: "Smart Discovery",
      desc:
        "TF-IDF & cosine similarity based recommendation engine for personalized reading.",
    },
  ];

  return (
    <div className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="container">
          <div className="hero-badge">
            <Award size={16} /> B.Tech Major Project 2026-27
          </div>
          <h1 className="hero-title">
            A Blockchain-Enabled AI-Driven <br />
            <span>Digital Publishing Platform</span>
          </h1>
          <p className="hero-desc">
            BookConnect is an integrated ecosystem designed for secure,
            intelligent, and community-centric knowledge exchange. Built to
            eliminate fragmented publishing workflows by unifying AI writing
            tools, immutable copyright verification, and secure monetization.
          </p>
        </div>
      </section>

      {/* The Problem & Solution */}
      <section className="about-section bg-light">
        <div className="container">
          <div className="grid-2">
            <div className="text-content">
              <h2 className="section-title">Why BookConnect?</h2>
              <p>
                Traditional digital publishing platforms often separate writing
                assistance, plagiarism checking, publisher workflows, and
                ownership verification into different services. Authors struggle
                with content theft, while readers face generic discovery
                experiences.
              </p>
              <p>
                <strong>BookConnect solves this fragmentation.</strong> By
                bringing together cutting-edge NLP models and decentralized
                ledger technology, we provide a seamless, secure environment
                where creativity meets technology.
              </p>
              <ul className="feature-list">
                <li>
                  <CheckCircle size={18} /> Integrated Plagiarism & AI Writing
                  Assistant
                </li>
                <li>
                  <CheckCircle size={18} /> SHA-256 Blockchain Ownership
                  Registry
                </li>
                <li>
                  <CheckCircle size={18} /> Secure Publisher Review & Payment
                  Workflow
                </li>
              </ul>
            </div>
            <div className="image-placeholder glass-panel">
              <div className="graphic-box">
                <BookOpen size={64} className="text-primary" />
                <h3>Secure. Intelligent. Community-Centric.</h3>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Modules */}
      <section className="about-section">
        <div className="container">
          <h2 className="section-title center">Platform Architecture</h2>
          <p className="section-subtitle center">
            The core modules powering the BookConnect ecosystem.
          </p>

          <div className="modules-grid">
            {modules.map((mod, i) => (
              <div key={i} className="module-card glass-panel">
                <div className="module-icon">{mod.icon}</div>
                <h3>{mod.title}</h3>
                <p>{mod.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="about-section bg-dark text-white">
        <div className="container">
          <h2 className="section-title center text-white">Technology Stack</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <Code /> <span>React.js</span>
            </div>
            <div className="tech-item">
              <Server /> <span>Node.js</span>
            </div>
            <div className="tech-item">
              <Database /> <span>MongoDB</span>
            </div>
            <div className="tech-item">
              <Cpu /> <span>AI / NLP</span>
            </div>
            <div className="tech-item">
              <LinkIcon /> <span>Web3 / SHA-256</span>
            </div>
            <div className="tech-item">
              <Shield /> <span>JWT Auth</span>
            </div>
          </div>
        </div>
      </section>

      {/* Meet the Team */}
      <section className="about-section">
        <div className="container">
          <h2 className="section-title center">The Project Team</h2>
          <p className="section-subtitle center">
            Department of Computer Science & Technology <br />
            Usha Mittal Institute of Technology, SNDT Women's University
          </p>

          <div className="team-grid">
            {team.map((member, i) => (
              <div key={i} className="team-card">
                <div className="team-avatar">{member.name.charAt(0)}</div>
                <h3>{member.name}</h3>
                <span className="team-roll">Roll No: {member.roll}</span>
                <a href={`mailto:${member.email}`} className="team-email">
                  <Mail size={14} /> {member.email}
                </a>
              </div>
            ))}
          </div>

          <div className="guide-box glass-panel">
            <div className="guide-avatar">SP</div>
            <div>
              <h4>Project Guide</h4>
              <p>
                <strong>Dr. Sumedh Pundkar</strong>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA - Only show if NOT logged in */}
      {!user && (
        <section className="about-cta">
          <div className="container">
            <h2>Experience the Future of Publishing</h2>
            <p>
              Join the platform that's revolutionizing how literature is
              created, protected, and discovered.
            </p>
            <Link to="/register" className="btn-cta">
              Create an Account
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default AboutPage;
