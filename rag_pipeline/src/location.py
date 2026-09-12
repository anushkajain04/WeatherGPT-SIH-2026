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


def geocode_location(place_name: str):
    """
    Resolve a place name to coordinates.

    Returns {"name": str, "lat": float, "lon": float, "admin1": str, "country": str}
    or None if the place couldn't be resolved.
    """
    params = {"name": place_name, "count": 1, "language": "en", "format": "json"}
    r = requests.get(GEOCODING_URL, params=params, timeout=8)
    r.raise_for_status()
    data = r.json()
    results = data.get("results")
    if not results:
        return None

    top = results[0]
    return {
        "name": top.get("name"),
        "lat": top.get("latitude"),
        "lon": top.get("longitude"),
        "admin1": top.get("admin1"),  # state/region, useful for disambiguating same-named places
        "country": top.get("country"),
    }

