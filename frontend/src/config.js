// Where the API lives.
//  - npm run dev:   the backend on localhost:5000
//  - production:    the same address the site itself is served from (one server
//                   serves both the React app and the API), so this is ""
//  - VITE_API_URL:  set it only if the API is hosted somewhere else
export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:5000" : "");
