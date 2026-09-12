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

    # Handle out of range immediately
    if day_reference.get("type") == "out_of_range":
        return {
            "raw_data": {},
            "nl_template": f"Forecast data isn't available that far out for {location_name}."
        }

    base_url = "https://api.open-meteo.com/v1/forecast"
    
    # We will fetch both current and daily just in case, since daily covers up to 7 days by default.
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
        params["daily"].append("precipitation_sum") # Already included above, but we can just let API handle it.

    response = requests.get(base_url, params=params)
    response.raise_for_status()
    data = response.json()
    
    # Today's local date based on system (or we could use current data time, but system today is fine for offsets)
    # Open-Meteo timezone="auto" aligns with the location's local time.
    # To be perfectly safe, let's just use the current time from the data itself if available.
    current_time_str = data.get("current", {}).get("time", "")
    if current_time_str:
        # e.g., "2024-03-01T14:00"
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
                    m_res = requests.get(marine_url, params=marine_params)
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
                    aq_res = requests.get(aq_url, params=aq_params)
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
        "nl_template": nl_template
    }

