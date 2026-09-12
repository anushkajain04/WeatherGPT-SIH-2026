import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from src.token_utils import estimate_tokens, truncate_to_budget

def test_estimate_tokens():
    assert estimate_tokens("") == 0
    assert estimate_tokens("1234") == 1
    assert estimate_tokens("12345678") == 2
    # Roughly 10 words, ~50 chars -> 12 tokens
    text = "This is a slightly longer sentence to test token estimation."
    assert estimate_tokens(text) == len(text) // 4

def test_truncate_to_budget():
    text = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z"
    # ~51 chars. 5 tokens budget = 20 chars
    truncated = truncate_to_budget(text, 5)
    
    assert len(truncated) <= 20 + len(" ...[TRUNCATED]")
    assert "...[TRUNCATED]" in truncated
    
    # Should not truncate if under budget
    assert truncate_to_budget(text, 100) == text

