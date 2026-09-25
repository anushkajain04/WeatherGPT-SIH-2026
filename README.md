# WeatherGPT Express Backend

Production-ready, highly modular Express backend (Node 20+, ESM) for **WeatherGPT**, a multilingual weather assistant powered by an upstream Python RAG service and Bhashini AI services (ASR, NMT, TTS, TLD, Transliteration).

---

## Architecture Overview

```
User Request (Voice/Text)
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Express Gateway                        │
│  Helmet · CORS (Strict Allowlist) · Body Cap (10KB)         │
│  Rate Limiter (20 req / 15m) · Request ID Tracking          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
        POST /api/chat               POST /api/chat/voice
                │                             │
                │                     Multer Memory (5MB)
                │                             │
                │                             ▼
                │                    Bhashini ASR (Speech-to-Text)
                │                    (sourceLanguage required)
                │                             │
                └──────────────┬──────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │          Language Resolution Pipeline        │
        │  1. Explicit Language Parameter              │
        │  2. Bhashini TLD (Native Script)             │
        │  3. Romanized Keyword Heuristic (Hinglish)   │
        │  4. Fallback: English ('en')                 │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        Session Context & Follow-Up Rewrite   │
        │  Anchor short follow-ups to prior location  │
        │  (Preserves Latin location for geocoding)    │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │         Bhashini NMT (Input Translation)     │
        │  Translates query to English (skip if 'en')  │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │          Upstream Python RAG Service         │
        │  Adaptive Timeout: 65s (Cold) / 10s (Warm)   │
        │  10-minute Answer Cache · X-Internal-API-Key │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        Bhashini NMT (Output Translation)     │
        │  Translates answer to user's native language │
        │  *Graceful degradation to English on failure │
        └──────────────────────┬───────────────────────┘
                               │
                               ▼
        Client Response: { answer, answerEnglish, timings, ... }
```

---

## Key Features

1. **Strict Single-Responsibility Architecture**: Every concern has its own dedicated file under `src/config`, `src/services`, `src/controllers`, `src/routes`, `src/validators`, `src/middleware`, and `src/utils`.
2. **Zero Monolithic Logic**: Clean separation between routing, validation, business logic, and error handling.
3. **Bhashini Service ID Caching**: Config responses are cached for 24 hours via `CacheService` to prevent redundant network round-trips and halve latency.
4. **Adaptive Cold-Start Timeouts**: Automatically switches between a 65s cold-start timeout and a 10s warm timeout for Render's free tier.
5. **Graceful Subsystem Degradation**: If output translation fails, the client receives the English answer along with `translationFailed: true`, rather than failing the weather query.
6. **Location Integrity**: Geolocation strings remain in Latin script and are never passed through translation to prevent geocoder rejection.
7. **Strict Security & Redaction**: Structured Pino logs redact all authorization headers, internal keys, and secrets. Wildcard CORS is prohibited.

---

## Directory Structure

```
.
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── server.js                          # Server entry point & graceful shutdown
    ├── app.js                             # Express application assembly & middleware wiring
    ├── config/
    │   ├── constants.js                   # Centralized pipeline IDs, endpoints, timeouts, languages
    │   ├── env.js                         # Zod-validated environment configuration (fails loudly on boot)
    │   └── romanized-keywords.js          # Hinglish stopword dictionary & detection heuristic
    ├── controllers/
    │   ├── chat.controller.js             # Text and voice chat orchestration
    │   ├── health.controller.js           # Liveness and subsystem status checks
    │   └── tts.controller.js              # On-demand speech synthesis delivery
    ├── middleware/
    │   ├── auth.middleware.js             # Optional client API key enforcement
    │   ├── error-handler.middleware.js    # Centralized error mapping and secret sanitization
    │   ├── rate-limit.middleware.js       # IP rate limiting (20 requests / 15 mins)
    │   ├── request-id.middleware.js       # Request UUID and child logger attachment
    │   └── validate.middleware.js         # Generic Zod validation middleware
    ├── routes/
    │   ├── chat.routes.js                 # POST /api/chat, POST /api/chat/voice
    │   ├── health.routes.js               # GET /api/health, GET /api/status
    │   └── tts.routes.js                  # POST /api/tts
    ├── services/
    │   ├── bhashini/
    │   │   ├── asr.service.js             # Speech-to-text with valid empty source string
    │   │   ├── config.service.js          # Pipeline config resolution with 24h caching
    │   │   ├── nmt.service.js             # Bidirectional neural machine translation
    │   │   ├── tts.service.js             # Text-to-speech with native script code handling
    │   │   └── transliterate.service.js   # Romanized-to-Indic script transliteration
    │   ├── cache.service.js               # Pluggable in-memory TTL cache (Redis-ready)
    │   ├── keep-warm.service.js           # Background pinger for Render free-tier keepalive
    │   ├── language-resolver.service.js   # Multilingual detection & heuristic resolution
    │   ├── rag.service.js                 # Upstream Python RAG client with adaptive timeouts
    │   └── session.service.js             # Contextual session store & follow-up query rewriter
    ├── utils/
    │   ├── errors.js                      # Subsystem-specific typed error classes
    │   ├── http-client.js                 # AbortController fetch wrapper with single retry
    │   └── logger.js                      # Pino logger with credential & header redaction
    └── validators/
        ├── chat.validator.js              # Zod schemas for chat and voice inputs
        └── tts.validator.js               # Zod schemas for text-to-speech requests
```

---

## Environment Variables

Copy `.env.example` to `.env` and provide the required credentials:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port for Express server |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `ALLOWED_ORIGINS` | **Yes** | — | Comma-separated list of allowed origins (e.g. `http://localhost:3000,http://localhost:5173`) |
| `CLIENT_API_KEY` | No | — | Optional API key required in `x-api-key` header |
| `RAG_BASE_URL` | **Yes** | — | Base URL of upstream Python RAG service |
| `RAG_API_KEY` | **Yes** | — | Internal secret key sent in `X-Internal-API-Key` |
| `BHASHINI_UDYAT_KEY` | **Yes** | — | Bhashini Udyat key sent in `ulcaApiKey` header |
| `BHASHINI_INFERENCE_KEY` | **Yes** | — | Bhashini Inference key sent in `Authorization` header |
| `CHAT_RATE_LIMIT_WINDOW_MS` | No | `900000` (15m) | Window in ms for chat rate limiter |
| `CHAT_RATE_LIMIT_MAX` | No | `20` | Max requests per IP within the window |
| `RAG_COLD_TIMEOUT_MS` | No | `65000` (65s) | Timeout for first or cold-started RAG request |
| `RAG_WARM_TIMEOUT_MS` | No | `10000` (10s) | Timeout for subsequent warm RAG requests |
| `KEEP_WARM` | No | `false` | When `true`, pings `{RAG_BASE_URL}/health` every 10 mins |

---

## Language Resolution Flow & Heuristic

Bhashini's Text Language Detection (TLD) API exhibits a known platform characteristic: **any Latin-script input is classified as English (`en`)**, even when the content represents Romanized Indic languages such as Hinglish (e.g., *"aaj mausam kaisa hai"*).

To provide accurate language resolution:

1. **Explicit Language Flag**: If the client provides `language: "hi"`, it overrides all detection and sets confidence to `'explicit'`.
2. **Bhashini TLD**: For native Indic script (e.g., Devanagari, Bengali), TLD returns high-confidence predictions (`'high'`).
3. **Romanized Keyword Heuristic**: If TLD returns `en`, the text is evaluated against `src/config/romanized-keywords.js`. If Romanized Indic keywords (e.g., *baarish*, *mausam*, *hoga*, *thand*) are matched, the system resolves the language to `'hi'` with confidence `'heuristic'`.
4. **Fallback**: If no heuristic matches, the language defaults to `'en'` with confidence `'fallback'`.

Both `detectedLanguage` and `languageConfidence` are returned to the client so that frontend interfaces can show what was detected and allow manual correction.

---

## ASR Voice Input Requirement

Because ASR models require an acoustic model specific to the spoken language and cannot automatically detect the language from raw audio, the `POST /api/chat/voice` endpoint **requires an explicit `language` field** in the request body alongside the audio file upload.

---

## API Endpoints

### 1. Health Check
`GET /api/health`
- Returns local service liveness and a cached check of upstream RAG health.

### 2. Deep Subsystem Status
`GET /api/status`
- Checks connectivity and latency across RAG, Bhashini Config, and Bhashini NMT for debugging and monitoring.

### 3. Text Chat
`POST /api/chat`
- Request body (`application/json`, max 10KB):
```json
{
  "query": "aaj mumbai me barish hogi kya?",
  "role": "farmer",
  "location": "Mumbai",
  "language": "hi",
  "sessionId": "user-session-123"
}
```
- Response:
```json
{
  "answer": "आज मुंबई में हल्की बारिश की संभावना है...",
  "answerEnglish": "Light rain is expected in Mumbai today...",
  "detectedLanguage": "hi",
  "languageConfidence": "heuristic",
  "translationFailed": false,
  "route": "rag",
  "model_used": "gemini-1.5-flash",
  "latency": 1.2,
  "location_resolved": { "city": "Mumbai", "lat": 19.076, "lon": 72.877 },
  "timings": {
    "detect": 12,
    "rewrite": 1,
    "translateIn": 240,
    "rag": 1250,
    "translateOut": 310,
    "total": 1813
  }
}
```

### 4. Voice Chat
`POST /api/chat/voice`
- Multipart form-data:
  - `audio`: WAV or MP3 file (max 5MB)
  - `language`: Required language code (e.g. `hi`, `en`, `bn`)
  - `role`, `location`, `sessionId`: Optional
- Response includes `transcript` alongside standard chat fields and `asr` latency timing.

### 5. On-Demand Text-to-Speech
`POST /api/tts`
- Request body:
```json
{
  "text": "आज मुंबई में बारिश हो सकती है।",
  "language": "hi",
  "gender": "female"
}
```
- Response: Binary `audio/wav` stream with `Content-Type: audio/wav` (or JSON with base64 audio if `Accept: application/json` or `?format=json`).

---

## Error Contract

Errors are returned in a standardized format:

```json
{
  "error": {
    "code": "LOCATION_UNRESOLVABLE",
    "message": "Unable to resolve location. Please confirm your city and try again."
  },
  "reqId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Subsystem Error Mapping:
- **Upstream RAG 400**: Mapped to `400` asking user to confirm their city.
- **Upstream RAG 401**: Mapped to generic `502` while logging internal key rejection.
- **Upstream RAG 503**: Mapped to `503` (*"Our AI systems are currently busy, please try again later."*).
- **Upstream RAG Timeout**: Mapped to `504` (*"Weather service is waking up, please try again in a few seconds."*).
- **Bhashini Failures**: Typed per subsystem (`NMT_ERROR`, `ASR_ERROR`, `TTS_ERROR`). If output translation fails after RAG succeeds, the system degrades gracefully and returns the English answer with `translationFailed: true`.
- **Unsupported Languages**: Non-scheduled languages (such as Bhojpuri `bho`) fail immediately with `422 UNSUPPORTED_LANGUAGE` without redundant retries.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start development server
npm run dev

# 4. Start production server
npm start
```

