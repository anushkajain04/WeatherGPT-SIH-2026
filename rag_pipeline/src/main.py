from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field, root_validator
from typing import Optional
import logging
import traceback

import config
from src.router import route_query
from src.location import resolve_location
from src.pipeline import run_pipeline

app = FastAPI(title="WeatherGPT API")

try:
    from pydantic import model_validator
    HAS_PYDANTIC_V2 = True
except ImportError:
    from pydantic import root_validator
    HAS_PYDANTIC_V2 = False

class ChatRequest(BaseModel):
    query: str
    role: str = "normal_user"
    location: Optional[str] = None
    lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    lon: Optional[float] = Field(None, ge=-180.0, le=180.0)

    if HAS_PYDANTIC_V2:
        @model_validator(mode="after")
        def check_both_or_neither(self):
            if (self.lat is None and self.lon is not None) or (self.lat is not None and self.lon is None):
                raise ValueError("Both 'lat' and 'lon' must be provided together, or neither.")
            return self
    else:
        @root_validator(skip_on_failure=True)
        def check_both_or_neither(cls, values):
            lat = values.get("lat")
            lon = values.get("lon")
            if (lat is None and lon is not None) or (lat is not None and lon is None):
                raise ValueError("Both 'lat' and 'lon' must be provided together, or neither.")
            return values

class ResolvedDetail(BaseModel):
    name: str
    admin1: Optional[str] = None
    country_code: Optional[str] = None
    lat: float
    lon: float

class ChatResponse(BaseModel):
    answer: str
    route: str
    model_used: str
    latency_seconds: float
    location_resolved: Optional[str] = None
    resolved_detail: Optional[ResolvedDetail] = None
    weather_status: Optional[str] = None

def verify_api_key(x_internal_api_key: Optional[str] = Header(None)):
    if x_internal_api_key != config.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_internal_api_key

import asyncio
from src.vector_store import ingest_documents

@app.on_event("startup")
async def startup_event():
    # Run ingestion asynchronously so it doesn't block Render's port binding!
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, ingest_documents)

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, api_key: str = Depends(verify_api_key)):
    try:
        lane = route_query(request.query)
        
        location_resolved = None
        resolved_detail = None
        coords_override = None

        if lane == "structured":
            if request.lat is not None and request.lon is not None:
                # Both coordinates provided: skip geocoding entirely
                location_name = request.location or "your location"
                location_resolved = request.location
                resolved_detail = ResolvedDetail(
                    name=location_name,
                    admin1=None,
                    country_code="IN",
                    lat=request.lat,
                    lon=request.lon
                )
                coords_override = {
                    "name": location_name,
                    "lat": request.lat,
                    "lon": request.lon,
                    "admin1": None,
                    "country_code": "IN",
                    "country": "India"
                }
            else:
                if not request.location:
                    raise HTTPException(status_code=400, detail="Location is required for structured weather queries.")
                
                geo = resolve_location(request.location)
                if not geo:
                    raise HTTPException(status_code=400, detail=f"Could not geocode location: {request.location}")
                location_resolved = geo["name"]
                resolved_detail = ResolvedDetail(
                    name=geo["name"],
                    admin1=geo.get("admin1"),
                    country_code=geo.get("country_code", "IN"),
                    lat=geo["lat"],
                    lon=geo["lon"]
                )
                coords_override = geo
        
        # Run pipeline
        res = run_pipeline(
            request.query,
            role=request.role,
            requested_location=request.location,
            coords=coords_override
        )
        
        if res.get("error") and res.get("answer") is None:
            # If answer is None and error is populated, both LLMs failed
            logging.error(f"LLM Error: {res['error']}")
            raise HTTPException(status_code=503, detail="The language model is temporarily unavailable.")
                
        return ChatResponse(
            answer=res["answer"] or "",
            route=lane,
            model_used=res["model_used"] or "none",
            latency_seconds=res["latency_seconds"] or 0.0,
            location_resolved=location_resolved,
            resolved_detail=resolved_detail,
            weather_status=res.get("weather_status")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Internal Server Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

