import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BookOpen, Mail, Lock, AlertCircle } from "lucide-react";
import "../styles/LoginPage.css";

const LoginPage = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    }
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    const result = await login(formData.email, formData.password);
    setIsLoading(false);

    if (result.success) {
      navigate("/dashboard");
    } else {
      setErrors({ general: result.error });
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-wrapper">
          <div className="logo-icon">
            <BookOpen />
          </div>
        </div>

        <h2 className="login-title">Welcome back</h2>
        <p className="login-subtitle">
          Don't have an account? <Link to="/register">Sign up here</Link>
        </p>

        {errors.general && (
          <div className="error-message">
            <AlertCircle size={20} />
            <p>{errors.general}</p>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? "error" : ""}
                placeholder="you@example.com"
              />
            </div>
            {errors.email && <p className="input-error">{errors.email}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? "error" : ""}
                placeholder="••••••••"
              />
            </div>
            {errors.password && (
              <p className="input-error">{errors.password}</p>
            )}
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" id="remember-me" name="remember-me" />
              <span>Remember me</span>
            </label>
            <a href="#" className="forgot-password">
              Forgot your password?
            </a>
          </div>

          <button type="submit" disabled={isLoading} className="btn-submit">
            {isLoading ? (
              <span className="btn-loading">
                <div className="spinner-small"></div>
                Signing in...
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="demo-section">
          <div className="demo-divider">
            <span>Demo credentials</span>
          </div>

          <div className="demo-buttons">
            <button
              onClick={() => {
                setFormData({
                  email: "author@example.com",
                  password: "password123",
                });
              }}
              className="btn-demo"
            >
              Author Demo
            </button>
            <button
              onClick={() => {
                setFormData({
                  email: "reader@example.com",
                  password: "password123",
                });
              }}
              className="btn-demo"
            >
              Reader Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
