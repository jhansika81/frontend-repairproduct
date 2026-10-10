import { getAuthToken } from "./auth";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080"
).replace(/\/+$/, "");

export function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const originalUrl = String(input);

  const url =
    originalUrl.startsWith("http://localhost:8080") ||
    originalUrl.startsWith("https://localhost:8080")
      ? originalUrl.replace(
          /^https?:\/\/localhost:8080/,
          API_BASE_URL
        )
      : originalUrl.startsWith("http://") ||
          originalUrl.startsWith("https://")
        ? originalUrl
        : `${API_BASE_URL}${originalUrl.startsWith("/") ? "" : "/"}${originalUrl}`;

  return fetch(url, {
    ...init,
    headers,
    credentials: "omit",
  });
}