const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { COOKIE_NAME } = require("./utils/authCookie");
const User = require("./models/User");

// Reads one cookie out of the raw Cookie header.
const readCookie = (header, name) => {
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
};

// Real-time layer. Every socket must present the same JWT used for the REST API
// in the connection handshake; the user id comes from the verified token, never
// from anything the browser claims later. That stops one user from joining
// another user's private room (and so reading their live messages/payments).
function attachSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
    },
  });

  io.use(async (socket, next) => {
    try {
      // Browser: the httpOnly session cookie. Other clients: auth.token.
      const token =
        readCookie(socket.handshake.headers.cookie, COOKIE_NAME) ||
        (socket.handshake.auth && socket.handshake.auth.token);
      if (!token) return next(new Error("Not authorized"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("_id");
      if (!user) return next(new Error("Not authorized"));
      socket.userId = user._id.toString();
      next();
    } catch {
      next(new Error("Not authorized"));
    }
  });

  // userId -> Set of socket ids (one user can have several tabs open)
  const online = new Map();
  const broadcastPresence = () => io.emit("online_users", Array.from(online.keys()));

  io.on("connection", (socket) => {
    const userId = socket.userId;
    socket.join(userId); // personal room
    if (!online.has(userId)) online.set(userId, new Set());
    online.get(userId).add(socket.id);
    broadcastPresence();

    // Kept so older clients that still emit it don't error; the room is already joined above.
    socket.on("join_room", () => {});

    socket.on("typing", ({ receiverId, isTyping } = {}) => {
      if (typeof receiverId === "string" && receiverId) {
        // sender is the authenticated user, not whatever the client says
        io.to(receiverId).emit("user_typing", { senderId: userId, isTyping: !!isTyping });
      }
    });

    socket.on("disconnect", () => {
      const set = online.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) online.delete(userId);
      }
      broadcastPresence();
    });
  });

  return io;
}

module.exports = { attachSocket };
