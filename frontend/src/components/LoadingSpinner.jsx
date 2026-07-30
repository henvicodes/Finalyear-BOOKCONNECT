import React from "react";

const LoadingSpinner = ({ size = "medium", color = "indigo" }) => {
  const sizeClasses = {
    small: "h-4 w-4",
    medium: "h-8 w-8",
    large: "h-12 w-12",
  };

  const colorClasses = {
    indigo: "border-indigo-600",
    white: "border-white",
    gray: "border-gray-600",
  };

  return (
    <div className="flex justify-center items-center">
      <div
        className={`animate-spin rounded-full border-b-2 ${sizeClasses[size]} ${colorClasses[color]}`}
      ></div>
    </div>
  );
};

export default LoadingSpinner;
