import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import PrivateRoute from "./components/PrivateRoute";
import ErrorBoundary from "./components/ErrorBoundary";

// Pages
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";

import BooksPage from "./pages/BooksPage.jsx";
import BookDetail from "./components/books/BookDetail.jsx";
import UploadBookPage from "./pages/UploadBookPage";
import EditBookPage from "./pages/EditBookPage";

import ProfilePage from "./pages/Profile/ProfilePage.jsx";
import EditProfilePage from "./pages/Profile/EditProfilePage.jsx";

// Sub-component wrapping logic to enable valid useLocation usage inside the Router context
const AppContent = () => {
  const location = useLocation();
  const showNavAndFooter = !location.pathname.startsWith("/dashboard");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
      }}
    >
      {showNavAndFooter && <Navbar />}
      <main style={{ flex: 1 }}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/edit"
            element={
              <PrivateRoute>
                <EditProfilePage />
              </PrivateRoute>
            }
          />

          {/* Author only */}
          <Route
            path="/upload-book"
            element={
              <PrivateRoute allowedRoles={["author"]}>
                <UploadBookPage />
              </PrivateRoute>
            }
          />

          {/* Books */}
          <Route path="/books" element={<BooksPage />} />
          <Route path="/books/:id" element={<BookDetail />} />
          <Route path="/edit-book/:id" element={<EditBookPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showNavAndFooter && <Footer />}
    </div>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;