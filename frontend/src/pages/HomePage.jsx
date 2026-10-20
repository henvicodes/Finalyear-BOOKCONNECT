import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen,
  Shield,
  Sparkles,
  Users,
  Globe,
  Lock,
  PenTool,
  Star,
  ArrowRight,
  ChevronRight,
  CheckCircle,
  Search,
  Send,
  Award,
} from "lucide-react";
import "../styles/HomePage.css";

const HomePage = () => {
  const { user } = useAuth(); // Check if user is logged in

  const features = [
    {
      icon: <PenTool size={24} />,
      title: "AI Writing Assistant",
      description:
        "Get real-time grammar suggestions, style improvements, and multilingual support directly in your editor.",
    },
    {
      icon: <Shield size={24} />,
      title: "Blockchain Ownership",
      description:
        "Secure your work with immutable proof of ownership and a transparent, timestamped history.",
    },
    {
      icon: <Sparkles size={24} />,
      title: "Smart Recommendations",
      description:
        "Our AI engine analyzes reading habits to suggest the perfect books and authors for you.",
    },
    {
      icon: <Users size={24} />,
      title: "Collaborative Writing",
      description:
        "Write together in real-time with version control and clear attribution for co-authors.",
    },
    {
      icon: <Globe size={24} />,
      title: "Multilingual Support",
      description:
        "Publish and read in multiple languages with built-in AI translation tools.",
    },
    {
      icon: <Lock size={24} />,
      title: "Plagiarism Detection",
      description:
        "AI-powered content verification and originality checks to protect your intellectual property.",
    },
  ];

  const stats = [
    { number: "10K+", label: "Active Readers" },
    { number: "5K+", label: "Published Books" },
    { number: "2K+", label: "Authors" },
    { number: "500+", label: "Publishers" },
  ];

  const roles = [
    {
      icon: <Search size={28} />,
      title: "For Readers",
      description:
        "Discover your next favorite book through AI-driven recommendations. Track your reading progress, leave reviews, and build your personal library in one place.",
      color: "#059669",
      bg: "#ecfdf5",
    },
    {
      icon: <PenTool size={28} />,
      title: "For Authors",
      description:
        "Write with AI assistance, protect your work on the blockchain, and connect directly with publishers. Manage drafts, submissions, and royalties effortlessly.",
      color: "#7c3aed",
      bg: "#f3f0ff",
    },
    {
      icon: <Award size={28} />,
      title: "For Publishers",
      description:
        "Discover talented authors, review manuscript submissions with AI quality scans, and securely negotiate publishing fees on a trusted ledger.",
      color: "#0369a1",
      bg: "#f0f9ff",
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">
              <span
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <Sparkles size={16} />
                The Future of Digital Publishing
              </span>
            </div>

            <h1 className="hero-title">
              Blockchain-Enabled <span>AI-Powered</span> Literary Platform
            </h1>

            <p className="hero-description">
              Where creativity meets technology. Publish, collaborate, and
              discover literary works in a secure, intelligent, and
              community-driven ecosystem.
            </p>

            <div className="hero-buttons">
              <Link
                to={user ? "/dashboard" : "/register"}
                className="btn-primary"
              >
                {user ? "Go to Dashboard" : "Get Started"}
                <ArrowRight size={20} />
              </Link>
              <Link to="/about" className="btn-secondary">
                Learn More
              </Link>
            </div>

            <div className="stats-grid">
              {stats.map((stat, index) => (
                <div key={index} className="stat-item">
                  <div className="stat-number">{stat.number}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="wave-divider">
          <svg
            viewBox="0 0 1440 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,100L1360,100C1280,100,1120,100,960,100C800,100,640,100,480,100C320,100,160,100,80,100L0,100Z"
              fill="#f8fafc"
            />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Everything You Need in One Platform</h2>
          <p className="section-subtitle">
            Combining cutting-edge AI with blockchain technology to create a
            secure and intelligent publishing ecosystem.
          </p>

          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section (Updated Flow) */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Four simple steps from draft to a globally published book
          </p>

          <div className="steps-grid">
            {[
              {
                step: "01",
                title: "Create Your Account",
                description:
                  "Join as a Reader, Author, or Publisher to access your custom dashboard.",
              },
              {
                step: "02",
                title: "Write & Polish",
                description:
                  "Draft your manuscript in our editor with the help of the Inline AI Assistant.",
              },
              {
                step: "03",
                title: "Lock on Blockchain",
                description:
                  "Secure your copyright and proof of ownership immutably on the Ethereum ledger.",
              },
              {
                step: "04",
                title: "Submit & Publish",
                description:
                  "Submit to publishers for review, negotiate fees, and publish to the marketplace.",
              },
            ].map((item, index) => (
              <div key={index} className="step-card">
                <div className="step-number">{item.step}</div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                {index < 3 && (
                  <div className="step-arrow">
                    <ChevronRight size={24} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Built for Every Role Section (Replaced Testimonials) */}
      <section
        className="testimonials-section"
        style={{ background: "#ffffff" }}
      >
        <div className="container">
          <h2 className="section-title">Built for Every Role</h2>
          <p className="section-subtitle">
            Whether you read, write, or publish, BookConnect provides the tools
            you need to succeed.
          </p>

          <div className="testimonials-grid">
            {roles.map((role, index) => (
              <div
                key={index}
                className="testimonial-card"
                style={{
                  background: role.bg,
                  border: `1px solid ${role.color}22`,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "#ffffff",
                    color: role.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 16,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                  }}
                >
                  {role.icon}
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: 8,
                  }}
                >
                  {role.title}
                </h3>
                <p
                  style={{
                    color: "#475569",
                    fontSize: 14,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {role.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section (Hidden if logged in) */}
      {!user && (
        <section className="cta-section">
          <div className="container">
            <h2 className="cta-title">Ready to Start Your Literary Journey?</h2>
            <p className="cta-description">
              Join the platform that's revolutionizing digital publishing with
              AI and blockchain technology.
            </p>
            <Link to="/register" className="btn-cta">
              Get Started Now
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default HomePage;
