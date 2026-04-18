// API URL configuration
// - Electron: localhost:3000
// - Web: empty string = same origin (when backend serves frontend)
// - Or use VITE_API_BASE_URL env variable for separate backend
const isElectron = typeof navigator !== "undefined" && navigator.userAgent?.includes("Electron");
const LOCAL_API = "http://localhost:3000";
const envUrl = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL = isElectron
  ? LOCAL_API
  : (envUrl || "").replace(/\/+$/, "");

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
