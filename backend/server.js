const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
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
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Pass socket.io instance to Express app
app.set("io", io);

// Socket.io real-time connection handler
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // User joins their personal room identified by userId
  socket.on("join_room", (userId) => {
    if (userId) {
      socket.join(userId.toString());
      onlineUsers.set(userId.toString(), socket.id);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log(`User ${userId} joined room ${userId}`);
    }
  });

  // Typing indicator
  socket.on("typing", ({ senderId, receiverId, isTyping }) => {
    if (receiverId) {
      io.to(receiverId.toString()).emit("user_typing", { senderId, isTyping });
    }
  });

  // User disconnects
  socket.on("disconnect", () => {
    for (const [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    io.emit("online_users", Array.from(onlineUsers.keys()));
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

app.use(express.json({ limit: "5mb" }));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
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

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Something went wrong!" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
