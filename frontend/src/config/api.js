// API URL configuration
// - Electron: localhost:3000
// - Web: hardcoded production backend URL
const isElectron = typeof navigator !== "undefined" && navigator.userAgent?.includes("Electron");
const LOCAL_API = "http://localhost:3000";
const PRODUCTION_API = "https://descall-qzkg.onrender.com";

export const API_BASE_URL = isElectron
  ? LOCAL_API
  : PRODUCTION_API;

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
