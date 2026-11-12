/**
 * Axios instance pre-configured with base URL, auth headers,
 * and automatic token refresh on 401.
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// No global Content-Type: axios infers JSON for plain objects and lets the
// browser set the multipart boundary for FormData uploads.
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
});

// Attach the access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401 — attempt token refresh once, then redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refreshToken}` },
        });
        localStorage.setItem("access_token", data.access_token);
        // Notify AuthContext so it can re-derive the role from the new token.
        window.dispatchEvent(new Event("auth:token-refreshed"));
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
