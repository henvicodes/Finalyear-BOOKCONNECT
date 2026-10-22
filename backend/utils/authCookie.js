// The login JWT lives in an httpOnly cookie, so JavaScript on the page (and so
// any injected script) can never read it. The browser attaches it to API calls
// and to the Socket.io handshake automatically.
const COOKIE_NAME = "bc_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // matches the 7d JWT lifetime

// Frontend and API on different *sites* (e.g. two domains in production) need
// SameSite=None + Secure. On localhost (different ports, same site) Lax is right.
const options = () => {
  const crossSite = process.env.COOKIE_SAMESITE === "none";
  return {
    httpOnly: true,
    secure: crossSite || process.env.NODE_ENV === "production",
    sameSite: crossSite ? "none" : "lax",
    path: "/",
  };
};

const setAuthCookie = (res, token) => res.cookie(COOKIE_NAME, token, { ...options(), maxAge: MAX_AGE_MS });
const clearAuthCookie = (res) => res.clearCookie(COOKIE_NAME, options());

// Header the browser app adds to every request. A different website can't add a
// custom header to a cross-origin request without a CORS preflight (which our
// CORS rules refuse), so requiring it blocks cross-site request forgery.
const CSRF_HEADER = "x-requested-with";
const CSRF_VALUE = "BookConnect";

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie, CSRF_HEADER, CSRF_VALUE };
