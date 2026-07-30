import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BookOpen,
  Mail,
  Lock,
  User,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import OTPVerification from "../components/OTPVerification";
import api from "../utils/api";
import "../styles/RegisterPage.css";

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "reader",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [registrationEmail, setRegistrationEmail] = useState("");

  const { register, login } = useAuth();
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
    if (!formData.name) {
      newErrors.name = "Name is required";
    } else if (formData.name.length < 2) {
      newErrors.name = "Name must be at least 2 characters";
    }

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
    try {
      // Send OTP to email
      const response = await api.post("/api/auth/send-otp", {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      if (response.data.success) {
        setRegistrationEmail(formData.email);
        setShowOTP(true);
      }
    } catch (error) {
      if (error.response?.data?.errors) {
        const validationErrors = {};
        error.response.data.errors.forEach((err) => {
          validationErrors[err.field] = err.msg || err.message;
        });
        setErrors(validationErrors);
      } else {
        setErrors({
          general: error.response?.data?.message || "Failed to send OTP",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (otp) => {
    try {
      const response = await api.post("/api/auth/verify-otp", {
        email: registrationEmail,
        otp,
      });
      if (response.data.success) {
        const { token, ...userInfo } = response.data.data;
        localStorage.setItem("user", JSON.stringify({ ...userInfo, token }));

        await login(registrationEmail, formData.password);
        navigate("/dashboard");
      }
    } catch (error) {
      throw new Error(error.response?.data?.message || "Verification failed");
    }
  };

  const handleResendOTP = async () => {
    try {
      await api.post("/api/auth/resend-otp", {
        email: registrationEmail,
      });
    } catch (error) {
      throw new Error(error.response?.data?.message || "Failed to resend OTP");
    }
  };

  const handleCancelOTP = () => {
    setShowOTP(false);
    setRegistrationEmail("");
  };

  return (
    <>
      <div className="register-container">
        <div className="register-card">
          <div className="logo-wrapper">
            <div className="logo-icon">
              <BookOpen />
            </div>
          </div>

          <h2 className="register-title">Create your account</h2>
          <p className="register-subtitle">
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>

          {errors.general && (
            <div className="error-message">
              <AlertCircle size={20} />
              <p>{errors.general}</p>
            </div>
          )}

          <form className="register-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? "error" : ""}
                  placeholder="John Doe"
                />
              </div>
              {errors.name && <p className="input-error">{errors.name}</p>}
            </div>

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
              <label htmlFor="role">I want to join as</label>
              <div className="input-wrapper">
                <UserCheck className="input-icon" size={18} />
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="reader">
                    Reader - Discover and read books
                  </option>
                  <option value="author">
                    Author - Publish and write books
                  </option>
                  <option value="publisher">
                    Publisher - Discover and publish authors
                  </option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
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

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={18} />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? "error" : ""}
                  placeholder="••••••••"
                />
              </div>
              {errors.confirmPassword && (
                <p className="input-error">{errors.confirmPassword}</p>
              )}
            </div>

            <div className="terms-group">
              <label className="terms-label">
                <input type="checkbox" required />
                <span>
                  I agree to the <a href="#">Terms of Service</a> and{" "}
                  <a href="#">Privacy Policy</a>
                </span>
              </label>
            </div>

            <button type="submit" disabled={isLoading} className="btn-submit">
              {isLoading ? (
                <span className="btn-loading">
                  <span className="spinner-small"></span>
                  Sending OTP...
                </span>
              ) : (
                "Register"
              )}
            </button>
          </form>
        </div>
      </div>

      {showOTP && (
        <OTPVerification
          email={registrationEmail}
          onVerify={handleVerifyOTP}
          onResend={handleResendOTP}
          onCancel={handleCancelOTP}
        />
      )}
    </>
  );
};

export default RegisterPage;
