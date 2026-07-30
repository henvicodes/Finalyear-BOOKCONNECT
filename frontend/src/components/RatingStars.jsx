import React from "react";
import { Star } from "lucide-react";

const RatingStars = ({ rating, setRating, size = 18, readOnly = false }) => {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      {stars.map((star) => {
        const isFilled = star <= rating;
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => setRating && setRating(star)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: readOnly ? "default" : "pointer",
              color: isFilled ? "#fbbf24" : "#cbd5e1",
              transition: "transform 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => {
              if (!readOnly) e.currentTarget.style.transform = "scale(1.15)";
            }}
            onMouseLeave={(e) => {
              if (!readOnly) e.currentTarget.style.transform = "scale(1.0)";
            }}
          >
            <Star
              size={size}
              fill={isFilled ? "currentColor" : "none"}
              strokeWidth={2}
            />
          </button>
        );
      })}
    </div>
  );
};

export default RatingStars;
