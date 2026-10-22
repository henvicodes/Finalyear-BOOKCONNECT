import axios from "axios";

// The real login token lives in an httpOnly cookie the browser manages; page
// scripts cannot read it. Components still pass `user.token` around (older code),
// so it holds this harmless placeholder, which the server ignores when the cookie
// is present.
export const SESSION_PLACEHOLDER = "cookie-session";

// Sent on every request. A page on another website can't add a custom header
// to a cross-origin request, so the API uses it to reject forged requests.
export const APP_HEADERS = { "X-Requested-With": "BookConnect" };

let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

const AUTH_PATHS = /\/api\/auth\/(login|send-otp|verify-otp|resend-otp|logout)/;

// Makes an axios instance send the cookie + header, and log the user out in the
// UI when the server says the session is gone (expired or cleared).
export function configureAxios(instance) {
  instance.defaults.withCredentials = true;
  Object.assign(instance.defaults.headers.common, APP_HEADERS);
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = error.config?.url || "";
      if (error.response?.status === 401 && !AUTH_PATHS.test(url) && onUnauthorized) {
        onUnauthorized();
      }
      return Promise.reject(error);
    }
  );
  return instance;
}

configureAxios(axios);
