import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const PublicRoute = () => {
  const { isAuthenticated } = useAuth();

  // If user is logged in, redirect them to their dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  // Otherwise, render the Login/Register page
  return <Outlet />;
};

export default PublicRoute;
