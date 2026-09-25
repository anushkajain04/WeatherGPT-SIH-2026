/**
 * System-wide constants, endpoints, timeouts, and pipeline configuration.
 * Note: All pipeline IDs, service IDs, and endpoint URLs are centralized here.
 */

export const BHASHINI_ENDPOINTS = Object.freeze({
  CONFIG: 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline',
  COMPUTE: 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
});

export const BHASHINI_PIPELINE_ID = '64392f96daac500b55c543cd';

export const BHASHINI_TLD_SERVICE_ID = 'bhashini/indic-lang-detection-all';

export const BHASHINI_TASK_TYPES = Object.freeze({
  TRANSLATION: 'translation',
  ASR: 'asr',
  TTS: 'tts',
  TLD: 'txt-lang-detection',
  TRANSLITERATION: 'transliteration',
});

/**
 * Supported 22 scheduled Indian languages plus English, along with their
 * native script codes (required for high-quality audio generation in Bhashini TTS).
 */
export const SUPPORTED_LANGUAGES = Object.freeze({
  en: { name: 'English', scriptCode: 'Latn', native: false },
  hi: { name: 'Hindi', scriptCode: 'Deva', native: true },
  bn: { name: 'Bengali', scriptCode: 'Beng', native: true },
  ta: { name: 'Tamil', scriptCode: 'Taml', native: true },
  te: { name: 'Telugu', scriptCode: 'Telu', native: true },
  gu: { name: 'Gujarati', scriptCode: 'Gujr', native: true },
  mr: { name: 'Marathi', scriptCode: 'Deva', native: true },
  kn: { name: 'Kannada', scriptCode: 'Knda', native: true },
  ml: { name: 'Malayalam', scriptCode: 'Mlym', native: true },
  pa: { name: 'Punjabi', scriptCode: 'Guru', native: true },
  or: { name: 'Odia', scriptCode: 'Orya', native: true },
  as: { name: 'Assamese', scriptCode: 'Beng', native: true },
  ur: { name: 'Urdu', scriptCode: 'Arab', native: true },
  sa: { name: 'Sanskrit', scriptCode: 'Deva', native: true },
  ks: { name: 'Kashmiri', scriptCode: 'Arab', native: true },
  sd: { name: 'Sindhi', scriptCode: 'Arab', native: true },
  ne: { name: 'Nepali', scriptCode: 'Deva', native: true },
  kok: { name: 'Konkani', scriptCode: 'Deva', native: true },
  mai: { name: 'Maithili', scriptCode: 'Deva', native: true },
  brx: { name: 'Bodo', scriptCode: 'Deva', native: true },
  sat: { name: 'Santali', scriptCode: 'Olck', native: true },
  mni: { name: 'Manipuri', scriptCode: 'Beng', native: true },
  doi: { name: 'Dogri', scriptCode: 'Deva', native: true },
});

export const SUPPORTED_LANGUAGE_CODES = Object.freeze(Object.keys(SUPPORTED_LANGUAGES));

// Cache TTL durations in milliseconds
export const CACHE_TTLS = Object.freeze({
  BHASHINI_CONFIG_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  RAG_ANSWER_TTL_MS: 10 * 60 * 1000,           // 10 minutes
  SESSION_TTL_MS: 30 * 60 * 1000,              // 30 minutes
  HEALTH_STATUS_TTL_MS: 30 * 1000,             // 30 seconds
});

// Whitelisted user roles
export const WHITELISTED_ROLES = Object.freeze([
  'normal_user',
  'farmer',
  'commuter',
  'tourist',
  'outdoor_worker',
]);

// Audio upload constraints for ASR
export const AUDIO_CONSTRAINTS = Object.freeze({
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB cap
  ALLOWED_MIMETYPES: Object.freeze([
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mpeg',
    'audio/mp3',
  ]),
});

// Network and timeout constants
export const TIMEOUTS = Object.freeze({
  BHASHINI_HTTP_TIMEOUT_MS: 15000,
  KEEP_WARM_INTERVAL_MS: 10 * 60 * 1000, // 10 minutes
});

