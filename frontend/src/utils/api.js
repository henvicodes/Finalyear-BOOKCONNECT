import axios from "axios";
import { configureAxios } from "./session";

import { API_URL } from "../config";

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
