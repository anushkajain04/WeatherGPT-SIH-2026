import numpy as np
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

# Prototype queries defining the two intents
STRUCTURED_PROTOTYPES = [
    "What is the temperature forecast for tomorrow?",
    "Will it rain in the evening?",
    "Show me the current wind speed.",
    "What is the air quality PM2.5 right now?",
    "marine wave height forecast",
    "Current weather conditions",
    "tell me the current temperature",
    "is there any chance for rain or thunderstorm today?",
    "Is there a chance of rain today",
    "will it rain later",
    "is a thunderstorm likely",
    "any storms expected"
]

SEMANTIC_PROTOTYPES = [
    "What does an orange alert mean?",
    "How should I stay safe during a flood?",
    "What is the definition of a cold wave?",
    "General cyclone preparedness guidelines.",
    "Meaning of large excess rainfall."
]

# Initialize embedding function
ef = DefaultEmbeddingFunction()

# Pre-compute embeddings for prototypes
try:
    structured_embeddings = ef(STRUCTURED_PROTOTYPES)
    semantic_embeddings = ef(SEMANTIC_PROTOTYPES)
except Exception:
    # Fallback in case of initialization error
    structured_embeddings = []
    semantic_embeddings = []

def cosine_similarity(v1, v2):
    dot_product = np.dot(v1, v2)
    norm_v1 = np.linalg.norm(v1)
    norm_v2 = np.linalg.norm(v2)
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

def route_query(text: str) -> str:
    """
    Routes a user query to either 'structured' or 'semantic' using 
    embedding-based intent classification.
    """
    if not structured_embeddings or not semantic_embeddings:
        return "semantic" # Fallback if embeddings failed to load
        
    try:
        query_embedding = ef([text])[0]
        
        # Calculate max similarity to structured prototypes
        max_structured_sim = max([cosine_similarity(query_embedding, proto_emb) for proto_emb in structured_embeddings])
        
        # Calculate max similarity to semantic prototypes
        max_semantic_sim = max([cosine_similarity(query_embedding, proto_emb) for proto_emb in semantic_embeddings])
        
        if max_structured_sim > max_semantic_sim:
            return "structured"
        else:
            return "semantic"
            
    except Exception as e:
        print(f"Routing error: {e}")
        return "semantic" # Safe fallback
