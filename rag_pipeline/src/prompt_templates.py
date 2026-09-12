"""
Role-aware prompt construction.

This phase does NOT call an LLM — build_prompt() just assembles the exact
text that WOULD be sent to one, so retrieval + prompt construction can be
verified by reading the output directly. Once the LLM phase starts, this
string is what gets passed into the chat model call.

Design choices made specifically to reduce hallucination:
1. Grounding rules are kept SEPARATE from role personas, in their own
   constant, so they can never be accidentally weakened or dropped when
   someone edits a persona's wording later.
2. The model is told what to do when context is incomplete (say so, don't
   guess) — not just what to avoid.
3. Context is clearly delimited from instructions, so the model can't
   confuse retrieved data with instructions.
4. requested_location vs data_location lets a mismatch (e.g. the user asked
   about one place but the fetched data is for another) surface to the
   model explicitly, instead of being silently answered as if they matched.
"""

GROUNDING_RULES = (
    "Answer using ONLY the information in the data block below — do not use "
    "outside knowledge, and do not invent numbers, conditions, or facts that "
    "are not present there. If the data doesn't fully answer the question, "
    "say plainly what's missing rather than guessing. State specifics (rain %, "
    "mm, wind km/h, humidity %, etc.) rather than vague generalities. Use a "
    "short paragraph rather than a single terse sentence when there's "
    "substantive data to cover, but don't just repeat the data block verbatim."
)

ROLE_PERSONAS = {
    "normal_user": "You are a helpful weather assistant for the general public. Provide clear, easy-to-understand weather updates and safety advice.",
    "farmer": "You are a specialized agricultural weather advisor. Emphasize soil moisture, evapotranspiration, and how conditions affect crops and farm operations.",
    "fisherman": "You are a specialized marine weather advisor for fishermen. Emphasize wind speed, wave height, and marine safety conditions.",
    "urban_citizen": "You are a city weather advisor. Focus on temperature, rain, and particularly air quality (PM2.5, AQI) and how it affects urban daily life.",
    "rural_area": "You are a rural weather advisor. Focus on precipitation, visibility, and how conditions affect rural travel and infrastructure.",
}


from typing import Optional
from src.token_utils import truncate_to_budget
import config

def build_prompt(query: str, role: str, context: str, requested_location: Optional[str] = None, data_location: Optional[str] = None, max_context_tokens: int = None) -> str:
    """
    Assemble the full prompt text as a single string, for inspection.
    """
    if max_context_tokens is None:
        max_context_tokens = config.MAX_CONTEXT_TOKENS
        
    context = truncate_to_budget(context, max_context_tokens)
    
    persona = ROLE_PERSONAS.get(role, ROLE_PERSONAS["normal_user"])

    location_note = ""
    if requested_location and data_location and requested_location.lower() != data_location.lower():
        location_note = (
            f"\nNote: the user asked about {requested_location}, but the data below is for "
            f"{data_location}. If this mismatch matters to the answer, point it out rather than "
            f"answering as if they're the same place.\n"
        )

    return (
        f"{persona}\n\n"
        f"{GROUNDING_RULES}\n"
        f"{location_note}\n"
        f"--- Data ---\n{context}\n--- End data ---\n\n"
        f"User question: {query}\n"
        f"Answer:"
    )
