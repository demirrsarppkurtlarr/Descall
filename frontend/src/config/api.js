// API URL configuration
// - Electron: localhost:3000
// - Web: use VITE_API_BASE_URL env variable or default to production backend
const isElectron = typeof navigator !== "undefined" && navigator.userAgent?.includes("Electron");
const LOCAL_API = "http://localhost:3000";
const envUrl = import.meta.env.VITE_API_BASE_URL;
const PRODUCTION_API = "https://descall-qzkg.onrender.com";

export const API_BASE_URL = isElectron
  ? LOCAL_API
  : (envUrl || PRODUCTION_API).replace(/\/+$/, "");

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
