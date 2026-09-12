from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
import logging
import traceback

import config
from src.router import route_query
from src.location import geocode_location
from src.pipeline import run_pipeline

app = FastAPI(title="WeatherGPT API")

class ChatRequest(BaseModel):
    query: str
    role: str = "normal_user"
    location: Optional[str] = None

class ChatResponse(BaseModel):
    answer: str
    route: str
    model_used: str
    latency_seconds: float
    location_resolved: Optional[str] = None

def verify_api_key(x_internal_api_key: Optional[str] = Header(None)):
    if x_internal_api_key != config.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return x_internal_api_key

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest, api_key: str = Depends(verify_api_key)):
    try:
        lane = route_query(request.query)
        
        location_resolved = None
        if lane == "structured":
            if not request.location:
                raise HTTPException(status_code=400, detail="Location is required for structured weather queries.")
            
            geo = geocode_location(request.location)
            if not geo:
                raise HTTPException(status_code=400, detail=f"Could not geocode location: {request.location}")
            location_resolved = geo["name"]
        
        # Run pipeline
        res = run_pipeline(request.query, role=request.role, requested_location=request.location)
        
        if res.get("error") and res.get("answer") is None:
            # If answer is None and error is populated, both LLMs failed
            logging.error(f"LLM Error: {res['error']}")
            raise HTTPException(status_code=503, detail="The language model is temporarily unavailable.")
                
        return ChatResponse(
            answer=res["answer"] or "",
            route=lane,
            model_used=res["model_used"] or "none",
            latency_seconds=res["latency_seconds"] or 0.0,
            location_resolved=location_resolved
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Internal Server Error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

