def estimate_tokens(text: str) -> int:
    """
    Estimates the number of tokens in a text string.
    Uses a fast character-based heuristic (~4 chars per token).
    """
    if not text:
        return 0
    return len(text) // 4

def truncate_to_budget(text: str, max_tokens: int) -> str:
    """
    Truncates a text string to stay within the max_tokens budget.
    Uses the same character heuristic.
    """
    if not text:
        return ""
    
    max_chars = max_tokens * 4
    if len(text) > max_chars:
        # Truncate and add a marker indicating it was cut
        return text[:max_chars].rsplit(" ", 1)[0] + " ...[TRUNCATED]"
    
    return text
