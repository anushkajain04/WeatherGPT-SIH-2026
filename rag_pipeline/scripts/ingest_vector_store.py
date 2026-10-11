import sys
from pathlib import Path

# Add the rag_pipeline root to sys.path to import modules correctly
sys.path.append(str(Path(__file__).resolve().parent.parent))

import config

from src.vector_store import ingest_documents

if __name__ == "__main__":
    print("Starting vector store ingestion...")
    ingest_documents()
    print("Done.")

