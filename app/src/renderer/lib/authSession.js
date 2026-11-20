import {
  normalizeApiBaseUrl,
  isSecureApiUrl,
  areSameQaqmServiceUrl,
} from "./marketApi.js";
const AUTH_STORAGE_KEY = "qaqm-auth-session";
let memoryCache = null;
const subscribers = new Set();
function readFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}
memoryCache = readFromStorage();
function getCachedAuthSession() {
  return memoryCache;
}
function notifyAuthSessionChanged() {
  const next = readFromStorage();
  memoryCache = next;
  for (const listener of [...subscribers]) {
    try {
      listener(next);
    } catch (error) {
      console.error("Auth session listener failed:", error);
    }
  }
  return next;
}
function writeAuthSession(session) {
  try {
    if (session?.token) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch {}
  return notifyAuthSessionChanged();
}
function clearAuthSession() {
  return writeAuthSession(null);
}
function reloadAuthSession() {
  return notifyAuthSessionChanged();
}
function getAuthSessionIdentity(session = memoryCache) {
  const token = String(session?.token || "").trim();
  const serverUrl = token ? normalizeApiBaseUrl(session?.serverUrl || "") : "";
  return token ? `${serverUrl}|${token}` : "anonymous";
}
function subscribeAuthSession(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}
function readAuthSession(currentServerUrl) {
  const saved = memoryCache || readFromStorage();
  if (!saved?.token) return null;
  if (!isSecureApiUrl(saved.serverUrl)) return null;
  if (currentServerUrl && !isSecureApiUrl(currentServerUrl)) return null;
  if (
    currentServerUrl &&
    saved.serverUrl &&
    !areSameQaqmServiceUrl(saved.serverUrl, currentServerUrl)
  )
    return null;
  return saved;
}
export {
  getAuthSessionIdentity,
  readAuthSession,
  subscribeAuthSession,
  getCachedAuthSession,
  writeAuthSession,
  clearAuthSession,
  reloadAuthSession,
};
if (typeof window !== "undefined" && window.addEventListener) {
  // A login performed by another document in the same origin (or a future
  // auth window) lands here; same-document writers call writeAuthSession.
  window.addEventListener("storage", (event) => {
    if (event.key === AUTH_STORAGE_KEY || event.key === null) {
      notifyAuthSessionChanged();
    }
  });
}
