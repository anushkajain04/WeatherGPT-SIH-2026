// Every backend call the UI makes lives here.
import { get, post, patch, USE_MOCK, setToken, clearToken } from './client';
import { WEATHER, HOURLY, DAILY, AQI, MOCK_ALERTS, ROLES } from '../data/mockData';

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

/** POST /api/auth/otp/request  { contact }  →  { success: true, message: string } */
export async function requestOtp(contact) {
  if (USE_MOCK) {
    await wait();
    return { success: true, ok: true, message: 'OTP sent (mock)' };
  }
  return post('/auth/otp/request', { contact });
}

/**
 * POST /api/auth/otp/verify  { contact, code, profile? }  →  { success: true, user }
 * Supports verifyOtp(contact, code, profile) or verifyOtp({ contact, code, profile })
 */
export async function verifyOtp(contactOrObj, maybeCode, maybeProfile) {
  if (USE_MOCK) {
    await wait();
    const contact = typeof contactOrObj === 'object' ? contactOrObj.contact : contactOrObj;
    const profile = typeof contactOrObj === 'object' ? contactOrObj.profile : maybeProfile;
    const user = {
      id: 'mock-user-1',
      contact,
      phone: contact && !contact.includes('@') ? contact : null,
      email: contact && contact.includes('@') ? contact : null,
      role: profile?.role || 'normal_user',
      location: profile?.location || 'Pune, Maharashtra',
      preferredLanguage: profile?.preferredLanguage || 'en',
    };
    return { success: true, ok: true, user };
  }

  let body;
  if (typeof contactOrObj === 'object' && contactOrObj !== null) {
    body = contactOrObj;
  } else {
    body = {
      contact: contactOrObj,
      code: maybeCode,
      ...(maybeProfile ? { profile: maybeProfile } : {}),
    };
  }

  const res = await post('/auth/otp/verify', body);
  if (res?.token) setToken(res.token);
  return { ok: true, ...res };
}

/** GET /api/auth/me  →  { success: true, user } */
export async function getMe() {
  if (USE_MOCK) {
    await wait(100);
    return { success: true, user: null };
  }
  return get('/auth/me');
}

/** PATCH /api/auth/me  { role?, location?, preferredLanguage? }  →  { success: true, user } */
export async function updateMe(profile) {
  if (USE_MOCK) {
    await wait(150);
    return { success: true, user: profile };
  }
  return patch('/auth/me', profile);
}

/** POST /api/auth/logout  →  { success: true } */
export async function logout() {
  clearToken();
  if (USE_MOCK) {
    await wait(100);
    return { success: true, ok: true };
  }
  try {
    return await post('/auth/logout', {});
  } catch {
    return { success: true, ok: true };
  }
}
export const logoutSession = logout;

/** POST /api/auth/link/request  { contact }  →  { success: true, message } */
export async function requestLinkOtp(contact) {
  if (USE_MOCK) {
    await wait();
    return { success: true, ok: true };
  }
  return post('/auth/link/request', { contact });
}

/** POST /api/auth/link/verify  { contact, code }  →  { success: true, user } */
export async function verifyLinkOtp(contact, code) {
  if (USE_MOCK) {
    await wait();
    return { success: true, ok: true };
  }
  return post('/auth/link/verify', { contact, code });
}

/**
 * GET /api/city/resolve?lat=&lon=
 * Resolves coordinates into an Indian city name
 */
export async function resolveCity(latOrCoords, maybeLon) {
  if (USE_MOCK) {
    await wait(150);
    return { city: 'Pune, Maharashtra' };
  }
  let lat = latOrCoords;
  let lon = maybeLon;
  if (typeof latOrCoords === 'object' && latOrCoords !== null) {
    lat = latOrCoords.lat ?? latOrCoords.latitude;
    lon = latOrCoords.lon ?? latOrCoords.longitude;
  }
  return get('/city/resolve', { lat, lon });
}

/**
 * GET /dashboard?location=&role=
 * → { weather, hourly[], daily[], aqi, alerts[], advisory }
 */
export async function fetchDashboard({ location, role }) {
  if (USE_MOCK) {
    await wait(150);
    const advisory = ROLES[role] || (role === 'normal_user' ? ROLES.citizen : ROLES.citizen);
    return { weather: WEATHER, hourly: HOURLY, daily: DAILY, aqi: AQI, alerts: MOCK_ALERTS, advisory };
  }
  return get('/dashboard', { location, role });
}

/** POST /chat  { message, language, location, role }  →  { reply, type? } */
export async function sendChat({ message, language, location, role }) {
  if (USE_MOCK) return null;
  return post('/chat', { message, language, location, role });
}
