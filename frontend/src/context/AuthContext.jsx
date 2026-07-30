import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  //  Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored && stored !== "undefined" && stored !== "null") {
        const parsed = JSON.parse(stored);
        if (parsed) {
          setUser(parsed);
          setAuthHeader(parsed.token);
        }
      }
    } catch (err) {
      console.error("Failed to parse user from localStorage:", err);
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  const setAuthHeader = (token) => {
    if (token)
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    else delete axios.defaults.headers.common["Authorization"];
  };

  const persist = (userData) => {
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
    setAuthHeader(userData.token);
  };

  // Auth actions

  const register = async (userData) => {
    try {
      setError(null);
      const { data } = await axios.post(
        `${BASE_URL}/api/auth/register`,
        userData,
      );
      if (data.success) {
        const { token, ...info } = data.data;
        persist({ ...info, token });
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Registration failed";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const { data } = await axios.post(`${BASE_URL}/api/auth/login`, {
        email,
        password,
      });
      if (data.success) {
        const { token, ...info } = data.data;
        persist({ ...info, token });
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    setAuthHeader(null);
    setUser(null);
  };

  const updateUserFields = (fields) => {
    if (user) {
      const updated = { ...user, ...fields };
      persist(updated);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const { data } = await axios.put(
        `${BASE_URL}/api/auth/profile`,
        profileData,
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      if (data.success) {
        const updated = { ...user, ...data.data };
        persist(updated);
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Profile update failed";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const uploadProfilePicture = async (base64DataUrl) => {
    try {
      const { data } = await axios.put(
        `${BASE_URL}/api/auth/profile/picture`,
        { profilePicture: base64DataUrl },
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      if (data.success) {
        const updated = { ...user, profilePicture: data.data.profilePicture };
        persist(updated);
        return { success: true, profilePicture: data.data.profilePicture };
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Upload failed";
      return { success: false, error: msg };
    }
  };

  const value = {
    user,
    loading,
    error,
    register,
    login,
    logout,
    updateProfile,
    updateUserFields,
    uploadProfilePicture,
    isAuthenticated: !!user,
    isAuthor: user?.role === "author",
    isPublisher: user?.role === "publisher",
    isReader: user?.role === "reader",
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
