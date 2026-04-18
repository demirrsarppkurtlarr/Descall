// For Electron: use localhost backend
// For Web: use same origin (if backend served together) or env variable
const isElectron = typeof navigator !== "undefined" && navigator.userAgent?.includes("Electron");
const LOCAL_API = "http://localhost:3000";

// Try to auto-detect backend URL
function getApiUrl() {
  // Electron: always localhost
  if (isElectron) return LOCAL_API;
  
  // Web: use env variable, or empty for same-origin
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl !== "https://YOUR-RENDER-URL.onrender.com") {
    return envUrl.replace(/\/+$/, "");
  }
  
  // Fallback: try same origin (if backend on same domain)
  return "";
}

export const API_BASE_URL = getApiUrl();

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
