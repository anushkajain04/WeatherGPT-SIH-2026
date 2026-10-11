import env from '../config/env.js';
import httpClient from '../utils/http-client.js';
import { CacheService } from './cache.service.js';
import { AppError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// 10-minute cache for combined dashboard results; 30-day cache for geocoding
const dashboardCache = new CacheService({ pruneIntervalMs: 5 * 60 * 1000 });
const geocodingCache = new CacheService({ pruneIntervalMs: 60 * 60 * 1000 });

const GEO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const DASH_TTL_MS = 10 * 60 * 1000;          // 10 minutes

function getWeatherEmoji(weatherId) {
  if (!weatherId) return '⛅';
  if (weatherId >= 200 && weatherId < 300) return '⛈️';
  if (weatherId >= 300 && weatherId < 600) return '🌧️';
  if (weatherId >= 600 && weatherId < 700) return '❄️';
  if (weatherId >= 700 && weatherId < 800) return '🌫️';
  if (weatherId === 800) return '☀️';
  if (weatherId === 801 || weatherId === 802) return '⛅';
  return '☁️';
}

function getConditionGroup(weatherId) {
  if (!weatherId) return 'clear';
  if (weatherId >= 200 && weatherId < 300) return 'thunderstorm';
  if (weatherId >= 300 && weatherId < 400) return 'drizzle';
  if (weatherId >= 500 && weatherId < 600) return 'rain';
  if (weatherId >= 600 && weatherId < 700) return 'snow';
  if (weatherId >= 700 && weatherId < 800) return 'atmosphere';
  if (weatherId === 800) return 'clear';
  if (weatherId > 800) return 'clouds';
  return 'clear';
}

/**
 * Calculates India CPCB-style AQI sub-index for PM2.5.
 * Bands (µg/m³ to AQI):
 * 0–30 -> 0–50
 * 31–60 -> 51–100
 * 61–90 -> 101–200
 * 91–120 -> 201–300
 * 121–250 -> 301–400
 * >250 -> 401–500
 */
function interpolateAQIPM25(pm25) {
  if (pm25 <= 0) return 0;
  if (pm25 <= 30) return (50 / 30) * pm25;
  if (pm25 <= 60) return ((100 - 51) / (60 - 30)) * (pm25 - 30) + 51;
  if (pm25 <= 90) return ((200 - 101) / (90 - 60)) * (pm25 - 60) + 101;
  if (pm25 <= 120) return ((300 - 201) / (120 - 90)) * (pm25 - 90) + 201;
  if (pm25 <= 250) return ((400 - 301) / (250 - 120)) * (pm25 - 120) + 301;
  return Math.min(500, ((500 - 401) / (380 - 250)) * (pm25 - 250) + 401);
}

/**
 * Calculates India CPCB-style AQI sub-index for PM10.
 * Bands (µg/m³ to AQI):
 * 0–50 -> 0–50
 * 51–100 -> 51–100
 * 101–250 -> 101–200
 * 251–350 -> 201–300
 * 351–430 -> 301–400
 * >430 -> 401–500
 */
function interpolateAQIPM10(pm10) {
  if (pm10 <= 0) return 0;
  if (pm10 <= 50) return pm10;
  if (pm10 <= 100) return ((100 - 51) / (100 - 50)) * (pm10 - 50) + 51;
  if (pm10 <= 250) return ((200 - 101) / (250 - 100)) * (pm10 - 100) + 101;
  if (pm10 <= 350) return ((300 - 201) / (350 - 250)) * (pm10 - 250) + 201;
  if (pm10 <= 430) return ((400 - 301) / (430 - 350)) * (pm10 - 350) + 301;
  return Math.min(500, ((500 - 401) / (510 - 430)) * (pm10 - 430) + 401);
}

function getAQICategory(value) {
  if (value <= 50) {
    return {
      label: 'Good',
      note: 'Air quality is satisfactory and poses little or no risk (estimated CPCB index).',
    };
  }
  if (value <= 100) {
    return {
      label: 'Satisfactory',
      note: 'Minor breathing discomfort to sensitive people (estimated CPCB index).',
    };
  }
  if (value <= 200) {
    return {
      label: 'Moderate',
      note: 'Breathing discomfort to people with lung disease and children (estimated CPCB index).',
    };
  }
  if (value <= 300) {
    return {
      label: 'Poor',
      note: 'Breathing discomfort to most people on prolonged exposure (estimated CPCB index).',
    };
  }
  if (value <= 400) {
    return {
      label: 'Very Poor',
      note: 'Respiratory illness on prolonged exposure (estimated CPCB index).',
    };
  }
  return {
    label: 'Severe',
    note: 'Health alert: serious risk of respiratory symptoms for all (estimated CPCB index).',
  };
}

function generateAdvisory({ role, conditionGroup, feelsLike, aqiValue, rainProbability, windSpeed }) {
  const roleThemes = {
    normal_user: { icon: '👤', bg: '#FDF0DA', title: 'General Safety Advisory' },
    citizen: { icon: '👤', bg: '#FDF0DA', title: 'General Safety Advisory' },
    farmer: { icon: '🌾', bg: '#E9F4EC', title: 'Advisory for Farmers · Kisan Cell' },
    commuter: { icon: '🚌', bg: '#E8F1FC', title: 'Commuter Travel Advisory' },
    tourist: { icon: '🧳', bg: '#F3EBF9', title: 'Traveler Weather Advisory' },
    outdoor_worker: { icon: '👷', bg: '#FFF4E5', title: 'Occupational Heat & Safety Advisory' },
  };

  const theme = roleThemes[role] || roleThemes.normal_user;

  // 1. Thunderstorm: stay indoors and avoid open areas
  if (conditionGroup === 'thunderstorm') {
    return {
      ...theme,
      headline: 'Thunderstorm active: stay indoors, avoid open areas, and keep clear of tall trees or structures.',
      stat1: ['Weather risk', 'Severe · Storm'],
      stat2: ['Safety action', 'Stay indoors'],
    };
  }

  // 2. Farmer specific: rain probability > 60% or wind > 25 km/h means avoid spraying
  if (role === 'farmer' && (rainProbability > 60 || windSpeed > 25)) {
    return {
      ...theme,
      headline: `Hold off chemical spraying and fertilizer broadcast — ${rainProbability > 60 ? 'high rain probability (' + rainProbability + '%)' : 'strong winds of ' + windSpeed + ' km/h'} may cause chemical drift or runoff.`,
      stat1: ['Rain chance', `${rainProbability}%`],
      stat2: ['Spraying', 'Not advised'],
    };
  }

  // 3. High heat index: feels-like 40 or above means hydrate and avoid midday sun
  if (feelsLike >= 40) {
    return {
      ...theme,
      headline: `High heat index (feels like ${feelsLike}°C): drink plenty of water, hydrate frequently, and avoid midday sun.`,
      stat1: ['Heat index', `${feelsLike}°C · High`],
      stat2: ['Hydration', 'Essential'],
    };
  }

  // 4. Poor air quality: estimated AQI above 200 means limit outdoor activity
  if (aqiValue && aqiValue > 200) {
    return {
      ...theme,
      headline: `Poor air quality (AQI ${aqiValue}): limit prolonged outdoor exertion and wear a protective mask outside.`,
      stat1: ['Air quality', `${aqiValue} · Poor`],
      stat2: ['Outdoor action', 'Limit exertion'],
    };
  }

  // 5. Normal / Favorable baseline per role
  if (role === 'farmer') {
    return {
      ...theme,
      headline: 'Favorable conditions for field monitoring. Ensure regular soil moisture checks.',
      stat1: ['Soil moisture', 'Moderate'],
      stat2: ['Field work', 'Normal'],
    };
  }
  if (role === 'commuter') {
    return {
      ...theme,
      headline: 'Clear transit conditions. Normal travel times expected on city routes.',
      stat1: ['Road condition', 'Clear'],
      stat2: ['Transit risk', 'Low'],
    };
  }
  if (role === 'tourist') {
    return {
      ...theme,
      headline: 'Pleasant weather for sightseeing and outdoor exploration.',
      stat1: ['Outdoor travel', 'Good'],
      stat2: ['Best time out', 'Morning / Evening'],
    };
  }
  if (role === 'outdoor_worker') {
    return {
      ...theme,
      headline: 'Manage hydration and take periodic shade breaks during shifts.',
      stat1: ['Work safety', 'Moderate'],
      stat2: ['Hydration', 'Recommended'],
    };
  }

  return {
    ...theme,
    headline: 'Weather conditions are stable. Safe for daily outdoor activities.',
    stat1: ['Overall risk', 'Low'],
    stat2: ['Outdoor safety', 'Safe'],
  };
}

export class DashboardService {
  /**
   * Resolves city/state coordinates using OpenWeatherMap Direct Geocoding API.
   * Caches result for 30 days.
   */
  async resolveCoordinates(location, apiKey) {
    const parts = (location || 'Pune').split(',').map((s) => s.trim());
    const cityName = parts[0].split(' · ')[0].replace(/[^a-zA-Z\s-]/g, '').trim() || 'Pune';
    const stateGiven = parts.length > 1 ? parts[1].split(' · ')[0].replace(/[^a-zA-Z\s-]/g, '').trim() : null;

    const cacheKey = `geo:${cityName.toLowerCase()}:${(stateGiven || '').toLowerCase()}`;
    const cached = geocodingCache.get(cacheKey);
    if (cached) return cached;

    // 1. Direct geocoding with ,IN
    let geoRes = await httpClient(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)},IN&limit=5&appid=${apiKey}`,
      { method: 'GET', timeoutMs: 8000, retries: 1 }
    );

    if (!geoRes.ok && geoRes.status === 401) {
      throw new AppError('Upstream weather service authentication failed. Please verify OPENWEATHER_API_KEY.', 502, 'UPSTREAM_WEATHER_AUTH_ERROR');
    }

    let items = [];
    if (geoRes.ok) {
      try {
        items = await geoRes.json();
      } catch {}
    }

    // Fallback without ,IN if no match found
    if (!items || items.length === 0) {
      geoRes = await httpClient(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cityName)}&limit=5&appid=${apiKey}`,
        { method: 'GET', timeoutMs: 8000, retries: 1 }
      );

      if (!geoRes.ok && geoRes.status === 401) {
        throw new AppError('Upstream weather service authentication failed. Please verify OPENWEATHER_API_KEY.', 502, 'UPSTREAM_WEATHER_AUTH_ERROR');
      }

      if (geoRes.ok) {
        try {
          const rawItems = await geoRes.json();
          // Never use non-Indian matches
          items = (rawItems || []).filter((it) => it.country === 'IN');
        } catch {}
      }
    }

    // Fallback: strip generic administrative words if both previous attempts found nothing
    const cleanedCity = cityName.replace(/\s+(?:Tahsil|Tehsil|Taluka|Taluk|Mandal|Block|District)$/i, '').trim();
    if ((!items || items.length === 0) && cleanedCity && cleanedCity.toLowerCase() !== cityName.toLowerCase()) {
      // Retry with cleaned city name + ,IN
      geoRes = await httpClient(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cleanedCity)},IN&limit=5&appid=${apiKey}`,
        { method: 'GET', timeoutMs: 8000, retries: 1 }
      );

      if (!geoRes.ok && geoRes.status === 401) {
        throw new AppError('Upstream weather service authentication failed. Please verify OPENWEATHER_API_KEY.', 502, 'UPSTREAM_WEATHER_AUTH_ERROR');
      }

      if (geoRes.ok) {
        try {
          items = await geoRes.json();
        } catch {}
      }

      // Retry cleaned city without ,IN if still empty, but only keep country === 'IN'
      if (!items || items.length === 0) {
        geoRes = await httpClient(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cleanedCity)}&limit=5&appid=${apiKey}`,
          { method: 'GET', timeoutMs: 8000, retries: 1 }
        );

        if (!geoRes.ok && geoRes.status === 401) {
          throw new AppError('Upstream weather service authentication failed. Please verify OPENWEATHER_API_KEY.', 502, 'UPSTREAM_WEATHER_AUTH_ERROR');
        }

        if (geoRes.ok) {
          try {
            const rawItems = await geoRes.json();
            items = (rawItems || []).filter((it) => it.country === 'IN');
          } catch {}
        }
      }
    }

    // Ensure non-Indian matches are never used
    const indianItems = (items || []).filter((it) => it.country === 'IN');
    if (!indianItems || indianItems.length === 0) {
      throw new NotFoundError(`Location "${location}" not found in India.`);
    }

    let selected = indianItems[0];
    if (stateGiven) {
      const match = indianItems.find(
        (it) =>
          it.state &&
          (it.state.toLowerCase().includes(stateGiven.toLowerCase()) ||
            stateGiven.toLowerCase().includes(it.state.toLowerCase()))
      );
      if (match) selected = match;
    }

    const geoData = {
      lat: selected.lat,
      lon: selected.lon,
      city: selected.name,
      country: selected.country || 'IN',
      state: selected.state || null,
    };

    logger.info({ location, resolved: geoData }, 'Resolved geocoding for dashboard');
    geocodingCache.set(cacheKey, geoData, GEO_TTL_MS);
    return geoData;
  }

  /**
   * Fetches weather, forecast, and AQI from OpenWeatherMap for dashboard display.
   *
   * @param {string} location - City or location name
   * @param {string} role - User role for tailored advisory
   * @param {{ lat?: number, lon?: number }} [coords] - Optional coordinates to skip geocoding
   */
  async getDashboardData(location = 'Pune, Maharashtra', role = 'normal_user', coords = {}) {
    const apiKey = env.OPENWEATHER_API_KEY || process.env.OPENWEATHER_API_KEY || process.env.API_KEY;

    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
      throw new AppError(
        'OpenWeatherMap API key is not configured or is a placeholder. Please set OPENWEATHER_API_KEY in your .env file.',
        503,
        'WEATHER_NOT_CONFIGURED'
      );
    }

    let lat;
    let lon;
    let cacheKey;
    let resolved;

    if (coords?.lat != null && coords?.lon != null) {
      // Direct coordinate mode: round to 2 decimals (~1.1 km precision)
      lat = Number(Number(coords.lat).toFixed(2));
      lon = Number(Number(coords.lon).toFixed(2));
      cacheKey = `dash:${lat.toFixed(2)}:${lon.toFixed(2)}:${role}`;
      resolved = {
        name: location.split(',')[0].trim(),
        country: 'IN',
        lat,
        lon,
      };
      logger.info({ location, coords, resolved }, 'Direct coordinate mode for dashboard');
    } else {
      // Resolve lat/lon by location name
      const geo = await this.resolveCoordinates(location, apiKey);
      lat = Number(Number(geo.lat).toFixed(2));
      lon = Number(Number(geo.lon).toFixed(2));
      cacheKey = `dash:${lat.toFixed(2)}:${lon.toFixed(2)}:${role}`;
      resolved = {
        name: geo.city,
        country: geo.country || 'IN',
        lat,
        lon,
      };
    }

    const cached = dashboardCache.get(cacheKey);
    if (cached) {
      return { ...cached, location, resolved };
    }

    // Parallel calls: current weather, 5-day forecast, air pollution
    const [weatherRes, forecastRes, airRes] = await Promise.all([
      httpClient(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
        { method: 'GET', timeoutMs: 8000, retries: 1 }
      ),
      httpClient(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
        { method: 'GET', timeoutMs: 8000, retries: 1 }
      ),
      httpClient(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`,
        { method: 'GET', timeoutMs: 8000, retries: 1 }
      ).catch(() => null),
    ]);

    if (!weatherRes.ok) {
      logger.warn({ lat, lon, status: weatherRes.status }, 'OpenWeather /data/2.5/weather returned non-200');
      if (weatherRes.status === 404) {
        throw new NotFoundError(`Location "${location}" not found.`);
      }
      if (weatherRes.status === 401) {
        throw new AppError('Upstream weather service authentication failed. Please verify OPENWEATHER_API_KEY.', 502, 'UPSTREAM_WEATHER_AUTH_ERROR');
      }
      throw new AppError(`Upstream weather service failed with status ${weatherRes.status}.`, 502, 'UPSTREAM_WEATHER_ERROR');
    }

    if (!forecastRes.ok) {
      logger.warn({ lat, lon, status: forecastRes.status }, 'OpenWeather /data/2.5/forecast returned non-200');
      if (forecastRes.status === 404) {
        throw new NotFoundError(`Forecast for location "${location}" not found.`);
      }
      if (forecastRes.status === 401) {
        throw new AppError('Upstream weather service authentication failed. Please verify OPENWEATHER_API_KEY.', 502, 'UPSTREAM_WEATHER_AUTH_ERROR');
      }
      throw new AppError(`Upstream weather forecast failed with status ${forecastRes.status}.`, 502, 'UPSTREAM_WEATHER_ERROR');
    }

    const cur = await weatherRes.json();
    const forecastData = await forecastRes.json();

    let airData = null;
    if (airRes && airRes.ok) {
      try {
        airData = await airRes.json();
      } catch (e) {
        logger.warn({ error: e.message }, 'Failed to parse OpenWeather air pollution response');
      }
    }

    const tzOffsetSeconds = forecastData.city?.timezone ?? 19800;
    const mainWeather = cur.weather?.[0] || {};
    const conditionGroup = getConditionGroup(mainWeather.id);

    // Rain percentage from the next forecast slot's pop * 100
    const nextSlot = forecastData.list?.[0];
    const rainPercentage = Math.round((nextSlot?.pop ?? 0) * 100);

    // Current weather
    const weather = {
      temp: Math.round(cur.main?.temp ?? 28),
      icon: getWeatherEmoji(mainWeather.id),
      summary: (mainWeather.description || 'Clear sky')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      feelsLike: Math.round(cur.main?.feels_like ?? cur.main?.temp ?? 28),
      high: Math.round(cur.main?.temp_max ?? 32),
      low: Math.round(cur.main?.temp_min ?? 22),
      rain: rainPercentage,
      humidity: Math.round(cur.main?.humidity ?? 65),
      wind: Math.round((cur.wind?.speed || 0) * 3.6), // convert m/s to km/h
      id: mainWeather.id,
      group: conditionGroup,
      updatedAt: new Date().toISOString(),
    };

    // Hourly Forecast: "Now" (current weather) followed by the next 5 forecast slots at their own local times
    const hourly = [
      {
        time: 'Now',
        icon: weather.icon,
        temp: `${weather.temp}°`,
      },
      ...(forecastData.list || []).slice(0, 5).map((slot) => {
        const localDate = new Date((slot.dt + tzOffsetSeconds) * 1000);
        const hour = localDate.getUTCHours();
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return {
          time: `${h12} ${ampm}`,
          icon: getWeatherEmoji(slot.weather?.[0]?.id),
          temp: `${Math.round(slot.main?.temp ?? 28)}°`,
        };
      }),
    ];

    // 5-day list: Group entries by local date
    const todayKey = new Date((Date.now() / 1000 + tzOffsetSeconds) * 1000).toISOString().slice(0, 10);
    const daysMap = new Map();

    for (const item of forecastData.list || []) {
      const localMs = (item.dt + tzOffsetSeconds) * 1000;
      const localDate = new Date(localMs);
      const dateKey = localDate.toISOString().slice(0, 10);

      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, {
          dateKey,
          localDate,
          entries: [],
          high: item.main?.temp_max ?? item.main?.temp ?? 30,
          low: item.main?.temp_min ?? item.main?.temp ?? 20,
          maxPop: item.pop ?? 0,
        });
      }

      const dayObj = daysMap.get(dateKey);
      dayObj.entries.push(item);
      dayObj.high = Math.max(dayObj.high, item.main?.temp_max ?? item.main?.temp ?? 30);
      dayObj.low = Math.min(dayObj.low, item.main?.temp_min ?? item.main?.temp ?? 20);
      dayObj.maxPop = Math.max(dayObj.maxPop, item.pop ?? 0);
    }

    // Today's high and low must also consider current temperature
    if (daysMap.has(todayKey)) {
      const todayObj = daysMap.get(todayKey);
      todayObj.high = Math.max(todayObj.high, cur.main?.temp ?? 0, cur.main?.temp_max ?? 0);
      todayObj.low = Math.min(todayObj.low, cur.main?.temp ?? 100, cur.main?.temp_min ?? 100);
      weather.high = Math.round(todayObj.high);
      weather.low = Math.round(todayObj.low);
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daily = Array.from(daysMap.values())
      .slice(0, 5)
      .map((d) => {
        const isToday = d.dateKey === todayKey;
        const dayLabel = isToday ? 'Today' : dayNames[d.localDate.getUTCDay()];

        // Pick entry closest to 12:00 local time
        let closestEntry = d.entries[0] || {};
        let minDiff = 24;
        for (const entry of d.entries) {
          const h = new Date((entry.dt + tzOffsetSeconds) * 1000).getUTCHours();
          const diff = Math.abs(h - 12);
          if (diff < minDiff) {
            minDiff = diff;
            closestEntry = entry;
          }
        }

        return {
          day: dayLabel,
          icon: getWeatherEmoji(closestEntry.weather?.[0]?.id),
          high: `${Math.round(d.high)}°`,
          low: `${Math.round(d.low)}°`,
          isToday,
          rainChance: Math.round(d.maxPop * 100),
        };
      });

    // Air Quality Calculation (India CPCB-style estimation)
    let aqi = null;
    let aqiValue = null;
    const components = airData?.list?.[0]?.components;

    if (components && components.pm2_5 != null && components.pm10 != null) {
      const pm25 = components.pm2_5;
      const pm10 = components.pm10;
      const subPm25 = interpolateAQIPM25(pm25);
      const subPm10 = interpolateAQIPM10(pm10);
      aqiValue = Math.round(Math.max(subPm25, subPm10));
      aqiValue = Math.min(500, Math.max(0, aqiValue));
      const cat = getAQICategory(aqiValue);

      aqi = {
        value: aqiValue,
        label: cat.label,
        pm25: Math.round(pm25),
        pm10: Math.round(pm10),
        note: cat.note,
        isEstimated: true,
      };
    }

    // Rule-based Advisory
    const advisory = generateAdvisory({
      role,
      conditionGroup,
      feelsLike: weather.feelsLike,
      aqiValue,
      rainProbability: weather.rain,
      windSpeed: weather.wind,
    });

    const result = {
      location,
      resolved,
      weather,
      hourly,
      daily,
      aqi,
      alerts: [],
      advisory,
      updatedAt: weather.updatedAt,
    };

    dashboardCache.set(cacheKey, result, DASH_TTL_MS);
    return result;
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
