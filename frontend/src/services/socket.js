import { io } from "socket.io-client";

import { API_URL } from "../config";
const SOCKET_URL = API_URL;

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
    socket = io(SOCKET_URL || undefined, {
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
