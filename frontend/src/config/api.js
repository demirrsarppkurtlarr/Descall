const DEFAULT_API_BASE_URL = "https://YOUR-RENDER-URL.onrender.com";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");

export const API_ROUTES = {
  login: "/auth/login",
  register: "/auth/register",
  me: "/auth/me",
};
