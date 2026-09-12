import sys
from pathlib import Path
import pytest
from unittest.mock import patch

sys.path.append(str(Path(__file__).resolve().parent.parent))

import config

from src.router import route_query
from src.weather_fetcher import decode_wmo, fetch_weather
from src.pipeline import run_pipeline

def test_route_query():
    assert route_query("what is the forecast for tomorrow") == "structured"
    assert route_query("tell me the current temperature") == "structured"
    assert route_query("what does a red alert mean?") == "semantic"
    assert route_query("general safety during floods") == "semantic"
    
    # Regression tests for Task 5
    assert route_query("is there any chance for rain or thunderstorm today?") == "structured"
    assert route_query("any storms expected") == "structured"
    assert route_query("is it safe to go fishing during a storm?") == "semantic"

def test_decode_wmo():
    assert decode_wmo(0) == "Clear sky"
    assert decode_wmo(95) == "Thunderstorm"
    assert "Unknown" in decode_wmo(999)

@patch('src.weather_fetcher.requests.get')
def test_fetch_weather_normal(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "current": {
            "temperature_2m": 30.5,
            "wind_speed_10m": 12.0,
            "weather_code": 1
        }
    }
    
    result = fetch_weather("normal_user", 28.61, 77.2, "New Delhi")
    assert "Mainly clear" in result["nl_template"]
    assert "30.5" in result["nl_template"]
    assert "12.0" in result["nl_template"]

@patch('src.weather_fetcher.requests.get')
def test_fetch_weather_farmer(mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {
        "current": {
            "temperature_2m": 35.0,
            "wind_speed_10m": 10.0,
            "weather_code": 0,
            "soil_moisture_0_to_1cm": 0.25,
            "et0_fao_evapotranspiration": 4.5
        }
    }
    
    result = fetch_weather("farmer", 28.61, 77.2, "New Delhi")
    assert "0.25" in result["nl_template"]
    assert "4.5" in result["nl_template"]

@patch('src.pipeline.generate_answer')
def test_semantic_retrieval_integration(mock_llm):
    # This test requires the vector store to be ingested
    from src.vector_store import CHROMA_DB_DIR
    if not CHROMA_DB_DIR.exists():
        pytest.skip("Chroma DB not found. Run ingestion script first.")
        
    mock_llm.return_value = {
        "answer": "Mocked answer",
        "model_used": "primary",
        "latency_seconds": 0.1,
        "error": None
    }
        
    result = run_pipeline("what is a red alert?", role="normal_user")
    prompt = result["prompt"]
    assert "Red" in prompt or "alert" in prompt
    assert "User question: what is a red alert?" in prompt
    assert result["answer"] == "Mocked answer"

