# WeatherGPT Express Backend

Production-ready, highly modular Express backend (Node 20+, ESM) for **WeatherGPT**, a multilingual weather assistant powered by an upstream Python RAG service, Bhashini AI services (ASR, NMT, TTS, TLD, Transliteration), and a secure passwordless OTP authentication system (email and Indian mobile numbers) with MongoDB Atlas and JWT sessions.

---

## Architecture Overview

```
User Request (Voice/Text/Auth)
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Express Gateway                        │
│  Helmet · CORS (Strict Allowlist) · Body Cap (10KB)         │
│  Trust Proxy (1) · Cookie Parser · Request ID Tracking      │
└──────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
POST /api/chat         POST /api/chat/voice     /api/auth/*
       │                       │                       │
       │               Multer Memory (5MB)      ┌──────┴──────┐
       │                       │                ▼             ▼
       │               Bhashini ASR      OTP (Email/SMS)  JWT Cookie
       │                       │         (5m exp, 1h cap) (wgpt_session)
       └──────────────┬────────┘                │             │
                      │                         └──────┬──────┘
                      ▼                                │
      ┌───────────────────────────────┐                │
      │  Language Resolution Pipeline │                │
      └──────────────┬────────────────┘                │
                      ▼                                ▼
      ┌───────────────────────────────┐        ┌──────────────┐
      │  Upstream Python RAG Service  │        │ requireAuth  │
      └──────────────┬────────────────┘        └──────────────┘
                      ▼
      Client Response: { answer, answerEnglish, timings, ... }
```

---

## Key Features

1. **Strict Single-Responsibility Architecture**: Every concern has its own dedicated file under `src/config`, `src/services`, `src/controllers`, `src/routes`, `src/validators`, `src/middleware`, and `src/utils`.
2. **Passwordless OTP Authentication**:
   - Supports email and 10-digit Indian phone numbers (`+91XXXXXXXXXX`).
   - One user account holds both email and phone without account merging.
   - Dual partial unique indexes (`partialFilterExpression: { $type: 'string' }`) synchronized on startup.
   - 1-hour document retention via MongoDB TTL with 5-minute code expiration, 30s resend cooldown, and 5-per-hour send limit.
   - Timing-safe HMAC-SHA256 OTP verification. Code is never logged or returned.
3. **JWT Session Management & CSRF Defense**:
   - Signed with HS256, 7-day expiry, user ID as `sub`.
   - Stored in an `httpOnly` cookie (`wgpt_session`) with configurable `sameSite` and forced `secure` mode when `SameSite=None`.
   - Reusable `csrfHeaderMiddleware` requiring `X-Requested-With: WeatherGPT` on state-changing requests (`POST`, `PATCH`, `DELETE`).
4. **Bhashini Service ID Caching**: Config responses cached for 24 hours to prevent redundant network round-trips and halve latency.
5. **Adaptive Cold-Start Timeouts**: Automatically switches between a 65s cold-start timeout and a 10s warm timeout for Render's free tier.
6. **Graceful Subsystem Degradation**: If output translation fails, the client receives the English answer with `translationFailed: true` rather than failing the weather query.
7. **Strict Security & Redaction**: Structured Pino logs redact all authorization headers, internal keys, secrets, cookies, tokens, contacts, and OTPs. Wildcard CORS is prohibited.

---

## Directory Structure

```
.
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── server.js                          # Server entry point & DB connection & graceful shutdown
    ├── app.js                             # Express application assembly, middleware & route wiring
    ├── config/
    │   ├── constants.js                   # Centralized pipeline IDs, endpoints, timeouts, languages
    │   ├── db.js                          # Mongoose connection & index synchronization
    │   ├── env.js                         # Zod-validated environment configuration (fails loudly on boot)
    │   └── romanized-keywords.js          # Hinglish stopword dictionary & detection heuristic
    ├── controllers/
    │   ├── auth.controller.js             # Passwordless OTP, profile, session, and contact linking
    │   ├── chat.controller.js             # Text and voice chat orchestration
    │   ├── geocoding.controller.js        # Coordinate reverse geocoding via OpenStreetMap Nominatim
    │   ├── health.controller.js           # Liveness and subsystem status checks
    │   └── tts.controller.js              # On-demand speech synthesis delivery
    ├── middleware/
    │   ├── auth.middleware.js             # Optional client API key enforcement (non-auth routes)
    │   ├── csrf-header.middleware.js      # X-Requested-With: WeatherGPT enforcement on mutating routes
    │   ├── error-handler.middleware.js    # Centralized error mapping and secret sanitization
    │   ├── geocoding-rate-limit.middleware.js # IP rate limiting on reverse geocoding route
    │   ├── otp-rate-limit.middleware.js   # IP rate limiting on OTP endpoints
    │   ├── rate-limit.middleware.js       # IP rate limiting on chat endpoints
    │   ├── request-id.middleware.js       # Request UUID and child logger attachment
    │   ├── require-auth.middleware.js     # Session cookie verification & req.user attachment
    │   └── validate.middleware.js         # Generic Zod validation middleware
    ├── models/
    │   ├── otp.model.js                   # OTP schema with 1h TTL index & 5m code expiry
    │   └── user.model.js                  # User schema with partial unique indexes on email & phone
    ├── routes/
    │   ├── auth.routes.js                 # POST /otp/request, /otp/verify, GET/PATCH /me, /logout, /link/*
    │   ├── chat.routes.js                 # POST /api/chat, POST /api/chat/voice
    │   ├── geocoding.routes.js            # GET /api/city/resolve?lat=&lon=
    │   ├── health.routes.js               # GET /api/health, GET /api/status
    │   └── tts.routes.js                  # POST /api/tts
    ├── services/
    │   ├── auth/
    │   │   ├── email.service.js           # Nodemailer SMTP & dev console driver
    │   │   ├── otp.service.js             # Crypto randomInt OTP generator & timingSafeEqual verifier
    │   │   ├── sms.service.js             # SMS provider interface & stub throwing not-configured
    │   │   ├── token.service.js           # HS256 JWT session signer & verifier
    │   │   └── user.service.js            # User lifecycle, profile update & dual-check contact linking
    │   ├── bhashini/
    │   │   ├── asr.service.js             # Speech-to-text with valid empty source string
    │   │   ├── config.service.js          # Pipeline config resolution with 24h caching
    │   │   ├── nmt.service.js             # Bidirectional neural machine translation
    │   │   ├── tts.service.js             # Text-to-speech with native script code handling
    │   │   └── transliterate.service.js   # Romanized-to-Indic script transliteration
    │   ├── cache.service.js               # Pluggable in-memory TTL cache (Redis-ready)
    │   ├── geocoding.service.js           # OSM Nominatim reverse geocoding with 24h caching
    │   ├── keep-warm.service.js           # Background pinger for Render free-tier keepalive
    │   ├── language-resolver.service.js   # Multilingual detection & heuristic resolution
    │   ├── rag.service.js                 # Upstream Python RAG client with adaptive timeouts
    │   └── session.service.js             # Contextual session store & follow-up query rewriter
    ├── utils/
    │   ├── contact.js                     # Canonical email & Indian phone (+91) normalizer
    │   ├── errors.js                      # Subsystem-specific typed error classes (Conflict, Forbidden, etc.)
    │   ├── http-client.js                 # AbortController fetch wrapper with single retry
    │   └── logger.js                      # Pino logger with nested credential & contact redaction
    └── validators/
        ├── auth.validator.js              # Zod schemas for OTP, profile, and link requests
        ├── chat.validator.js              # Zod schemas for chat and voice inputs
        ├── geocoding.validator.js         # Zod schemas for lat/lon query parameters
        └── tts.validator.js               # Zod schemas for text-to-speech requests
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port for Express server |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `ALLOWED_ORIGINS` | **Yes** | — | Comma-separated allowlist of origins (never wildcard) |
| `MONGODB_URI` | **Yes** | — | MongoDB Atlas connection string |
| `JWT_SECRET` | **Yes** | — | Secret for signing session JWTs (minimum 32 characters) |
| `OTP_HASH_SECRET` | **Yes** | — | Secret for HMAC-SHA256 OTP hashing (minimum 32 characters) |
| `COOKIE_SAME_SITE` | No | `lax` | `lax`, `strict`, or `none` (cross-domain) |
| `COOKIE_SECURE` | No | `false` | `true` or `false` (forced `true` if `COOKIE_SAME_SITE=none`) |
| `MAIL_PROVIDER` | No | `console` | `console` (dev only) or `smtp`. Refuses boot if `console` in production |
| `SMS_PROVIDER` | No | `console` | `console` (dev only) or `custom`. Refuses boot if `console` in production |
| `SMTP_HOST` | If `smtp` | — | SMTP hostname |
| `SMTP_PORT` | If `smtp` | `587` | SMTP port |
| `SMTP_USER` | If `smtp` | — | SMTP username |
| `SMTP_PASS` | If `smtp` | — | SMTP password |
| `EMAIL_FROM` | No | `WeatherGPT <noreply@weathergpt.local>` | From email address header |
| `RAG_BASE_URL` | **Yes** | — | Base URL of upstream Python RAG service |
| `RAG_API_KEY` | **Yes** | — | Internal secret key sent in `X-Internal-API-Key` |
| `BHASHINI_UDYAT_KEY` | **Yes** | — | Bhashini Udyat key sent in `ulcaApiKey` header |
| `BHASHINI_INFERENCE_KEY` | **Yes** | — | Bhashini Inference key sent in `Authorization` header |
| `CHAT_RATE_LIMIT_WINDOW_MS` | No | `900000` (15m) | Window in ms for chat rate limiter |
| `CHAT_RATE_LIMIT_MAX` | No | `20` | Max chat requests per IP within the window |
| `RAG_COLD_TIMEOUT_MS` | No | `65000` (65s) | Timeout for first or cold-started RAG request |
| `RAG_WARM_TIMEOUT_MS` | No | `10000` (10s) | Timeout for subsequent warm RAG requests |
| `KEEP_WARM` | No | `false` | When `true`, pings `{RAG_BASE_URL}/health` every 10 mins |
| `GEOCODING_CONTACT_EMAIL` | No | `contact@weathergpt.local` | Contact email included in Nominatim User-Agent header |
| `CLIENT_API_KEY` | No | — | Optional internal API key for legacy services |

---

## Authentication Subsystem

### 1. Contact Normalization
- **Email**: Trimmed, lowercased, validated against standard email format.
- **Indian Phone Numbers**: Accepts 10 digits starting with 6–9 with optional `+91`, `91`, or `0` prefix. Spaces and hyphens are stripped. Output is strictly normalized to `+91XXXXXXXXXX`.
- **Validation**: Any unsupported or malformed contact returns a `422 ValidationError`.

### 2. OTP Security & Rate Limiting
- **Generation**: 6-digit numeric code generated with `crypto.randomInt` (never `Math.random`).
- **Hashing**: HMAC-SHA256 keyed with `OTP_HASH_SECRET`.
- **Verification**: Constant-time comparison using `crypto.timingSafeEqual`.
- **Hourly Cap & Retention**: The OTP document lives for 1 hour in MongoDB via TTL (`expiresAt`). Code validity (`otpExpiresAt`) is 5 minutes.
  - Max 5 verify attempts; after 5 attempts, the code is invalidated.
  - 30-second cooldown between requests.
  - Max 5 requests per contact per hour, retained even after code expiration or successful verification.
- **Zero Leakage**: The OTP code is never logged, stored in plaintext, or included in any API response.

### 3. Session Management & Cookies
- Successful verification issues an HS256 JWT containing only the user ID as subject (`sub`), valid for 7 days.
- Stored in an `httpOnly` cookie named `wgpt_session`.
- On logout, the cookie is cleared using the exact same `path`, `httpOnly`, `sameSite`, and `secure` options.

### 4. CSRF Protection
- All mutating requests (`POST`, `PATCH`, `DELETE`) under `/api/auth` require the custom header:
  ```http
  X-Requested-With: WeatherGPT
  ```
- Missing or invalid headers result in a `403 ForbiddenError`.

---

## Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/otp/request` | No | Request login/registration OTP. Generic response prevents account enumeration. |
| `POST` | `/api/auth/otp/verify` | No | Verify OTP, find or create user, set `wgpt_session` cookie. |
| `GET` | `/api/auth/me` | Cookie | Get currently authenticated user profile. |
| `PATCH` | `/api/auth/me` | Cookie | Update profile fields (`role`, `location`, `preferredLanguage`). |
| `POST` | `/api/auth/logout` | No | Clear `wgpt_session` cookie. |
| `POST` | `/api/auth/link/request` | Cookie | Request OTP to link secondary contact (phone or email). |
| `POST` | `/api/auth/link/verify` | Cookie | Verify OTP and link secondary contact to account. |

---

## Reverse Geocoding Endpoint (`/api/city`)

Resolves latitude and longitude coordinates into a clean city name and state using OpenStreetMap's Nominatim reverse geocoding API. Does not require authentication, allowing it to be used during login and onboarding.

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/city/resolve?lat=<number>&lon=<number>` | No | Resolves coordinates to city, state, and formatted label. Cached for 24h (~100m precision). |
| `GET` | `/api/city/search?q=<string>` | No | Searches Indian cities, towns and villages via Open-Meteo Geocoding API (3-60 chars, cached 24h). |

### Query Parameters
- `lat` (**required**, number): Latitude between `-90` and `90`.
- `lon` (**required**, number): Longitude between `-180` and `180`.

*Invalid or missing coordinates return a `422 ValidationError`.*

### Success Response (`200 OK`)
```json
{
  "city": "Pune",
  "state": "Maharashtra",
  "formatted": "Pune, Maharashtra"
}
```

### Error Responses
- `422 Unprocessable Entity`: Input validation failure (missing or out-of-range coordinates).
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Input validation failed",
      "details": [{ "field": "lat", "message": "Latitude must be between -90 and 90" }]
    },
    "reqId": "..."
  }
  ```
- `404 Not Found`: No usable city-level entity found, upstream Nominatim error, or request timeout.
  ```json
  {
    "error": {
      "code": "NOT_FOUND",
      "message": "Unable to resolve location for the provided coordinates."
    },
    "reqId": "..."
  }
  ```
- `429 Too Many Requests`: IP rate limit exceeded (30 requests per minute).

### Upstream Policy & In-Memory Caching
- **User-Agent Identification**: In compliance with Nominatim's usage policy, outgoing requests carry a descriptive `User-Agent: WeatherGPT-SIH-2026/1.0 (contact: <GEOCODING_CONTACT_EMAIL>)` header.
- **24-Hour Cache**: Coordinates are rounded to 3 decimal places (~100m precision) and cached in-memory for 24 hours via `cache.service.js` to strictly respect Nominatim's 1 req/sec limit.
- **Hierarchy Fallback**: Address extraction prefers `city`, falling back to `town`, `village`, and `county`.

> [!IMPORTANT]
> **OpenStreetMap Attribution Notice**:
> Per OpenStreetMap Nominatim's usage policy, data from this service must be credited. A visible credit such as **"Location data © OpenStreetMap contributors"** must be included in the UI wherever locations resolved by this endpoint are shown.

---

## Protecting Routes (Guide for Teammates)

To attach authentication to any existing or new route (such as `/api/chat` or `/api/chat/voice`):

1. Import the reusable `requireAuth` middleware:
   ```javascript
   import requireAuth from '../middleware/require-auth.middleware.js';
   ```

2. Insert `requireAuth` into the route pipeline before the controller:
   ```javascript
   // src/routes/chat.routes.js
   chatRouter.post(
     '/chat',
     requireAuth,            // <--- Added here
     chatRateLimiter,
     validate(chatBodySchema, 'body'),
     (req, res, next) => chatController.handleChat(req, res, next)
   );
   ```

3. Inside the controller, `req.user` is automatically available:
   ```javascript
   const { id, email, phone, role, location, preferredLanguage } = req.user;
   ```
   If the session cookie is missing, invalid, or expired, `requireAuth` automatically rejects the request with a standardized `401 Unauthorized` response.

---

## Error Contract

Standardized JSON error format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid contact format. Please provide a valid email address or a 10-digit Indian mobile number."
  },
  "reqId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Auth Error Codes:
- `VALIDATION_ERROR` (422): Malformed contact, invalid OTP format, or schema validation failure.
- `UNAUTHORIZED` (401): Session cookie missing, expired, or invalid.
- `FORBIDDEN` (403): Missing `X-Requested-With: WeatherGPT` CSRF header.
- `CONFLICT` (409): Contact is already associated with another account.
- `RATE_LIMIT_EXCEEDED` (429): Exceeded IP rate limit or 5 OTPs per contact per hour cap.
- `OTP_DELIVERY_FAILED` (500): Safe message returned when SMS or email delivery fails.

---

## Testing with cURL

### 1. Bash / Linux / macOS

```bash
# 1. Request OTP for an Indian phone number
curl -X POST http://localhost:3000/api/auth/otp/request \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: WeatherGPT" \
  -d '{"contact": "9876543210"}'

# (In development with SMS_PROVIDER=console, check the server terminal for the 6-digit OTP)

# 2. Verify OTP, register user, and save session cookie to cookie jar
curl -X POST http://localhost:3000/api/auth/otp/verify \
  -c cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: WeatherGPT" \
  -d '{"contact": "9876543210", "code": "123456", "profile": {"role": "farmer", "location": "Pune", "preferredLanguage": "mr"}}'

# 3. Fetch current user using cookie
curl -X GET http://localhost:3000/api/auth/me \
  -b cookies.txt

# 4. Update user profile
curl -X PATCH http://localhost:3000/api/auth/me \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: WeatherGPT" \
  -d '{"location": "Mumbai", "preferredLanguage": "hi"}'

# 5. Link an email to the account
curl -X POST http://localhost:3000/api/auth/link/request \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: WeatherGPT" \
  -d '{"contact": "farmer@example.com"}'

# 6. Verify and complete email linking
curl -X POST http://localhost:3000/api/auth/link/verify \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -H "X-Requested-With: WeatherGPT" \
  -d '{"contact": "farmer@example.com", "code": "654321"}'

# 7. Logout and clear cookie
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt \
  -H "X-Requested-With: WeatherGPT"
```

### 2. Windows PowerShell / Command Prompt (`curl.exe`)

```cmd
:: 1. Request OTP for an email address
curl.exe -X POST http://localhost:3000/api/auth/otp/request ^
  -H "Content-Type: application/json" ^
  -H "X-Requested-With: WeatherGPT" ^
  -d "{\"contact\": \"user@example.com\"}"

:: (Check server terminal console for printed OTP)

:: 2. Verify OTP, register user, and save session cookie
curl.exe -X POST http://localhost:3000/api/auth/otp/verify ^
  -c cookies.txt ^
  -H "Content-Type: application/json" ^
  -H "X-Requested-With: WeatherGPT" ^
  -d "{\"contact\": \"user@example.com\", \"code\": \"123456\", \"profile\": {\"role\": \"commuter\", \"location\": \"Delhi\", \"preferredLanguage\": \"hi\"}}"

:: 3. Fetch current user using cookie
curl.exe -X GET http://localhost:3000/api/auth/me ^
  -b cookies.txt

:: 4. Update user profile
curl.exe -X PATCH http://localhost:3000/api/auth/me ^
  -b cookies.txt ^
  -H "Content-Type: application/json" ^
  -H "X-Requested-With: WeatherGPT" ^
  -d "{\"location\": \"New Delhi\"}"

:: 5. Link Indian phone number to current account
curl.exe -X POST http://localhost:3000/api/auth/link/request ^
  -b cookies.txt ^
  -H "Content-Type: application/json" ^
  -H "X-Requested-With: WeatherGPT" ^
  -d "{\"contact\": \"9876543210\"}"

:: 6. Verify phone link
curl.exe -X POST http://localhost:3000/api/auth/link/verify ^
  -b cookies.txt ^
  -H "Content-Type: application/json" ^
  -H "X-Requested-With: WeatherGPT" ^
  -d "{\"contact\": \"9876543210\", \"code\": \"654321\"}"

:: 7. Logout
curl.exe -X POST http://localhost:3000/api/auth/logout ^
  -b cookies.txt ^
  -c cookies.txt ^
  -H "X-Requested-With: WeatherGPT"
```

---

## Running the Application

```bash
# Start server in production mode
npm start

# Start server in development mode with auto-reload
npm run dev
```
