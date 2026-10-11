import requests
import json
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
    55: "Dense drizzle", 61: "Light rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Light snow", 73: "Moderate snow", 75: "Heavy snow", 95: "Thunderstorm",
    96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
}

def decode_wmo(code: int) -> str:
    return WMO_CODES.get(code, f"Unknown weather code ({code})")

def get_storm_severity(wmo_code: int, wind_gusts: float, precip: float) -> Optional[str]:
    # Only evaluate for rain or thunderstorm codes
    if wmo_code not in [61, 63, 65, 95, 96, 99]:
        return None
        
    gusts = wind_gusts if wind_gusts is not None and wind_gusts != "N/A" else 0.0
    rain = precip if precip is not None and precip != "N/A" else 0.0
    
    if gusts >= 50 or rain >= 20:
        severity = "potentially severe"
    elif gusts >= 30 or rain >= 10:
        severity = "moderate"
    else:
        severity = "isolated/mild"
        
    return f"Storm assessment (approximate, not an official severity rating): {severity}"

def fetch_weather(role: str, lat: float, lon: float, location_name: str, day_reference: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Fetches weather data from Open-Meteo based on role and day_reference.
    Returns structured data and a natural language template.
    """
    if day_reference is None:
        day_reference = {"type": "single_day", "offset": 0}
        
    # Convert day_reference to a tuple of sorted items to make it hashable for caching
    day_ref_tuple = tuple(sorted(day_reference.items()))
    
    before_info = _fetch_weather_cached.cache_info()
    res = _fetch_weather_cached(role, lat, lon, location_name, day_ref_tuple)
    after_info = _fetch_weather_cached.cache_info()
    
    if after_info.hits > before_info.hits:
        print(f"CACHE HIT: fetch_weather for {location_name}")
    else:
        print(f"CACHE MISS: fetch_weather for {location_name}")
        
    return res

from functools import lru_cache
import os
import time
import logging

logger = logging.getLogger("weather_fetcher")

# In-memory cache for weather results: (round(lat, 2), round(lon, 2), role, day_ref_tuple) -> {"timestamp": float, "result": dict}
_WEATHER_CACHE = {}

def _get_cached_weather(lat: float, lon: float, role: str, day_ref_tuple: tuple) -> Optional[Dict[str, Any]]:
    key = (round(lat, 2), round(lon, 2), role, day_ref_tuple)
    entry = _WEATHER_CACHE.get(key)
    if not entry:
        return None
    age = time.time() - entry["timestamp"]
    if age <= 600: # 10 minutes live cache
        res = dict(entry["result"])
        res["weather_status"] = "live"
        return res
    elif age <= 10800: # up to 3 hours stale cache
        res = dict(entry["result"])
        res["weather_status"] = "stale"
        return res
    return None

def _store_weather_cache(lat: float, lon: float, role: str, day_ref_tuple: tuple, result: Dict[str, Any]):
    key = (round(lat, 2), round(lon, 2), role, day_ref_tuple)
    _WEATHER_CACHE[key] = {
        "timestamp": time.time(),
        "result": result
    }

def fetch_weather(role: str, lat: float, lon: float, location_name: str, day_reference: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Fetches weather data with resilient retries, caching, and fallback.
    Returns:
    {
        "raw_data": dict,
        "nl_template": str,
        "weather_status": "live" | "stale" | "fallback" | "unavailable"
    }
    """
    if day_reference is None:
        day_reference = {"type": "single_day", "offset": 0}
        
    day_ref_tuple = tuple(sorted(day_reference.items()))

    # Check 10-minute live cache
    cached = _get_cached_weather(lat, lon, role, day_ref_tuple)
    if cached and cached.get("weather_status") == "live":
        logger.info(f"CACHE HIT (live): fetch_weather for {location_name}")
        return cached

    # Attempt live fetch with retry logic
    live_result = _fetch_weather_openmeteo(role, lat, lon, location_name, day_reference)
    if live_result and live_result.get("weather_status") == "live":
        _store_weather_cache(lat, lon, role, day_ref_tuple, live_result)
        return live_result

    # If live fetch failed, check for stale cache younger than 3 hours
    stale_cached = _get_cached_weather(lat, lon, role, day_ref_tuple)
    if stale_cached:
        logger.warning(f"Using stale cached weather data (younger than 3h) for {location_name}")
        stale_cached["weather_status"] = "stale"
        return stale_cached

    # Fallback to OpenWeatherMap if OPENWEATHER_API_KEY is available
    owm_result = _fetch_weather_openweathermap(role, lat, lon, location_name, day_reference)
    if owm_result and owm_result.get("weather_status") == "fallback":
        return owm_result

    # Final fallback: unavailable
    return {
        "raw_data": {},
        "nl_template": f"Weather data is currently unavailable for {location_name}.",
        "weather_status": "unavailable"
    }

def _fetch_weather_openmeteo(role: str, lat: float, lon: float, location_name: str, day_reference: Dict[str, Any]) -> Dict[str, Any]:
    if day_reference.get("type") == "out_of_range":
        return {
            "raw_data": {},
            "nl_template": f"Forecast data isn't available that far out for {location_name}.",
            "weather_status": "unavailable"
        }

    base_url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": ["temperature_2m", "weather_code", "wind_speed_10m", "relative_humidity_2m", "wind_direction_10m", "wind_gusts_10m", "precipitation"],
        "daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_sum", "precipitation_probability_max", "wind_speed_10m_max", "wind_gusts_10m_max", "wind_direction_10m_dominant"],
        "timezone": "auto"
    }

    if role == "farmer":
        params["current"].extend(["soil_moisture_0_to_1cm", "et0_fao_evapotranspiration"])
        params["daily"].append("et0_fao_evapotranspiration_sum")
    elif role == "rural_area":
        params["current"].extend(["precipitation", "visibility"])
        params["daily"].append("precipitation_sum")

    # Retries up to 2 times (total 3 attempts) on timeouts, network errors, 429 and 5xx
    delays = [0.5, 1.5]
    last_err = None
    data = None

    for attempt in range(3):
        start_time = time.time()
        try:
            logger.info(f"OPEN-METEO REQUEST (attempt {attempt+1}): Fetching weather for {location_name} ({lat}, {lon})")
            response = requests.get(base_url, params=params, timeout=8)
            elapsed = time.time() - start_time

            if response.status_code == 200:
                data = response.json()
                break

            # Check if retryable (429 or 5xx)
            if response.status_code == 429 or response.status_code >= 500:
                logger.warning(
                    f"Open-Meteo failed attempt {attempt+1}: HTTP {response.status_code}, elapsed {elapsed:.2f}s, body: {response.text[:200]}"
                )
                if attempt < 2:
                    retry_after = response.headers.get("Retry-After")
                    sleep_time = float(retry_after) if retry_after and retry_after.isdigit() else delays[attempt]
                    time.sleep(sleep_time)
                    continue
                else:
                    return {
                        "raw_data": {},
                        "nl_template": f"The weather service is temporarily unavailable for {location_name}.",
                        "weather_status": "unavailable"
                    }
            else:
                # Other 4xx errors: do NOT retry
                logger.warning(
                    f"Open-Meteo non-retryable error: HTTP {response.status_code}, elapsed {elapsed:.2f}s, body: {response.text[:200]}"
                )
                return {
                    "raw_data": {},
                    "nl_template": f"Weather data could not be retrieved for {location_name}: HTTP {response.status_code}",
                    "weather_status": "unavailable"
                }

        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError, requests.exceptions.RequestException) as e:
            elapsed = time.time() - start_time
            logger.warning(
                f"Open-Meteo exception on attempt {attempt+1}: {type(e).__name__} ({str(e)}), elapsed {elapsed:.2f}s"
            )
            last_err = e
            if attempt < 2:
                time.sleep(delays[attempt])
                continue

    if not data:
        return {
            "raw_data": {},
            "nl_template": f"Weather data is currently unavailable for {location_name}.",
            "weather_status": "unavailable"
        }

    return _build_nl_from_openmeteo(data, role, lat, lon, location_name, day_reference)

def _build_nl_from_openmeteo(data: Dict[str, Any], role: str, lat: float, lon: float, location_name: str, day_reference: Dict[str, Any]) -> Dict[str, Any]:
    current_time_str = data.get("current", {}).get("time", "")
    if current_time_str:
        today_date = datetime.fromisoformat(current_time_str).date()
    else:
        today_date = datetime.now().date()

    daily = data.get("daily", {})
    daily_time = daily.get("time", [])

    nl_template = ""
    
    if day_reference.get("type") == "single_day":
        offset = day_reference.get("offset", 0)
        
        if offset == 0:
            # Original current logic
            current = data.get("current", {})
            temp = current.get("temperature_2m", "N/A")
            wind = current.get("wind_speed_10m", "N/A")
            wind_dir = current.get("wind_direction_10m", "N/A")
            wind_gusts = current.get("wind_gusts_10m", "N/A")
            humidity = current.get("relative_humidity_2m", "N/A")
            precip = current.get("precipitation", "N/A")
            wmo_code = current.get("weather_code", -1)
            weather_desc = decode_wmo(wmo_code)
            
            nl_template = f"Today's current weather in {location_name}: {weather_desc}, Temperature is {temp}°C. Wind: {wind} km/h (direction {wind_dir}°) with gusts up to {wind_gusts} km/h. Humidity is {humidity}%. Rain accumulation is {precip} mm."
            
            storm_note = get_storm_severity(wmo_code, wind_gusts, precip)
            if storm_note:
                nl_template += f" {storm_note}"
            
            if role == "farmer":
                soil = current.get("soil_moisture_0_to_1cm", "N/A")
                et0 = current.get("et0_fao_evapotranspiration", "N/A")
                nl_template += f" Soil moisture is {soil} m³/m³, Evapotranspiration is {et0} mm."
                
            elif role == "fisherman":
                marine_url = "https://marine-api.open-meteo.com/v1/marine"
                marine_params = {"latitude": lat, "longitude": lon, "current": ["wave_height"]}
                try:
                    m_res = requests.get(marine_url, params=marine_params, timeout=5)
                    m_res.raise_for_status()
                    m_data = m_res.json()
                    wave = m_data.get("current", {}).get("wave_height", "N/A")
                    data["marine"] = m_data
                    nl_template += f" Marine conditions: Wave height is {wave} meters."
                except Exception:
                    nl_template += " Marine data currently unavailable."
                    
            elif role == "urban_citizen":
                aq_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
                aq_params = {"latitude": lat, "longitude": lon, "current": ["pm2_5", "us_aqi"]}
                try:
                    aq_res = requests.get(aq_url, params=aq_params, timeout=5)
                    aq_res.raise_for_status()
                    aq_data = aq_res.json()
                    pm25 = aq_data.get("current", {}).get("pm2_5", "N/A")
                    aqi = aq_data.get("current", {}).get("us_aqi", "N/A")
                    data["air_quality"] = aq_data
                    nl_template += f" Air Quality: PM2.5 is {pm25} μg/m³, US AQI is {aqi}."
                except Exception:
                    nl_template += " Air quality data currently unavailable."
                    
            elif role == "rural_area":
                precip = current.get("precipitation", "N/A")
                vis = current.get("visibility", "N/A")
                nl_template += f" Precipitation is {precip} mm, Visibility is {vis} meters."

        else:
            # Future single day
            target_date = today_date + timedelta(days=offset)
            target_date_str = target_date.isoformat()
            
            if target_date_str not in daily_time:
                nl_template = f"Forecast data isn't available that far out for {location_name}."
            else:
                idx = daily_time.index(target_date_str)
                wmo_code = daily.get("weather_code", [])[idx]
                weather_desc = decode_wmo(wmo_code)
                temp_max = daily.get("temperature_2m_max", [])[idx]
                temp_min = daily.get("temperature_2m_min", [])[idx]
                wind_max = daily.get("wind_speed_10m_max", [])[idx]
                wind_gusts = daily.get("wind_gusts_10m_max", [])[idx]
                wind_dir = daily.get("wind_direction_10m_dominant", [])[idx]
                precip = daily.get("precipitation_sum", [])[idx]
                precip_prob = daily.get("precipitation_probability_max", [])[idx]
                
                if offset == 1:
                    day_label = "Tomorrow's"
                else:
                    day_label = f"Forecast for {target_date_str}"
                    
                nl_template = f"{day_label} forecast in {location_name}: {weather_desc}, High {temp_max}°C, Low {temp_min}°C. Max Wind: {wind_max} km/h (direction {wind_dir}°) with gusts up to {wind_gusts} km/h. Chance of rain: {precip_prob}%, with an expected accumulation of {precip} mm."
                
                storm_note = get_storm_severity(wmo_code, wind_gusts, precip)
                if storm_note:
                    nl_template += f" {storm_note}"
                
                if role == "farmer":
                    et0 = daily.get("et0_fao_evapotranspiration_sum", [])[idx]
                    nl_template += f" Evapotranspiration sum will be {et0} mm."

    elif day_reference.get("type") == "range":
        start_offset = day_reference.get("start_offset", 0)
        end_offset = day_reference.get("end_offset", 6)
        
        start_date = today_date + timedelta(days=start_offset)
        end_date = today_date + timedelta(days=end_offset)
        
        # Collect data across indices
        valid_indices = []
        for i, dt_str in enumerate(daily_time):
            dt = datetime.fromisoformat(dt_str).date()
            if start_date <= dt <= end_date:
                valid_indices.append(i)
                
        if not valid_indices:
            nl_template = f"Forecast data isn't available for that range for {location_name}."
        else:
            temps_max = [daily.get("temperature_2m_max", [])[i] for i in valid_indices]
            temps_min = [daily.get("temperature_2m_min", [])[i] for i in valid_indices]
            precips = [daily.get("precipitation_sum", [])[i] for i in valid_indices]
            
            overall_max = max(temps_max)
            overall_min = min(temps_min)
            total_precip = sum(precips)
            
            nl_template = f"This week's summary forecast for {location_name} ({start_date.isoformat()} to {end_date.isoformat()}): Temperatures between {overall_min}°C and {overall_max}°C. Total precipitation expected: {total_precip:.1f} mm."

    return {
        "raw_data": data,
        "nl_template": nl_template,
        "weather_status": "live"
    }

def _fetch_weather_openweathermap(role: str, lat: float, lon: float, location_name: str, day_reference: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    owm_key = os.getenv("OPENWEATHER_API_KEY")
    if not owm_key:
        return None

    try:
        logger.info(f"OPENWEATHER FALLBACK: Fetching weather for {location_name} ({lat}, {lon})")
        # Fetch current conditions
        curr_url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={owm_key}&units=metric"
        curr_res = requests.get(curr_url, timeout=8)
        if not curr_res.ok:
            return None
        curr_data = curr_res.json()

        # Fetch 5-day / 3-hour forecast
        fc_url = f"https://api.openweathermap.org/data/2.5/forecast?lat={lat}&lon={lon}&appid={owm_key}&units=metric"
        fc_res = requests.get(fc_url, timeout=8)
        fc_data = fc_res.json() if fc_res.ok else {}

        # Map to template
        main_weather = curr_data.get("weather", [{}])[0].get("description", "Clear").capitalize()
        temp = curr_data.get("main", {}).get("temp", "N/A")
        humidity = curr_data.get("main", {}).get("humidity", "N/A")
        wind_speed_ms = curr_data.get("wind", {}).get("speed", 0)
        wind_speed_kmh = round(wind_speed_ms * 3.6, 1)
        wind_deg = curr_data.get("wind", {}).get("deg", "N/A")
        rain_1h = curr_data.get("rain", {}).get("1h", 0)

        offset = day_reference.get("offset", 0) if day_reference.get("type") == "single_day" else 0

        if offset == 0:
            nl_template = (
                f"Today's current weather in {location_name} (via OpenWeather fallback): "
                f"{main_weather}, Temperature is {temp}°C. Wind: {wind_speed_kmh} km/h (direction {wind_deg}°). "
                f"Humidity is {humidity}%. Rain accumulation is {rain_1h} mm."
            )
        else:
            # Look into 5-day forecast items
            nl_template = (
                f"Forecast in {location_name} (via OpenWeather fallback): "
                f"{main_weather}, Expected temperature around {temp}°C. Wind: {wind_speed_kmh} km/h. "
                f"Humidity is {humidity}%."
            )

        return {
            "raw_data": {"current": curr_data, "forecast": fc_data},
            "nl_template": nl_template,
            "weather_status": "fallback"
        }
    except Exception as e:
        logger.warning(f"OpenWeather fallback request failed: {e}")
        return None

