import os
import time
from typing import Dict, Any

from langchain_core.globals import set_llm_cache
from langchain_community.cache import SQLiteCache
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage

import config

# Initialize exact-match response cache
# Create the parent directory if it doesn't exist
config.DATA_DIR.mkdir(parents=True, exist_ok=True)
set_llm_cache(SQLiteCache(database_path=str(config.LLM_CACHE_PATH)))

def get_primary_model():
    provider = os.getenv("LLM_PROVIDER", "groq")
    model_name = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")  # default as per spec
    
    return init_chat_model(
        model_name,
        model_provider=provider,
        temperature=0.2,
        timeout=config.LLM_TIMEOUT_SECONDS,
        max_retries=2
    )

def get_fallback_model():
    provider = os.getenv("LLM_FALLBACK_PROVIDER")
    model_name = os.getenv("LLM_FALLBACK_MODEL")
    
    if not provider or not model_name:
        return None
        
    return init_chat_model(
        model_name,
        model_provider=provider,
        temperature=0.2,
        timeout=config.LLM_TIMEOUT_SECONDS,
        max_retries=1
    )

def generate_answer(prompt: str) -> Dict[str, Any]:
    """
    Generates an answer using the primary LLM, falling back to a secondary if configured.
    Returns a dict with 'answer', 'model_used', 'latency_seconds', and optional 'error'.
    """
    start_time = time.time()
    
    try:
        primary_llm = get_primary_model()
    except Exception as e:
        return {
            "answer": None,
            "model_used": None,
            "latency_seconds": time.time() - start_time,
            "error": f"Primary model config error: {e}"
        }

    try:
        response = primary_llm.invoke([HumanMessage(content=prompt)])
        return {
            "answer": response.content,
            "model_used": "primary",
            "latency_seconds": time.time() - start_time,
            "error": None
        }
    except Exception as primary_err:
        try:
            fallback_llm = get_fallback_model()
        except Exception as e:
            return {
                "answer": None,
                "model_used": None,
                "latency_seconds": time.time() - start_time,
                "error": f"Primary model failed ({primary_err}). Fallback config error: {e}"
            }
            
        if not fallback_llm:
            return {
                "answer": None,
                "model_used": None,
                "latency_seconds": time.time() - start_time,
                "error": f"Primary model failed ({primary_err}) and no fallback configured."
            }
            
        try:
            response = fallback_llm.invoke([HumanMessage(content=prompt)])
            return {
                "answer": response.content,
                "model_used": "fallback",
                "latency_seconds": time.time() - start_time,
                "error": None
            }
        except Exception as fallback_err:
            return {
                "answer": None,
                "model_used": None,
                "latency_seconds": time.time() - start_time,
                "error": f"Both primary and fallback models failed. Primary: {primary_err}. Fallback: {fallback_err}"
            }
