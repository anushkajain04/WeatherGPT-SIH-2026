import sys
import os
from pathlib import Path
import pytest
from unittest.mock import patch, MagicMock

sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.llm_client import generate_answer, get_primary_model, get_fallback_model

@patch.dict(os.environ, {"LLM_PROVIDER": "invalid_provider", "LLM_MODEL": "test"})
def test_generate_answer_invalid_primary():
    result = generate_answer("test")
    assert result["answer"] is None
    assert "Primary model config error" in result["error"]
    assert "invalid_provider" in result["error"]

@patch.dict(os.environ, {}, clear=True)
@patch('src.llm_client.get_primary_model')
def test_fallback_not_configured(mock_primary):
    # Make primary model fail
    mock_llm = MagicMock()
    mock_llm.invoke.side_effect = Exception("API down")
    mock_primary.return_value = mock_llm
    
    # Env is cleared, so fallback is not configured
    result = generate_answer("test")
    assert result["answer"] is None
    assert "API down" in result["error"]
    assert "no fallback configured" in result["error"]

@patch.dict(os.environ, {"LLM_FALLBACK_PROVIDER": "openai", "LLM_FALLBACK_MODEL": "gpt-4"}, clear=True)
@patch('src.llm_client.get_primary_model')
@patch('src.llm_client.get_fallback_model')
def test_fallback_success(mock_fallback, mock_primary):
    mock_primary_llm = MagicMock()
    mock_primary_llm.invoke.side_effect = Exception("Primary API down")
    mock_primary.return_value = mock_primary_llm
    
    mock_fallback_llm = MagicMock()
    mock_fallback_response = MagicMock()
    mock_fallback_response.content = "Fallback success"
    mock_fallback_llm.invoke.return_value = mock_fallback_response
    mock_fallback.return_value = mock_fallback_llm
    
    result = generate_answer("test")
    assert result["answer"] == "Fallback success"
    assert result["model_used"] == "fallback"
    assert result["error"] is None
