// Single place for HTTP config. Set values in .env (see .env.example).
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// ---------- auth token ----------
// Kept in sessionStorage so a page refresh doesn't log the user out, but it is cleared when the tab closes.
const TOKEN_KEY = 'weathergpt_token';
let token = null;
try { token = sessionStorage.getItem(TOKEN_KEY); } catch { /* storage unavailable */ }

export const getToken = () => token;
export function setToken(t) {
  token = t || null;
  try { token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
export const clearToken = () => setToken(null);

// App registers a callback here so any 401 from the backend logs the user out.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn || (() => {}); };

// ---------- errors ----------
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// ---------- requests ----------
async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection or that the backend is running.', 0);
  }

  if (res.status === 401 && token) { // session expired / token rejected
    clearToken();
    onUnauthorized();
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail || ''; } catch { /* non-JSON error body */ }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return res.json();
}

export const get = (path, params = {}) => {
  const qs = new URLSearchParams(params).toString();
  return request(qs ? `${path}?${qs}` : path);
};
export const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
