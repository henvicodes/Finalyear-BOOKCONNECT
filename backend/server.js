const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const app = require("./app");

dotenv.config();
connectDB();

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

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
