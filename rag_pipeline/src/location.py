"""
Location resolution — turns a place name (e.g. "Ludhiana") into coordinates
using Open-Meteo's free Geocoding API (no key required).

This is the fix for the location-mismatch bug found during verification:
the pipeline previously took lat/lon and a display name as SEPARATE
parameters, which meant a caller could pass coordinates for one place and
a name for another with nothing catching it. Resolving from a single
location string removes that failure mode at the source.
"""

import requests

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


import re
from functools import lru_cache

def resolve_location(place_name: str):
    before_info = _resolve_location_cached.cache_info()
    res = _resolve_location_cached(place_name)
    after_info = _resolve_location_cached.cache_info()
    
    if after_info.hits > before_info.hits:
        print(f"CACHE HIT: resolve_location for {place_name}")
    else:
        print(f"CACHE MISS: resolve_location for {place_name}")
        
    return res

@lru_cache(maxsize=256)
def _resolve_location_cached(place_name: str):
    """
    Resolve a place name to coordinates, OR parse raw coordinates directly.
    
    If raw coordinates (e.g., '28.61, 77.20') are provided, skips the API
    and returns a default name ('your location').
    
    Returns {"name": str, "lat": float, "lon": float, "admin1": str, "country": str}
    or None if the place couldn't be resolved.
    """
    # 1. Try parsing as direct coordinates
    try:
        if "," in place_name:
            parts = place_name.split(",")
            if len(parts) == 2:
                lat = float(parts[0].strip())
                lon = float(parts[1].strip())
                # Return pragmatically with "your location"
                return {
                    "name": "your location",
                    "lat": lat,
                    "lon": lon,
                    "admin1": None,
                    "country": None
                }
    except ValueError:
        pass  # Not valid floats, continue to geocode
        
    # 2. Fall back to geocoding
    params = {"name": place_name, "count": 10, "language": "en", "format": "json", "countryCode": "IN"}
    try:
        print(f"OPEN-METEO REQUEST: Geocoding {place_name}")
        r = requests.get(GEOCODING_URL, params=params, timeout=8)
        r.raise_for_status()
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            print(f"OPEN-METEO 429: Rate limit hit geocoding {place_name}")
            # Propagate a soft failure so it gets caught gracefully
            return None
        return None
    except Exception:
        return None
        
    data = r.json()
    results = data.get("results")
    if not results:
        return None

    # Filter to India
    india_results = [
        item for item in results
        if item.get("country_code", "").upper() == "IN" or item.get("country", "").lower() == "india"
    ]
    if not india_results:
        return None

    # Prefer a result whose name matches the query exactly (case-insensitive) before any fuzzy match
    target_norm = place_name.strip().lower()
    chosen = None
    for item in india_results:
        if item.get("name", "").strip().lower() == target_norm:
            chosen = item
            break
    if not chosen:
        chosen = india_results[0]

    return {
        "name": chosen.get("name"),
        "lat": chosen.get("latitude"),
        "lon": chosen.get("longitude"),
        "admin1": chosen.get("admin1"),  # state/region, useful for disambiguating same-named places
        "country": chosen.get("country"),
        "country_code": chosen.get("country_code", "IN"),
    }

