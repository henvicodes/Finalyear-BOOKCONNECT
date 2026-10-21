import React, { createContext, useState, useContext, useEffect, useCallback } from "react";
import axios from "axios";
import { SESSION_PLACEHOLDER, setUnauthorizedHandler } from "../utils/session";
import { disconnectSocket } from "../services/socket";

const AuthContext = createContext();

// The hook lives beside its provider on purpose.
// eslint-disable-next-line react-refresh/only-export-components
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

  // Only profile details are kept in localStorage; the login token itself is an
  // httpOnly cookie that scripts can't read.
  const clearSession = useCallback(() => {
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const persist = (userData) => {
    const stored = { ...userData, token: SESSION_PLACEHOLDER };
    localStorage.setItem("user", JSON.stringify(stored));
    setUser(stored);
  };

  // Hydrate from localStorage on mount, then confirm with the server that the
  // cookie session is still valid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = localStorage.getItem("user");
        if (stored && stored !== "undefined" && stored !== "null") {
          const parsed = JSON.parse(stored);
          // An older build kept the real JWT here; that session is retired.
          if (parsed && parsed.token === SESSION_PLACEHOLDER) {
            setUser(parsed);
            const { data } = await axios.get(`${BASE_URL}/api/auth/profile`);
            if (!cancelled && data.success) {
              const fresh = { ...parsed, ...data.data, token: SESSION_PLACEHOLDER };
              localStorage.setItem("user", JSON.stringify(fresh));
              setUser(fresh);
            }
          } else {
            localStorage.removeItem("user");
          }
        }
      } catch (err) {
        if (err.response?.status === 401) clearSession();
        else if (!err.response) console.error("Could not reach the server to check the session.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Any API call that comes back 401 (session expired or cleared) logs out the UI.
  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  // Auth actions

  const login = async (email, password) => {
    try {
      setError(null);
      const { data } = await axios.post(`${BASE_URL}/api/auth/login`, {
        email,
        password,
      });
      if (data.success) {
        // The server has set the session cookie; the token in the body is for
        // non-browser clients and is deliberately dropped here.
        const { token: _token, ...info } = data.data;
        persist(info);
        return { success: true };
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed";
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    // Leave the UI immediately, then end the server-side session (cookie).
    clearSession();
    disconnectSocket();
    try {
      await axios.post(`${BASE_URL}/api/auth/logout`);
    } catch {
      // The local session is already gone; the cookie expires on its own.
    }
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
