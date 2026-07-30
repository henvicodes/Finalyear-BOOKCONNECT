const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const authRoutes = require("./routes/authRoutes");
const bookRoutes = require("./routes/bookRoutes");
const manuscriptRoutes = require("./routes/manuscriptRoutes");
const aiRoutes = require("./routes/aiRoutes");
const blockchainRoutes = require("./routes/blockchainRoutes");
const chatRoutes = require("./routes/chatRoutes");
const readerRoutes = require("./routes/readerRoutes");

const app = express();

app.use(express.json({ limit: "5mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/manuscripts", manuscriptRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/messages", chatRoutes);
app.use("/api/reader", readerRoutes);

app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
