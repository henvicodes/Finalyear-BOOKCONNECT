import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;
let socketToken = null;

// The server identifies the user from the login token sent in the handshake,
// so no user id is passed (or trusted). Reconnects if the login changes.
export const initSocket = () => {
  let token = null;
  try {
    token = JSON.parse(localStorage.getItem("user") || "{}").token || null;
  } catch {
    token = null;
  }
  if (!token) return null;

  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socketToken = token;
    socket = io(SOCKET_URL, {
      auth: { token },
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
    socketToken = null;
  }
};
