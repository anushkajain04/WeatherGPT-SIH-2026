import re
from typing import Dict, Any

def resolve_day_reference(query: str) -> Dict[str, Any]:
    """
    Parses natural-language day references from the query text.
    Returns:
    {"type": "single_day", "offset": N}
    {"type": "range", "start_offset": A, "end_offset": B}
    {"type": "out_of_range", "offset": N}
    """
    query_lower = query.lower()

    # Default max offset for our 7-day forecast is 6 (0-indexed).
    MAX_DAYS = 6

    # 1. Check for specific range keywords
    if "this week" in query_lower or "next 7 days" in query_lower:
        return {"type": "range", "start_offset": 0, "end_offset": 6}
    
    # 2. Check for explicit "in N days" or "N days from now"
    # Match phrases like "in 3 days", "5 days from now"
    n_days_match = re.search(r"in (\d+) days?", query_lower)
    if not n_days_match:
        n_days_match = re.search(r"(\d+) days? from now", query_lower)
    
    if n_days_match:
        offset = int(n_days_match.group(1))
        if offset > MAX_DAYS:
            return {"type": "out_of_range", "offset": offset}
        return {"type": "single_day", "offset": offset}
        
    # Check text-based numbers just in case (simple ones)
    text_to_num = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
    for word, num in text_to_num.items():
        if f"in {word} days" in query_lower or f"{word} days from now" in query_lower:
            if num > MAX_DAYS:
                return {"type": "out_of_range", "offset": num}
            return {"type": "single_day", "offset": num}

    # 3. Check specific keywords
    if "day after tomorrow" in query_lower:
        return {"type": "single_day", "offset": 2}
    elif "tomorrow" in query_lower:
        return {"type": "single_day", "offset": 1}
    elif "today" in query_lower or "now" in query_lower or "currently" in query_lower or "current" in query_lower:
        return {"type": "single_day", "offset": 0}

    # Default to today if no temporal keywords found
    return {"type": "single_day", "offset": 0}

