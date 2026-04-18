// For Electron: use localhost backend
// For Web: use environment variable or external URL
const isElectron = typeof navigator !== "undefined" && navigator.userAgent?.includes("Electron");
const LOCAL_API = "http://localhost:3000";
const DEFAULT_API_BASE_URL = "https://descall-1.onrender.com";

export const API_BASE_URL = isElectron
  ? LOCAL_API
  : (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
