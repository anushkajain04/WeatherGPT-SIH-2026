import os
import warnings

# Suppress warnings before anything else
import os
import sys
import logging
import warnings

# Suppress C++ TF warnings
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

# Suppress Python warnings from tensorflow and huggingface
warnings.filterwarnings("ignore", category=DeprecationWarning, module="tensorflow")
warnings.filterwarnings("ignore", category=DeprecationWarning, module="tf_keras")
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
logging.getLogger("tensorflow").setLevel(logging.ERROR)
os.environ["TOKENIZERS_PARALLELISM"] = "false"
warnings.filterwarnings("ignore", category=UserWarning, module="tensorflow")
warnings.filterwarnings("ignore", category=UserWarning, module="tf_keras")
from pathlib import Path
from dotenv import load_dotenv

# Base paths relative to this config file
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
CHROMA_DB_DIR = DATA_DIR / "chroma_db"
VECTOR_DOCS_PATH = DATA_DIR / "vector_docs.json"

# Load environment variables
load_dotenv(BASE_DIR.parent / ".env")
# LLM Configuration
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "12"))
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "3000"))
LLM_CACHE_PATH = DATA_DIR / "llm_cache.db"

# Internal Auth
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")
