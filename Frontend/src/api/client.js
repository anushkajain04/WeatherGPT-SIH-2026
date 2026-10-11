// Single place for HTTP config. Set values in .env (see .env.example).
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// ---------- auth token ----------
// Kept in sessionStorage for optional Bearer fallback; session is primary via httpOnly cookie wgpt_session.
const TOKEN_KEY = 'weathergpt_token';
let token = null;
try {
  token = sessionStorage.getItem(TOKEN_KEY);
} catch {
  /* storage unavailable */
}

export const getToken = () => token;
export function setToken(t) {
  token = t || null;
  try {
    token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
export const clearToken = () => setToken(null);

// App registers a callback here so any 401 from the backend logs the user out.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn || (() => {});
};

// ---------- errors ----------
export class ApiError extends Error {
  constructor(message, status = 0, code = null, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

// ---------- requests ----------
export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(isMutating ? { 'X-Requested-With': 'WeatherGPT' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${BASE.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

  const timeoutMs = options.timeoutMs;
  const controller = new AbortController();
  let timer = null;
  if (timeoutMs) {
    timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }
  const signal = options.signal || (timeoutMs ? controller.signal : undefined);

  let res;
  try {
    res = await fetch(url, {
      ...options,
      method,
      credentials: 'include',
      headers,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out', 504, 'TIMEOUT');
    }
    throw new ApiError('Cannot reach the server. Check your connection or that the backend is running.', 0);
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (res.status === 401) {
    clearToken();
    onUnauthorized();
  }

  if (!res.ok) {
    let errData = null;
    try {
      errData = await res.json();
    } catch {
      /* non-JSON error body */
    }

    const message =
      errData?.error?.message ||
      (typeof errData?.error === 'string' ? errData.error : null) ||
      errData?.detail ||
      errData?.message ||
      `Request failed (${res.status})`;

    const code = errData?.error?.code || errData?.code || null;
    throw new ApiError(message, res.status, code, errData);
  }

  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const get = (path, params = {}) => {
  const cleanParams = Object.fromEntries(
    Object.entries(params).filter(([_, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(cleanParams).toString();
  return apiFetch(qs ? `${path}?${qs}` : path, { method: 'GET' });
};

export const post = (path, body) =>
  apiFetch(path, {
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const patch = (path, body) =>
  apiFetch(path, {
    method: 'PATCH',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const put = (path, body) =>
  apiFetch(path, {
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });

export const del = (path, body) =>
  apiFetch(path, {
    method: 'DELETE',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
