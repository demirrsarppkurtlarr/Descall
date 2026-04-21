import { API_BASE_URL } from "../config/api";
import { getToken } from "../lib/storage";

export async function adminFetch(path, options = {}) {
  const token = getToken();
  const url = `${API_BASE_URL}/admin${path}`;
  
  console.log("[adminFetch] Request:", options.method || "GET", url);
  
  // Don't set Content-Type for FormData (browser sets it with boundary)
  const isFormData = options.body instanceof FormData;
  
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };
  
  // Only add Content-Type if not FormData
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  
  const res = await fetch(url, {
    ...options,
    headers,
  });
  
  console.log("[adminFetch] Response status:", res.status);
  
  const body = await res.json().catch(() => ({}));
  
  if (!res.ok) {
    console.error("[adminFetch] Error:", body);
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  
  return body;
}
