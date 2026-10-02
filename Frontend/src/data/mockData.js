// ─────────────────────────────────────────────────────────────
// Mock data. Replace each export with a real API call later:
//   WEATHER / HOURLY / DAILY → IMD weather API
//   AQI                      → CPCB air-quality API
//   MOCK_ALERTS              → IMD alerts API
//   ROLES                    → advisory service (per role)
// ─────────────────────────────────────────────────────────────

export const CITIES = [
  'Pune, Maharashtra', 'Mumbai, Maharashtra', 'Delhi', 'Chennai, Tamil Nadu',
  'Kolkata, West Bengal', 'Lucknow, Uttar Pradesh',
];

export const ROLE_OPTIONS = [
  { value: 'farmer', label: '🌾 Farmer' },
  { value: 'fisherman', label: '🎣 Fisherman' },
  { value: 'commuter', label: '🚌 Commuter' },
  { value: 'planner', label: '🎪 Event planner' },
  { value: 'citizen', label: '👤 General citizen' },
];

export const ROLE_NAMES = {
  farmer: 'Farmer', fisherman: 'Fisherman', commuter: 'Commuter',
  planner: 'Event planner', citizen: 'General citizen',
};

export const LANGUAGES = [
  'English', 'हिन्दी (Hindi)', 'বাংলা (Bengali)', 'मराठी (Marathi)', 'தமிழ் (Tamil)',
  'తెలుగు (Telugu)', 'ગુજરાતી (Gujarati)', 'ಕನ್ನಡ (Kannada)', 'ਪੰਜਾਬੀ (Punjabi)',
  'ଓଡ଼ିଆ (Odia)', 'മലയാളം (Malayalam)', 'اردو (Urdu)',
];

export const WEATHER = {
  temp: 29, icon: '⛈️', summary: 'Cloudy with a chance of thunderstorms',
  feelsLike: 32, high: 33, low: 24, rain: 75, humidity: 78, wind: 21,
};

export const HOURLY = [
  { time: 'Now', icon: '⛈️', temp: '29°' }, { time: '1 PM', icon: '🌧️', temp: '28°' },
  { time: '2 PM', icon: '🌧️', temp: '27°' }, { time: '3 PM', icon: '⛅', temp: '27°' },
  { time: '4 PM', icon: '⛅', temp: '26°' }, { time: '5 PM', icon: '☁️', temp: '26°' },
];

export const DAILY = [
  { day: 'Today', icon: '⛈️', high: '33°', low: '24°', isToday: true },
  { day: 'Wed', icon: '🌧️', high: '30°', low: '23°' },
  { day: 'Thu', icon: '🌦️', high: '31°', low: '23°' },
  { day: 'Fri', icon: '⛅', high: '32°', low: '24°' },
  { day: 'Sat', icon: '☀️', high: '34°', low: '25°' },
];

export const AQI = {
  value: 124, label: 'Moderate', pm25: 48, pm10: 92,
  note: 'Air is breathable for most people; older adults and asthma patients should limit time outdoors.',
};

export const MOCK_ALERTS = [
  {
    id: 'imd-1', level: 'ORANGE',
    title: 'Heavy rain with thunder, winds 40–50 km/h expected',
    validity: 'Valid till 11:30 PM IST today · India Meteorological Department',
    description: 'The IMD has warned of lightning and heavy rainfall over the next 12 hours. Waterlogging is possible in low-lying areas.',
  },
];

export const ROLES = {
  farmer: {
    icon: '🌾', bg: '#E9F4EC', title: 'Advisory for Farmers · Kisan Cell',
    headline: 'Hold off irrigation and spraying — heavy rain expected in the next 24 hours.',
    stat1: ['Soil moisture', '84% · Saturated'], stat2: ['Spraying', 'Not advised'],
    foryou: ['Halt foliar spraying and fertiliser broadcast', 'Clear drainage bunds in low-lying fields', 'Cover harvested grain on elevated, dry ground'],
  },
  fisherman: {
    icon: '🎣', bg: '#E4F1FA', title: 'Advisory for Fishermen · Coastal Safety Cell',
    headline: 'Do not venture into the sea — rough conditions expected for the next 24 hours.',
    stat1: ['Wave height', '3.2 m · High'], stat2: ['Sea status', 'Unsafe'],
    foryou: ['Return to shore immediately if already at sea', 'Secure boats well above the high-tide line', 'Avoid deep-sea fishing until the alert is lifted'],
  },
  commuter: {
    icon: '🚌', bg: '#FDF0DA', title: 'Advisory for Commuters · Traffic Cell',
    headline: 'Expect waterlogging and delays on low-lying roads during peak hours.',
    stat1: ['Visibility', 'Low'], stat2: ['Roads', 'Waterlogging likely'],
    foryou: ['Avoid underpasses and known flood-prone stretches', 'Allow extra travel time this evening', 'Two-wheeler riders should avoid travel during the storm'],
  },
  planner: {
    icon: '🎪', bg: '#FDF0DA', title: 'Advisory for Event Planners',
    headline: 'Postpone outdoor events this evening — thunderstorm risk is high.',
    stat1: ['Outdoor risk', 'High'], stat2: ['Lightning risk', 'High'],
    foryou: ['Move events indoors or reschedule', 'Secure tents, stages and loose equipment', 'Keep an evacuation plan ready for attendees'],
  },
  citizen: {
    icon: '👤', bg: '#FDF0DA', title: 'General Safety Advisory',
    headline: 'Stay indoors during thunderstorms and avoid unnecessary travel this evening.',
    stat1: ['Overall risk', 'Moderate–High'], stat2: ['Best time out', 'After 6 PM tomorrow'],
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
