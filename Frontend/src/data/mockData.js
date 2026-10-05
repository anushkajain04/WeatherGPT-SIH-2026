// ─────────────────────────────────────────────────────────────
// Mock data and system constants
// ─────────────────────────────────────────────────────────────

export const CITIES = [
  'Pune, Maharashtra',
  'Mumbai, Maharashtra',
  'Delhi',
  'Chennai, Tamil Nadu',
  'Kolkata, West Bengal',
  'Lucknow, Uttar Pradesh',
];

export const ROLE_OPTIONS = [
  { value: 'normal_user', label: '👤 General citizen' },
  { value: 'farmer', label: '🌾 Farmer' },
  { value: 'commuter', label: '🚌 Commuter' },
  { value: 'tourist', label: '🧳 Tourist' },
  { value: 'outdoor_worker', label: '👷 Outdoor worker' },
];

export const ROLE_NAMES = {
  normal_user: 'General citizen',
  farmer: 'Farmer',
  commuter: 'Commuter',
  tourist: 'Tourist',
  outdoor_worker: 'Outdoor worker',
  citizen: 'General citizen',
};

export const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
  { code: 'te', label: 'తెలుగు (Telugu)' },
  { code: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { code: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
  { code: 'or', label: 'ଓଡ଼ିଆ (Odia)' },
  { code: 'ml', label: 'മലയാളം (Malayalam)' },
  { code: 'ur', label: 'اردو (Urdu)' },
];

export const LANGUAGES = LANGUAGE_OPTIONS.map((l) => l.label);

export const WEATHER = {
  temp: 29,
  icon: '⛈️',
  summary: 'Cloudy with a chance of thunderstorms',
  feelsLike: 32,
  high: 33,
  low: 24,
  rain: 75,
  humidity: 78,
  wind: 21,
};

export const HOURLY = [
  { time: 'Now', icon: '⛈️', temp: '29°' },
  { time: '1 PM', icon: '🌧️', temp: '28°' },
  { time: '2 PM', icon: '🌧️', temp: '27°' },
  { time: '3 PM', icon: '⛅', temp: '27°' },
  { time: '4 PM', icon: '⛅', temp: '26°' },
  { time: '5 PM', icon: '☁️', temp: '26°' },
];

export const DAILY = [
  { day: 'Today', icon: '⛈️', high: '33°', low: '24°', isToday: true },
  { day: 'Wed', icon: '🌧️', high: '30°', low: '23°' },
  { day: 'Thu', icon: '🌦️', high: '31°', low: '23°' },
  { day: 'Fri', icon: '⛅', high: '32°', low: '24°' },
  { day: 'Sat', icon: '☀️', high: '34°', low: '25°' },
];

export const AQI = {
  value: 124,
  label: 'Moderate',
  pm25: 48,
  pm10: 92,
  note: 'Air is breathable for most people; older adults and asthma patients should limit time outdoors.',
};

export const MOCK_ALERTS = [
  {
    id: 'imd-1',
    level: 'ORANGE',
    title: 'Heavy rain with thunder, winds 40–50 km/h expected',
    validity: 'Valid till 11:30 PM IST today · India Meteorological Department',
    description: 'The IMD has warned of lightning and heavy rainfall over the next 12 hours. Waterlogging is possible in low-lying areas.',
  },
];

export const ROLES = {
  normal_user: {
    icon: '👤',
    bg: '#FDF0DA',
    title: 'General Safety Advisory',
    headline: 'Stay indoors during thunderstorms and avoid unnecessary travel this evening.',
    stat1: ['Overall risk', 'Moderate–High'],
    stat2: ['Best time out', 'After 6 PM tomorrow'],
    foryou: ['Stay indoors during lightning and heavy rain', 'Avoid standing under trees or near power lines', 'Keep a torch and charged phone handy'],
  },
  farmer: {
    icon: '🌾',
    bg: '#E9F4EC',
    title: 'Advisory for Farmers · Kisan Cell',
    headline: 'Hold off irrigation and spraying — heavy rain expected in the next 24 hours.',
    stat1: ['Soil moisture', '84% · Saturated'],
    stat2: ['Spraying', 'Not advised'],
    foryou: ['Halt foliar spraying and fertiliser broadcast', 'Clear drainage bunds in low-lying fields', 'Cover harvested grain on elevated, dry ground'],
  },
  commuter: {
    icon: '🚌',
    bg: '#FDF0DA',
    title: 'Advisory for Commuters · Traffic Cell',
    headline: 'Expect waterlogging and delays on low-lying roads during peak hours.',
    stat1: ['Visibility', 'Low'],
    stat2: ['Roads', 'Waterlogging likely'],
    foryou: ['Avoid underpasses and known flood-prone stretches', 'Allow extra travel time this evening', 'Two-wheeler riders should avoid travel during the storm'],
  },
  tourist: {
    icon: '🧳',
    bg: '#E4F1FA',
    title: 'Advisory for Tourists · Travel Safety',
    headline: 'Plan sightseeing according to weather updates; keep rain gear handy.',
    stat1: ['Outdoor travel', 'Moderate'],
    stat2: ['Best time out', 'Morning'],
    foryou: ['Check transit schedules before departure', 'Carry waterproof bags for electronics', 'Follow local guidance on monuments and attractions'],
  },
  outdoor_worker: {
    icon: '👷',
    bg: '#FDF0DA',
    title: 'Advisory for Outdoor Workers · Heat & Rain Alert',
    headline: 'Take periodic breaks in shaded shelters and avoid open scaffolding during storms.',
    stat1: ['Hydration', 'Essential'],
    stat2: ['Work safety', 'Caution advised'],
    foryou: ['Stay clear of tall metal structures during lightning', 'Keep high-visibility rainwear available', 'Drink water regularly through the shift'],
  },
  // Backwards compatibility alias
  citizen: {
    icon: '👤',
    bg: '#FDF0DA',
    title: 'General Safety Advisory',
    headline: 'Stay indoors during thunderstorms and avoid unnecessary travel this evening.',
    stat1: ['Overall risk', 'Moderate–High'],
    stat2: ['Best time out', 'After 6 PM tomorrow'],
    foryou: ['Stay indoors during lightning and heavy rain', 'Avoid standing under trees or near power lines', 'Keep a torch and charged phone handy'],
  },
};

export const HELPLINES = [
  { icon: '📞', label: 'National Disaster Helpline', number: '1078' },
  { icon: '🚨', label: 'Emergency services', number: '112' },
];

export const INITIAL_CHAT = [
  { id: 1, type: 'assistant', text: "Namaste! Ask me about today's weather, alerts, or your forecast." },
  { id: 2, type: 'user', text: 'Will it rain tomorrow?' },
  { id: 3, type: 'alert', text: 'Heavy rain likely tomorrow morning — an orange alert is active for your area.' },
];

export const QUICK_REPLIES = ['Will it rain tomorrow?', 'Is it safe to go outside today?', 'Show 5-day forecast'];
export const QUICK_REPLY_LABELS = { 'Is it safe to go outside today?': 'Is it safe today?', 'Show 5-day forecast': '5-day forecast' };
