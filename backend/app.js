// Express app definition, separated from server.js so tests can import it
// directly with supertest without binding a real port or standing up
// Socket.io. server.js wraps this with the HTTP server + Socket.io + listen().
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const { sanitizeBody, rejectBadQuery } = require("./middleware/sanitize");
const { apiLimiter, authLimiter, walletLimiter } = require("./middleware/rateLimiters");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const manuscriptRoutes = require("./routes/manuscriptRoutes");
const aiRoutes = require("./routes/aiRoutes");
const blockchainRoutes = require("./routes/blockchainRoutes");
const chatRoutes = require("./routes/chatRoutes");
const readerRoutes = require("./routes/readerRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const matchingRoutes = require("./routes/matchingRoutes");

const app = express();

// Safe HTTP headers; cross-origin resource policy relaxed so the React app on
// another port can still load uploaded images from this server.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
app.use(sanitizeBody);
app.use(rejectBadQuery);
app.use("/api", apiLimiter);

// Routes
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/send-otp", authLimiter);
app.use("/api/auth/verify-otp", authLimiter);
app.use("/api/auth/resend-otp", authLimiter);
app.use("/api/blockchain", walletLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/manuscripts", manuscriptRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/messages", chatRoutes);
app.use("/api/reader", readerRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/matching", matchingRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong!" });
});

module.exports = app;
