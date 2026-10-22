// Express app definition, separated from server.js so tests can import it
// directly with supertest without binding a real port or standing up
// Socket.io. server.js wraps this with the HTTP server + Socket.io + listen().
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
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
const adminRoutes = require("./routes/adminRoutes");
const publisherVerificationRoutes = require("./routes/publisherVerificationRoutes");

const app = express();

// Behind a hosting platform's load balancer (Render, Railway, ...) every request
// arrives from the proxy, so the real visitor address is only available if we
// trust it - otherwise the rate limiter would count the whole world as one user.
// Set TRUST_PROXY=1 there; leave it unset on a normal computer.
const trustProxy = Number(process.env.TRUST_PROXY);
app.set("trust proxy", Number.isInteger(trustProxy) && trustProxy > 0 ? trustProxy : false);

// The built React app (npm --prefix frontend run build). When it exists the
// server serves it too, so one address hosts both the site and the API.
const DIST_DIR = process.env.FRONTEND_DIST || path.join(__dirname, "..", "frontend", "dist");
const INDEX_HTML = path.join(DIST_DIR, "index.html");
const serveFrontend = fs.existsSync(INDEX_HTML);

// Content-Security-Policy for the served site. Book covers come from Project
// Gutenberg and avatars from Dicebear, and fonts from Google, so images/fonts
// may come from any https site; scripts may not. The small inline script in
// index.html (theme, before first paint) is allowed by its hash, not blanket.
const inlineScriptHashes = () => {
  if (!serveFrontend) return [];
  const html = fs.readFileSync(INDEX_HTML, "utf8");
  const hashes = [];
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1].trim()) hashes.push(`'sha256-${crypto.createHash("sha256").update(m[1]).digest("base64")}'`);
  }
  return hashes;
};

const helmetOptions = { crossOriginResourcePolicy: { policy: "cross-origin" } };
if (process.env.NODE_ENV === "production") {
  helmetOptions.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...inlineScriptHashes()],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // The host already serves everything over https; forcing it breaks http://localhost.
      upgradeInsecureRequests: null,
    },
  };
}

// Safe HTTP headers; cross-origin resource policy relaxed so the React app on
// another port can still load uploaded images from this server.
app.use(helmet(helmetOptions));
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
app.use("/api/admin", adminRoutes);
app.use("/api/publisher-verification", publisherVerificationRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// Unknown API paths stay a JSON 404 (never the web page).
app.use("/api", (req, res) => res.status(404).json({ success: false, message: "Not found" }));

if (serveFrontend) {
  // Hashed build files never change, so browsers may keep them for a year.
  app.use("/assets", express.static(path.join(DIST_DIR, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }));
  app.use(express.static(DIST_DIR, { index: false }));
  // Any other page address (/dashboard, /profile, ...) is a React route: send
  // the app so a browser refresh or a shared link works.
  // Addresses that end in a file extension are missing files, not pages.
  app.get(/^\/(?!api(\/|$)|socket\.io(\/|$))(?!.*\.[a-zA-Z0-9]+$).*/, (req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile("index.html", { root: DIST_DIR });
  });
}

// Error handler
app.use((err, req, res, next) => {
  // Client mistakes (bad JSON body, missing asset file) keep their own status.
  const status = err.status || err.statusCode;
  if (status >= 400 && status < 500) {
    return res.status(status).json({ success: false, message: status === 404 ? "Not found" : "Bad request" });
  }
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong!" });
});

module.exports = app;
