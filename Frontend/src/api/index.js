// Every backend call the UI makes lives here.
import { get, post, patch, apiFetch, USE_MOCK, setToken, clearToken } from './client';
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
 * GET /api/city/resolve-pincode?pincode=
 * Resolves an Indian 6-digit PIN code into city, state, formatted
 */
export async function resolveCityByPincode(pincode) {
  if (USE_MOCK) {
    await wait(150);
    return { city: 'Pune', state: 'Maharashtra', formatted: 'Pune, Maharashtra' };
  }
  return get('/city/resolve-pincode', { pincode: String(pincode).trim() });
}

/**
 * GET /api/city/search?q=
 * Searches Indian places by name via Open-Meteo
 */
export async function searchPlaces(query) {
  if (USE_MOCK) {
    await wait(150);
    return [
      { label: 'Pune, Maharashtra', name: 'Pune', state: 'Maharashtra', lat: 18.52, lon: 73.86 },
    ];
  }
  const clean = String(query || '').trim();
  if (clean.length < 3) return [];
  return get('/city/search', { q: clean });
}

/**
 * GET /dashboard?location=&role=&lat=&lon=
 * → { weather, hourly[], daily[], aqi, alerts[], advisory }
 */
export async function fetchDashboard({ location, role, lat, lon }) {
  if (USE_MOCK) {
    await wait(150);
    const advisory = ROLES[role] || (role === 'normal_user' ? ROLES.citizen : ROLES.citizen);
    return { weather: WEATHER, hourly: HOURLY, daily: DAILY, aqi: AQI, alerts: MOCK_ALERTS, advisory };
  }
  const params = { location, role };
  if (lat != null && lon != null && !isNaN(Number(lat)) && !isNaN(Number(lon))) {
    params.lat = Number(Number(lat).toFixed(2));
    params.lon = Number(Number(lon).toFixed(2));
  }
  return get('/dashboard', params);
}

/**
 * POST /chat  { query, role?, location?, language?, sessionId? }
 * →  { answer, answerEnglish, detectedLanguage, languageConfidence, translationFailed, route, model_used, latency, timings }
 */
export async function sendChat(payload) {
  if (USE_MOCK) return null;

  const rawQuery = (payload?.query || payload?.text || payload?.message || '').trim();
  const body = { query: rawQuery };

  const WHITELISTED_ROLES = ['normal_user', 'farmer', 'commuter', 'tourist', 'outdoor_worker'];
  let role = payload?.role;
  if (role === 'citizen') role = 'normal_user';
  if (role && WHITELISTED_ROLES.includes(role)) {
    body.role = role;
  }

  // Extract city part before first comma, Latin letters, spaces, hyphens only
  let rawLoc = payload?.location;
  if (typeof rawLoc === 'object' && rawLoc !== null) {
    rawLoc = rawLoc.label || rawLoc.city || rawLoc.name || '';
  }
  if (!rawLoc && payload?.fallbackLocation) {
    rawLoc = typeof payload.fallbackLocation === 'object'
      ? payload.fallbackLocation.label || payload.fallbackLocation.city || ''
      : payload.fallbackLocation;
  }

  if (typeof rawLoc === 'string' && rawLoc.trim()) {
    const cityPart = rawLoc.split(',')[0].split(' · ')[0];
    const cleanLocation = cityPart.replace(/[^a-zA-Z\s-]/g, '').trim();
    if (cleanLocation) {
      body.location = cleanLocation;
    }
  }

  console.debug('sendChat location sent:', body.location);

  if (payload?.language && typeof payload.language === 'string') {
    const cleanLanguage = payload.language.trim().toLowerCase();
    if (cleanLanguage) {
      body.language = cleanLanguage;
    }
  }

  if (payload?.sessionId) {
    const cleanSessionId = String(payload.sessionId)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 100);
    if (cleanSessionId) {
      body.sessionId = cleanSessionId;
    }
  }

  if (payload?.lat != null && payload?.lon != null && !isNaN(Number(payload.lat)) && !isNaN(Number(payload.lon))) {
    body.lat = Number(Number(payload.lat).toFixed(2));
    body.lon = Number(Number(payload.lon).toFixed(2));
  }

  if (import.meta.env?.DEV) {
    console.log('sendChat payload:', JSON.stringify(body));
  }

  return apiFetch('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs: 95000,
  });
}
