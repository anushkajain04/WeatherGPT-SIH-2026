# WeatherGPT RAG Pipeline

This directory contains the FastAPI-based Retrieval-Augmented Generation pipeline.

## ⚠️ Important Demo Day Note: Render Cold Starts
This service is deployed on Render's free tier. Render spins down the service after 15 minutes of inactivity. **The next request will take 30-60 seconds to wake it back up.**
Before presenting your demo, ping the `/health` endpoint or send a test query a few minutes beforehand to pre-warm the service so your live demo is fast!

---

## API Endpoints

### `POST /chat`

Processes natural language queries via structured weather lookup or semantic knowledge retrieval.

#### Headers
- `x-internal-api-key`: API key matching `INTERNAL_API_KEY`.

#### Request Body
```json
{
  "query": "What is the temperature today?",
  "role": "normal_user",
  "location": "New Delhi",
  "lat": 28.61,
  "lon": 77.20
}
```

- `query` *(string, required)*: The user's weather or disaster query.
- `role` *(string, optional, default: `"normal_user"`)*: Persona persona (`normal_user`, `farmer`, `commuter`, `tourist`, `outdoor_worker`).
- `location` *(string, optional)*: Plain text location name. Required for structured queries if `lat` and `lon` are omitted.
- `lat` *(float, optional)*: Latitude between `-90.0` and `90.0`. If provided, `lon` is also required. Skips geocoding and directly queries weather for these coordinates.
- `lon` *(float, optional)*: Longitude between `-180.0` and `180.0`. If provided, `lat` is also required. Skips geocoding and directly queries weather for these coordinates.

#### Response Body
```json
{
  "answer": "The current temperature in New Delhi is 30.5°C with clear skies.",
  "route": "structured",
  "model_used": "groq",
  "latency_seconds": 0.42,
  "location_resolved": "New Delhi",
  "resolved_detail": {
    "name": "New Delhi",
    "admin1": "National Capital Territory of Delhi",
    "country_code": "IN",
    "lat": 28.6139,
    "lon": 77.2090
  },
  "weather_status": "live"
}
```

- `answer` *(string)*: LLM-generated answer.
- `route` *(string)*: Routed query type (`structured` or `semantic`).
- `model_used` *(string)*: Model that handled generation (`groq`, `gemini`, etc.).
- `latency_seconds` *(float)*: Latency in seconds.
- `location_resolved` *(string or null)*: Display string for the resolved location.
- `resolved_detail` *(object or null)*: Detailed geocoding / coordinate metadata:
  - `name` *(string)*: Place or location name.
  - `admin1` *(string or null)*: State, region, or administrative district.
  - `country_code` *(string or null)*: 2-letter country code (`"IN"`).
  - `lat` *(float)*: Latitude of the resolved place.
  - `lon` *(float)*: Longitude of the resolved place.
- `weather_status` *(string or null)*: Status of weather retrieval (`"live"`, `"stale"`, `"fallback"`, `"unavailable"`).
