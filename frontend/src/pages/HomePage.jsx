import React from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  Shield,
  Zap,
  Users,
  Globe,
  Award,
  ChevronRight,
  Sparkles,
  TrendingUp,
  MessageCircle,
  Lock,
  PenTool,
  Star,
  ArrowRight,
} from "lucide-react";
import "../styles/HomePage.css";

const HomePage = () => {
  const features = [
    {
      icon: <PenTool />,
      title: "AI Writing Assistant",
      description:
        "Get real-time grammar suggestions, style improvements, and multilingual support",
    },
    {
      icon: <Shield />,
      title: "Blockchain Ownership",
      description:
        "Secure your work with immutable proof of ownership and transparent history",
    },
    {
      icon: <Sparkles />,
      title: "Smart Recommendations",
      description: "AI-powered personalized book and author recommendations",
    },
    {
      icon: <Users />,
      title: "Collaborative Writing",
      description:
        "Write together in real-time with version control and attribution",
    },
    {
      icon: <Globe />,
      title: "Multilingual Support",
      description: "Publish and read in multiple languages with AI translation",
    },
    {
      icon: <Lock />,
      title: "Plagiarism Detection",
      description: "AI-powered content verification and originality checks",
    },
  ];

  const stats = [
    { number: "10K+", label: "Active Readers" },
    { number: "5K+", label: "Published Books" },
    { number: "2K+", label: "Authors" },
    { number: "500+", label: "Publishers" },
  ];

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Author",
      content:
        "This platform revolutionized how I publish and protect my work. The AI assistant is incredible!",
      rating: 5,
    },
    {
      name: "Michael Chen",
      role: "Publisher",
      content:
        "Finding talented authors has never been easier. The blockchain verification gives us complete trust.",
      rating: 5,
    },
    {
      name: "Emily Rodriguez",
      role: "Reader",
      content:
        "The recommendations are spot-on. I discover books that perfectly match my interests.",
      rating: 5,
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
              <Link to="/register" className="btn-primary">
                Get Started
                <ArrowRight size={20} />
              </Link>
              <Link to="/about" className="btn-secondary">
                Learn More
              </Link>
            </div>

            {/* Stats */}
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

        {/* Wave Divider */}
        <div className="wave-divider">
          <svg
            viewBox="0 0 1440 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0,64L80,69.3C160,75,320,85,480,80C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,100L1360,100C1280,100,1120,100,960,100C800,100,640,100,480,100C320,100,160,100,80,100L0,100Z"
              fill="white"
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

      {/* How It Works Section */}
      <section className="how-it-works">
        <div className="container">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Four simple steps to join the future of digital publishing
          </p>

          <div className="steps-grid">
            {[
              {
                step: "01",
                title: "Create Account",
                description: "Sign up as reader, author, or publisher",
              },
              {
                step: "02",
                title: "Upload Content",
                description: "Publish your work with AI assistance",
              },
              {
                step: "03",
                title: "Blockchain Verification",
                description: "Secure ownership on the blockchain",
              },
              {
                step: "04",
                title: "Connect & Grow",
                description: "Engage with readers and publishers",
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

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <div className="container">
          <h2 className="section-title">What Our Community Says</h2>
          <p className="section-subtitle">
            Join thousands of satisfied users who have transformed their
            literary journey
          </p>

          <div className="testimonials-grid">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="testimonial-card">
                <div className="rating">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="star-filled" />
                  ))}
                </div>
                <p className="testimonial-content">"{testimonial.content}"</p>
                <div className="testimonial-author">{testimonial.name}</div>
                <div className="testimonial-role">{testimonial.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2 className="cta-title">Ready to Start Your Literary Journey?</h2>
          <p className="cta-description">
            Join the platform that's revolutionizing digital publishing with AI
            and blockchain technology.
          </p>
          <Link to="/register" className="btn-cta">
            Get Started Now
            <ArrowRight size={20} />
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
