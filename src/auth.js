const TOKEN_KEY = "authToken";
const USER_KEY = "user";

export function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthSession(token, user) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setAuthUser(user) {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getCurrentUser() {
  try {
    const user = JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    return user && typeof user === "object" ? user : null;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}
