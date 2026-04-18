import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

export async function adminFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/admin${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return body;
}
