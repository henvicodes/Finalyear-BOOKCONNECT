import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;
let socketUserId = null;

// The server identifies the user from the httpOnly session cookie sent with the
// handshake (withCredentials), so no token or user id is passed or trusted.
// A fresh connection is made whenever a different user logs in.
export const initSocket = () => {
  let userId = null;
  try {
    userId = JSON.parse(localStorage.getItem("user") || "{}")._id || null;
  } catch {
    userId = null;
  }
  if (!userId) return null;

  if (socket && socketUserId !== userId) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socketUserId = userId;
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    socketUserId = null;
  }
};
