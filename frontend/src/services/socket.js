import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;

export const initSocket = (userId) => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
  }

  if (userId) {
    if (socket.connected) {
      socket.emit("join_room", userId);
    } else {
      socket.on("connect", () => {
        socket.emit("join_room", userId);
      });
    }
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
