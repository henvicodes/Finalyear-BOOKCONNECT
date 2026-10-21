import axios from "axios";
import { configureAxios } from "./session";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Authentication is the httpOnly session cookie (see utils/session.js).
const api = configureAxios(
  axios.create({
    baseURL: API_URL,
    headers: {
      "Content-Type": "application/json",
    },
  })
);

export default api;
