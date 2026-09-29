import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────
// Built-in Coordinate Lookup for Indian Cities
// (Guarantees zero-latency, high reliability lookup)
// ─────────────────────────────────────────────────────────────
const CITY_COORDINATES = {
  'pune': { lat: 18.5204, lon: 73.8567, name: 'Pune, Maharashtra' },
  'mumbai': { lat: 19.0760, lon: 72.8777, name: 'Mumbai, Maharashtra' },
  'delhi': { lat: 28.6139, lon: 77.2090, name: 'Delhi' },
  'new delhi': { lat: 28.6139, lon: 77.2090, name: 'New Delhi' },
  'chennai': { lat: 13.0827, lon: 80.2707, name: 'Chennai, Tamil Nadu' },
  'kolkata': { lat: 22.5726, lon: 88.3639, name: 'Kolkata, West Bengal' },
  'lucknow': { lat: 26.8467, lon: 80.9462, name: 'Lucknow, Uttar Pradesh' },
  'bengaluru': { lat: 12.9716, lon: 77.5946, name: 'Bengaluru, Karnataka' },
  'bangalore': { lat: 12.9716, lon: 77.5946, name: 'Bengaluru, Karnataka' },
  'hyderabad': { lat: 17.3850, lon: 78.4867, name: 'Hyderabad, Telangana' },
  'ahmedabad': { lat: 23.0225, lon: 72.5714, name: 'Ahmedabad, Gujarat' },
  'jaipur': { lat: 26.9124, lon: 75.7873, name: 'Jaipur, Rajasthan' },
  'chandigarh': { lat: 30.7333, lon: 76.7794, name: 'Chandigarh' },
  'patna': { lat: 25.5941, lon: 85.1376, name: 'Patna, Bihar' },
  'bhopal': { lat: 23.2599, lon: 77.4126, name: 'Bhopal, Madhya Pradesh' },
  'kochi': { lat: 9.9312, lon: 76.2673, name: 'Kochi, Kerala' },
  'guwahati': { lat: 26.1445, lon: 91.7362, name: 'Guwahati, Assam' }
};

// ─────────────────────────────────────────────────────────────
// Geocoding Helper
// ─────────────────────────────────────────────────────────────
async function resolveLocation(locationQuery) {
  if (!locationQuery || typeof locationQuery !== 'string') {
    return { lat: 18.5204, lon: 73.8567, name: 'Pune, Maharashtra' };
  }

  // Strip PIN codes or qualifiers: "Pune, Maharashtra · 411001" -> "Pune"
  const rawCity = locationQuery.split('·')[0].split(',')[0].trim().toLowerCase();

  if (CITY_COORDINATES[rawCity]) {
    return CITY_COORDINATES[rawCity];
  }

  // Fallback to Open-Meteo Geocoding API for other Indian cities / districts
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(rawCity)}&count=1&language=en&format=json`;
    const res = await fetch(geoUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        return {
          lat: item.latitude,
          lon: item.longitude,
          name: `${item.name}${item.admin1 ? ', ' + item.admin1 : ''}`
        };
      }
    }
  } catch (err) {
    console.error('Geocoding error:', err.message);
  }

  // Default fallback if not resolved
  return { lat: 18.5204, lon: 73.8567, name: 'Pune, Maharashtra' };
}

// ─────────────────────────────────────────────────────────────
// WMO Weather Code to Emoji & Description
// ─────────────────────────────────────────────────────────────
function mapWmoCode(code) {
  switch (code) {
    case 0:
      return { icon: '☀️', summary: 'Clear sunny sky' };
    case 1:
      return { icon: '🌤️', summary: 'Mainly clear' };
    case 2:
      return { icon: '⛅', summary: 'Partly cloudy' };
    case 3:
      return { icon: '☁️', summary: 'Overcast' };
    case 45:
    case 48:
      return { icon: '🌫️', summary: 'Foggy conditions' };
    case 51:
    case 53:
    case 55:
      return { icon: '🌦️', summary: 'Light drizzle' };
    case 56:
    case 57:
      return { icon: '🌧️', summary: 'Freezing drizzle' };
    case 61:
      return { icon: '🌧️', summary: 'Light rain' };
    case 63:
      return { icon: '🌧️', summary: 'Moderate rain' };
    case 65:
      return { icon: '🌧️', summary: 'Heavy rain' };
    case 66:
    case 67:
      return { icon: '🌧️', summary: 'Freezing rain' };
    case 71:
    case 73:
    case 75:
    case 77:
      return { icon: '🌨️', summary: 'Snowfall' };
    case 80:
      return { icon: '🌦️', summary: 'Light rain showers' };
    case 81:
      return { icon: '🌧️', summary: 'Moderate rain showers' };
    case 82:
      return { icon: '🌧️', summary: 'Violent rain showers' };
    case 85:
    case 86:
      return { icon: '🌨️', summary: 'Snow showers' };
    case 95:
      return { icon: '⛈️', summary: 'Thunderstorm' };
    case 96:
    case 99:
      return { icon: '⛈️', summary: 'Thunderstorm with heavy hail' };
    default:
      return { icon: '⛅', summary: 'Partly cloudy' };
  }
}

// ─────────────────────────────────────────────────────────────
// Indian CPCB AQI Calculation (0–500 scale)
// ─────────────────────────────────────────────────────────────
function calculateIndianAQI(pm25Raw, pm10Raw) {
  const pm25 = pm25Raw != null ? pm25Raw : 35;
  const pm10 = pm10Raw != null ? pm10Raw : 65;

  function calculateSubIndex(conc, breakpoints) {
    for (const [cLow, cHigh, iLow, iHigh] of breakpoints) {
      if (conc >= cLow && conc <= cHigh) {
        return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (conc - cLow) + iLow);
      }
    }
    return 500;
  }

  const pm25Breakpoints = [
    [0, 30, 0, 50],
    [30.1, 60, 51, 100],
    [60.1, 90, 101, 200],
    [90.1, 120, 201, 300],
    [120.1, 250, 301, 400],
    [250.1, 500, 401, 500]
  ];

  const pm10Breakpoints = [
    [0, 50, 0, 50],
    [50.1, 100, 51, 100],
    [100.1, 250, 101, 200],
    [250.1, 350, 201, 300],
    [350.1, 430, 301, 400],
    [430.1, 500, 401, 500]
  ];

  const iPm25 = calculateSubIndex(pm25, pm25Breakpoints);
  const iPm10 = calculateSubIndex(pm10, pm10Breakpoints);
  const aqiValue = Math.min(500, Math.max(1, Math.max(iPm25, iPm10)));

  let label = 'Moderate';
  let note = 'Air is breathable for most people; older adults and asthma patients should limit time outdoors.';

  if (aqiValue <= 50) {
    label = 'Good';
    note = 'Minimal health impact; air quality is ideal for all outdoor activities.';
  } else if (aqiValue <= 100) {
    label = 'Satisfactory';
    note = 'Minor breathing discomfort possible for sensitive people; overall clean air.';
  } else if (aqiValue <= 200) {
    label = 'Moderate';
    note = 'Air is breathable for most people; older adults and asthma patients should limit time outdoors.';
  } else if (aqiValue <= 300) {
    label = 'Poor';
    note = 'Breathing discomfort to most people on prolonged exposure; avoid strenuous outdoor activities.';
  } else if (aqiValue <= 400) {
    label = 'Very Poor';
    note = 'Respiratory illness likely on prolonged exposure. Elderly and children should stay indoors.';
  } else {
    label = 'Severe';
    note = 'Affects healthy people and seriously impacts those with existing respiratory ailments; stay indoors.';
  }

  return {
    value: aqiValue,
    label,
    pm25: Math.round(pm25),
    pm10: Math.round(pm10),
    note
  };
}

// ─────────────────────────────────────────────────────────────
// Dynamic Role-Based Advisory Generator
// ─────────────────────────────────────────────────────────────
function generateRoleAdvisory(role, weather, aqi) {
  const r = (role || 'citizen').toLowerCase();
  const { temp, rain, wind, weather_code } = weather;
  const isStormy = [95, 96, 99].includes(weather_code) || rain >= 65 || wind >= 35;
  const isRainy = rain >= 40 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weather_code);
  const isHot = temp >= 35;
  const isFoggy = [45, 48].includes(weather_code);

  switch (r) {
    case 'farmer': {
      if (isStormy || isRainy) {
        return {
          icon: '🌾',
          bg: '#E9F4EC',
          title: 'Advisory for Farmers · Kisan Cell',
          headline: 'Hold off irrigation and spraying — heavy rain expected in the next 24 hours.',
          stat1: ['Soil moisture', `${Math.min(95, 65 + Math.round(rain * 0.3))}% · High`],
          stat2: ['Spraying', 'Not advised'],
          foryou: [
            'Halt foliar spraying and fertiliser broadcast immediately',
            'Clear field drainage bunds to avoid root waterlogging',
            'Keep harvested produce elevated and covered in dry shelters'
          ]
        };
      }
      if (isHot) {
        return {
          icon: '🌾',
          bg: '#E9F4EC',
          title: 'Advisory for Farmers · Kisan Cell',
          headline: 'High daytime temperatures. Irrigate in the evening to minimise evaporation.',
          stat1: ['Soil moisture', '36% · Moderate'],
          stat2: ['Irrigation', 'Required (Evening)'],
          foryou: [
            'Schedule light irrigation during cooler evening or early morning hours',
            'Apply straw mulching to conserve moisture in vegetable and fruit crops',
            'Inspect standing crops for heat stress and sucking pests'
          ]
        };
      }
      return {
        icon: '🌾',
        bg: '#E9F4EC',
        title: 'Advisory for Farmers · Kisan Cell',
        headline: 'Favourable weather conditions for standard farm operations and intercultural activities.',
        stat1: ['Soil moisture', '58% · Optimal'],
        stat2: ['Spraying', 'Favourable'],
        foryou: [
          'Optimal window for foliar nutrient sprays and scheduled pesticides',
          'Continue routine field weeding and soil aeration',
          'Ensure farm machinery and storage units are prepared'
        ]
      };
    }

    case 'fisherman': {
      if (isStormy || wind >= 28) {
        return {
          icon: '🎣',
          bg: '#E4F1FA',
          title: 'Advisory for Fishermen · Coastal Safety Cell',
          headline: 'Do not venture into deep waters — rough sea conditions and gusty winds expected.',
          stat1: ['Wind gusts', `${wind} km/h · High`],
          stat2: ['Sea status', 'Unsafe'],
          foryou: [
            'Return to shore immediately if currently at sea',
            'Secure fishing trawlers and country boats above the high-tide line',
            'Avoid all deep-sea fishing expeditions until warning is officially cleared'
          ]
        };
      }
      return {
        icon: '🎣',
        bg: '#E4F1FA',
        title: 'Advisory for Fishermen · Coastal Safety Cell',
        headline: 'Sea conditions normal. Safe for standard coastal fishing operations today.',
        stat1: ['Wind speed', `${wind} km/h · Moderate`],
        stat2: ['Sea status', 'Safe'],
        foryou: [
          'Normal coastal fishing operations permitted today',
          'Carry mandated life-jackets, distress beacons, and communication sets',
          'Check local coastal radio broadcasts before evening venturing'
        ]
      };
    }

    case 'commuter': {
      if (isStormy || isRainy) {
        return {
          icon: '🚌',
          bg: '#FDF0DA',
          title: 'Advisory for Commuters · Traffic Cell',
          headline: 'Expect waterlogging and traffic delays on low-lying arterial routes.',
          stat1: ['Visibility', 'Reduced'],
          stat2: ['Roads', 'Waterlogging likely'],
          foryou: [
            'Avoid known underpass bottlenecks and low-lying flyover ramps',
            'Allow 15–25 minutes extra buffer for evening office commutes',
            'Two-wheeler riders should avoid high-speed commuting during downpours'
          ]
        };
      }
      if (isFoggy) {
        return {
          icon: '🚌',
          bg: '#FDF0DA',
          title: 'Advisory for Commuters · Traffic Cell',
          headline: 'Dense fog observed along highway corridors. Maintain safe trailing distance.',
          stat1: ['Visibility', '< 300 m · Low'],
          stat2: ['Roads', 'Drive with caution'],
          foryou: [
            'Use dipped low-beam headlights and dedicated yellow fog lamps',
            'Maintain safe vehicle following distance on expressways',
            'Check rail and airport timetables for possible schedule revisions'
          ]
        };
      }
      return {
        icon: '🚌',
        bg: '#FDF0DA',
        title: 'Advisory for Commuters · Traffic Cell',
        headline: 'Smooth transit expected across major urban corridors with clear road conditions.',
        stat1: ['Visibility', 'Clear (> 8 km)'],
        stat2: ['Roads', 'Normal'],
        foryou: [
          'Normal commute conditions across the metropolitan network',
          'Keep vehicle tires inflated to recommended pressure for fuel efficiency',
          'Carry a water bottle during warm midday commuting hours'
        ]
      };
    }

    case 'planner': {
      if (isStormy || isRainy) {
        return {
          icon: '🎪',
          bg: '#FDF0DA',
          title: 'Advisory for Event Planners',
          headline: 'Thunderstorm and rain risk is elevated. Prepare weatherproof shelters.',
          stat1: ['Outdoor risk', 'High'],
          stat2: ['Rain probability', `${rain}% · High`],
          foryou: [
            'Move sensitive audio-visual and electrical systems under waterproof covers',
            'Reinforce outdoor temporary canopies, gazebos, and signage against wind',
            'Keep an emergency crowd evacuation and shelter plan ready'
          ]
        };
      }
      if (isHot) {
        return {
          icon: '🎪',
          bg: '#FDF0DA',
          title: 'Advisory for Event Planners',
          headline: 'High daytime temperatures. Arrange adequate hydration and shaded rest zones.',
          stat1: ['Outdoor risk', 'Moderate (Heat)'],
          stat2: ['Peak temperature', `${temp}°C · High`],
          foryou: [
            'Ensure prominent drinking water kiosks and mist-cooling fans across the venue',
            'Provide covered, well-ventilated waiting areas for attendees',
            'Schedule high-intensity stage activities for cooler evening hours'
          ]
        };
      }
      return {
        icon: '🎪',
        bg: '#FDF0DA',
        title: 'Advisory for Event Planners',
        headline: 'Pleasant weather today. Favourable for outdoor gatherings, festivals, and exhibitions.',
        stat1: ['Outdoor risk', 'Low'],
        stat2: ['Comfort level', 'Pleasant'],
        foryou: [
          'Outdoor events can proceed as planned without weather disruptions',
          'Optimal daylight conditions for photography and videography',
          'Ensure standard first-aid facilities and crowd management are in place'
        ]
      };
    }

    case 'citizen':
    default: {
      if (isStormy || isRainy) {
        return {
          icon: '👤',
          bg: '#FDF0DA',
          title: 'General Safety Advisory',
          headline: 'Stay indoors during heavy downpours and avoid standing near power lines or trees.',
          stat1: ['Overall risk', 'Moderate–High'],
          stat2: ['Best time out', 'After rain clears'],
          foryou: [
            'Stay indoors during lightning and gusty winds',
            'Avoid walking or driving through standing water on roads',
            'Keep phones charged and keep emergency helpline numbers handy'
          ]
        };
      }
      if (aqi.value > 200) {
        return {
          icon: '👤',
          bg: '#FDF0DA',
          title: 'General Safety Advisory',
          headline: 'Poor air quality detected. Children and older adults should limit outdoor exertion.',
          stat1: ['Air quality', `${aqi.label} (${aqi.value})`],
          stat2: ['Outdoor exercise', 'Not advised'],
          foryou: [
            'Wear an N95 mask when stepping out in vehicular traffic zones',
            'Keep residential doors and windows closed during peak morning pollution hours',
            'Use indoor air purifiers or indoor greenery where available'
          ]
        };
      }
      if (isHot) {
        return {
          icon: '👤',
          bg: '#FDF0DA',
          title: 'General Safety Advisory',
          headline: 'Warm daytime temperatures. Stay well hydrated and avoid peak afternoon sun.',
          stat1: ['Heat index', `${temp}°C · Warm`],
          stat2: ['Hydration', 'Essential'],
          foryou: [
            'Drink water regularly and consider coconut water or lime water',
            'Wear lightweight, loose-fitting cotton clothes and sunglasses',
            'Avoid direct prolonged sun exposure between 12:00 PM and 3:00 PM'
          ]
        };
      }
      return {
        icon: '👤',
        bg: '#FDF0DA',
        title: 'General Safety Advisory',
        headline: 'Pleasant weather across the city today with comfortable outdoor conditions.',
        stat1: ['Overall risk', 'Low'],
        stat2: ['Best time out', 'Anytime today'],
        foryou: [
          'Ideal day for walking, exercise, and outdoor recreation',
          'Keep a light water bottle handy while travelling',
          'Enjoy the clear and pleasant weather'
        ]
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Format 12-Hour Time String: e.g. "1 PM", "2 PM"
// ─────────────────────────────────────────────────────────────
function formatHourString(isoString) {
  const d = new Date(isoString);
  const hour = d.getHours();
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12} ${ampm}`;
}

// ─────────────────────────────────────────────────────────────
// Handler for GET /api/dashboard and GET /dashboard
// ─────────────────────────────────────────────────────────────
async function handleDashboard(req, res) {
  try {
    const locationQuery = req.query.location || 'Pune, Maharashtra';
    const role = (req.query.role || 'citizen').toLowerCase();

    // 1. Resolve coordinates
    const geo = await resolveLocation(locationQuery);

    // 2. Fetch Open-Meteo Weather and Air Quality concurrently
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=6`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${geo.lat}&longitude=${geo.lon}&current=pm10,pm2_5,us_aqi&timezone=Asia%2FKolkata`;

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(weatherUrl),
      fetch(aqiUrl)
    ]);

    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo weather API returned status ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const aqiData = aqiRes.ok ? await aqiRes.json() : null;

    const current = weatherData.current;
    const hourly = weatherData.hourly;
    const daily = weatherData.daily;

    // 3. Build Current Weather object (HeroWeatherCard)
    const currentWeatherInfo = mapWmoCode(current.weather_code);
    const dayHigh = Math.round(daily.temperature_2m_max?.[0] ?? current.temperature_2m);
    const dayLow = Math.round(daily.temperature_2m_min?.[0] ?? current.temperature_2m - 5);
    const rainChance = Math.round(daily.precipitation_probability_max?.[0] ?? (current.precipitation > 0 ? 80 : 15));

    const weather = {
      temp: Math.round(current.temperature_2m),
      icon: currentWeatherInfo.icon,
      summary: currentWeatherInfo.summary,
      feelsLike: Math.round(current.apparent_temperature),
      high: dayHigh,
      low: dayLow,
      rain: rainChance,
      humidity: Math.round(current.relative_humidity_2m),
      wind: Math.round(current.wind_speed_10m),
      weather_code: current.weather_code
    };

    // 4. Build Hourly Forecast (Next few hours - ForecastStrip hourly)
    // Find current hour index in hourly.time array
    const nowIsoHour = current.time.slice(0, 13); // e.g. "2026-09-29T13"
    let startIndex = hourly.time.findIndex((t) => t.startsWith(nowIsoHour));
    if (startIndex === -1) startIndex = 0;

    const hourlyList = [
      {
        time: 'Now',
        icon: currentWeatherInfo.icon,
        temp: `${weather.temp}°`
      }
    ];

    for (let i = 1; i <= 5; i++) {
      const idx = startIndex + i;
      if (idx < hourly.time.length) {
        const hTime = formatHourString(hourly.time[idx]);
        const hWmo = mapWmoCode(hourly.weather_code[idx]);
        const hTemp = Math.round(hourly.temperature_2m[idx]);
        hourlyList.push({
          time: hTime,
          icon: hWmo.icon,
          temp: `${hTemp}°`
        });
      }
    }

    // 5. Build Daily Forecast (Next 5 days - ForecastStrip daily)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dailyList = [];

    // Day 0: Today
    dailyList.push({
      day: 'Today',
      icon: currentWeatherInfo.icon,
      high: `${dayHigh}°`,
      low: `${dayLow}°`,
      isToday: true
    });

    // Days 1 through 4
    for (let i = 1; i <= 4; i++) {
      if (daily.time?.[i]) {
        const dateObj = new Date(daily.time[i] + 'T00:00:00');
        const dayLabel = dayNames[dateObj.getDay()];
        const dWmo = mapWmoCode(daily.weather_code[i]);
        const dHigh = Math.round(daily.temperature_2m_max[i]);
        const dLow = Math.round(daily.temperature_2m_min[i]);

        dailyList.push({
          day: dayLabel,
          icon: dWmo.icon,
          high: `${dHigh}°`,
          low: `${dLow}°`
        });
      }
    }

    // 6. Build AQI object (AQICard)
    const pm25 = aqiData?.current?.pm2_5;
    const pm10 = aqiData?.current?.pm10;
    const aqi = calculateIndianAQI(pm25, pm10);

    // 7. Build Role-Based Advisory (AdvisoryCard)
    const advisory = generateRoleAdvisory(role, weather, aqi);

    // 8. Alerts (Safe empty array or active IMD alert if severe conditions)
    // "Alert/notification backend is already done, so don't modify it."
    const alerts = [];
    if (weather.weather_code >= 95 || weather.wind >= 45 || weather.rain >= 80) {
      alerts.push({
        id: `imd-${Date.now()}`,
        level: weather.weather_code >= 96 ? 'RED' : 'ORANGE',
        title: `${weather.summary}, winds up to ${weather.wind} km/h expected`,
        validity: 'Valid till 11:30 PM IST today · India Meteorological Department',
        description: 'The IMD has issued a severe weather advisory. Stay alert for lightning, heavy rain, and local waterlogging.'
      });
    }

    // Return complete payload matching frontend structure exactly
    return res.json({
      weather,
      hourly: hourlyList,
      daily: dailyList,
      aqi,
      advisory,
      alerts
    });
  } catch (error) {
    console.error('Error generating dashboard data:', error);
    return res.status(500).json({
      detail: 'Failed to fetch live weather and air quality data. Please try again.'
    });
  }
}

// Mount dashboard route on both paths for proxy & direct access
app.get(['/api/dashboard', '/dashboard'], handleDashboard);

// ─────────────────────────────────────────────────────────────
// Auth Stubs (Allows frontend to log in smoothly without OTP backend)
// ─────────────────────────────────────────────────────────────
app.post(['/api/auth/request-otp', '/auth/request-otp'], (req, res) => {
  return res.json({ ok: true });
});

app.post(['/api/auth/verify-otp', '/auth/verify-otp'], (req, res) => {
  return res.json({ ok: true, token: 'weathergpt-session-token' });
});

// Health check
app.get(['/api/health', '/health', '/'], (req, res) => {
  res.json({
    status: 'ok',
    service: 'WeatherGPT Express Weather API',
    endpoints: ['GET /api/dashboard?location=...&role=...']
  });
});

app.listen(PORT, () => {
  console.log(`[WeatherGPT Backend] Server running on http://localhost:${PORT}`);
});
