import { getAuthToken } from "./auth";

export function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers || {});
  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers, credentials: "omit" });
}
