# WeatherGPT — React frontend

Same design as the HTML prototype, rebuilt with React + Vite + Tailwind CSS.

## Run
    npm install
    npm run dev        # http://localhost:5173
    npm run build      # production build in dist/

## Structure
    src/
    ├── App.jsx                 app state: user, alerts[], chatMessages[], isListening, open popup
    ├── index.css               Tailwind + colour tokens (light/dark) + main-page scaling
    ├── data/mockData.js        ALL mock data — swap for real API calls (IMD, CPCB/AQI, advisories)
    └── components/
        ├── LoginPage.jsx       phone/email, role, location, OTP step
        ├── Dashboard.jsx       page layout
        ├── Header.jsx          logo, location, Alert button, profile button
        ├── HeroWeatherCard.jsx current weather
        ├── ForecastStrip.jsx   hourly + 5-day strips
        ├── AQICard.jsx         air quality
        ├── AdvisoryCard.jsx    role-specific advisory
        ├── HelplineCard.jsx    helpline numbers
        ├── AlertModal.jsx      IMD alert popup (X to close)
        ├── LocationModal.jsx   city / PIN / GPS
        ├── ProfileModal.jsx    view/edit role, language, logout
        ├── ChatbotBar.jsx      docked chatbot bar
        ├── ChatWindow.jsx      chat UI (not connected)
        ├── MessageBubble.jsx   user / assistant / IMD-alert bubbles
        └── MicButton.jsx       mic toggle (UI only)

## Requirements
Node.js 18+ (see `.nvmrc`).

## Connecting the backend
All backend calls live in **`src/api/index.js`**. By default (`VITE_USE_MOCK=true`) they return mock data.

    cp .env.example .env      # then set VITE_USE_MOCK=false and VITE_DEV_PROXY_TARGET=<backend url>

In dev, `/api/*` is proxied to the backend (no CORS setup needed). Endpoints the UI expects:

| Method | Path                   | Body / query                              | Returns |
|--------|------------------------|-------------------------------------------|---------|
| POST   | /auth/request-otp      | { contact }                               | { ok } |
| POST   | /auth/verify-otp       | { contact, otp }                          | { ok, token? } |
| GET    | /dashboard             | ?location=&role=                          | { weather, hourly[], daily[], aqi, alerts[], advisory } |
| POST   | /chat                  | { message, language, location, role }     | { reply, type? }  (type: assistant \| alert) |

Response shapes match the objects in `src/data/mockData.js`.

### Auth
- `POST /auth/verify-otp` may return `{ ok: true, token }`. If a `token` is present it is stored in `sessionStorage` and sent as `Authorization: Bearer <token>` on every later request (`src/api/client.js`).
- Any `401` response clears the token and returns the user to the login page.
- Error responses may include `{ "detail": "message" }`; the UI shows it when present.

### Error handling
If `/dashboard` fails, a banner with a **Retry** button appears above the weather card (last loaded data stays visible). Chat failures show an inline "something went wrong" message.

## Git
    git init && git add . && git commit -m "WeatherGPT React frontend"
    git branch -M main && git remote add origin <your-repo-url> && git push -u origin main
`node_modules`, `dist` and `.env` are git-ignored.
