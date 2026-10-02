// Every backend call the UI makes lives here. In mock mode (VITE_USE_MOCK=true, the default)
// each function returns mock data, so the app runs without a backend.
// Backend team: implement the endpoints below, set VITE_USE_MOCK=false — no component changes needed.
import { get, post, USE_MOCK, setToken, clearToken } from './client';
import { WEATHER, HOURLY, DAILY, AQI, MOCK_ALERTS, ROLES } from '../data/mockData';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/** POST /auth/request-otp  { contact }  →  { ok: true } */
export async function requestOtp(contact) {
  if (USE_MOCK) { await wait(); return { ok: true }; }
  return post('/auth/request-otp', { contact });
}

/** POST /auth/verify-otp  { contact, otp }  →  { ok: true, token? } */
export async function verifyOtp(contact, otp) {
  if (USE_MOCK) { await wait(); return { ok: true }; }
  const res = await post('/auth/verify-otp', { contact, otp });
  if (res?.token) setToken(res.token); // sent as `Authorization: Bearer <token>` on all later calls
  return res;
}

/** Clears the stored auth token (call on logout). */
export function logoutSession() { clearToken(); }

/**
 * GET /dashboard?location=&role=
 * → { weather, hourly[], daily[], aqi, alerts[], advisory }   (same shapes as src/data/mockData.js)
 */
export async function fetchDashboard({ location, role }) {
  if (USE_MOCK) {
    await wait(150);
    return { weather: WEATHER, hourly: HOURLY, daily: DAILY, aqi: AQI, alerts: MOCK_ALERTS, advisory: ROLES[role] || ROLES.citizen };
  }
  return get('/dashboard', { location, role });
}

/** POST /chat  { message, language, location, role }  →  { reply, type? }   type: 'assistant' | 'alert' */
export async function sendChat({ message, language, location, role }) {
  if (USE_MOCK) return null; // no assistant in the UI-only prototype
  return post('/chat', { message, language, location, role });
}
