import sys
from pathlib import Path
from typing import Optional, Dict, Any

# Add the rag_pipeline root to sys.path to import modules correctly
sys.path.append(str(Path(__file__).resolve().parent.parent))

import config

from src.router import route_query
from src.weather_fetcher import fetch_weather
from src.vector_store import retrieve_context
from src.prompt_templates import build_prompt
from src.location import geocode_location
from src.llm_client import generate_answer
from src.date_utils import resolve_day_reference

def run_pipeline(query: str, role: str = "normal_user", requested_location: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes the full RAG pipeline:
    1. Route query
    2. Fetch context (structured or semantic)
    3. Build prompt
    4. Call LLM for final generation
    """
    lane = route_query(query)
    
    data_location = None
    
    if lane == "structured":
        loc_name = requested_location if requested_location else "New Delhi"
        geo = geocode_location(loc_name)
        
        if geo:
            data_location = geo["name"]
            day_ref = resolve_day_reference(query)
            weather_result = fetch_weather(role, geo["lat"], geo["lon"], data_location, day_ref)
            context = weather_result["nl_template"]
        else:
            context = f"Could not resolve location for '{loc_name}'. Weather data unavailable."
    else:
        context = retrieve_context(query)
        
    final_prompt = build_prompt(query, role, context, requested_location, data_location)
    
    # LLM Call
    llm_result = generate_answer(final_prompt)
    
    return {
        "prompt": final_prompt,
        "answer": llm_result["answer"],
        "latency_seconds": llm_result["latency_seconds"],
        "model_used": llm_result["model_used"],
        "error": llm_result["error"]
    }

def print_result(res: Dict[str, Any]):
    print("PROMPT:")
    print(res["prompt"])
    print("\n" + "-"*10 + " LLM ANSWER " + "-"*10)
    if res["error"]:
        print(f"ERROR: {res['error']}")
    else:
        try:
            print(res["answer"])
        except UnicodeEncodeError:
            # Handle Windows terminal encoding issues (e.g. narrow no-break space \u202f)
            print(res["answer"].encode(sys.stdout.encoding, errors='replace').decode(sys.stdout.encoding))
    print(f"\n[Model: {res['model_used']} | Latency: {res['latency_seconds']:.2f}s]")

if __name__ == "__main__":
    # Manual verification check
    print("=== WeatherGPT Pipeline Verification (Task 4) ===")
    
    queries = [
        ("What is the temperature today?", "New Delhi", "normal_user"),
        ("What is the temperature today?", "New Delhi", "farmer"),
        ("What is the forecast tomorrow?", "New Delhi", "normal_user")
    ]

    for q, loc, role in queries:
        print(f"\nQuery: {q} | Loc: {loc} | Role: {role}")
        print("=" * 40)
        res = run_pipeline(q, role=role, requested_location=loc)
        print_result(res)
        print("\n" + "="*40 + "\n")

