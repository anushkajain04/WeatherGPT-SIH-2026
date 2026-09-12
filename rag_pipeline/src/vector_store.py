import os
import json
import chromadb
from typing import List, Dict, Any
import sys
from pathlib import Path
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder

os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("USE_FLAX", "0")

# Add the rag_pipeline root to sys.path to import config
sys.path.append(str(Path(__file__).resolve().parent.parent))
from config import CHROMA_DB_DIR, VECTOR_DOCS_PATH

COLLECTION_NAME = "weathergpt_knowledge"

# Initialize Reranker globally so it's only loaded once
reranker = None
try:
    reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", max_length=512)
except Exception as e:
    print(f"Warning: Failed to load cross-encoder: {e}")

def get_chroma_client():
    return chromadb.PersistentClient(path=str(CHROMA_DB_DIR))

def ingest_documents():
    """
    Idempotent ingestion of the vector_docs.json file.
    """
    if not VECTOR_DOCS_PATH.exists():
        print(f"Error: Seed file not found at {VECTOR_DOCS_PATH}")
        return

    with open(VECTOR_DOCS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    documents_list = data.get("documents", [])
    if not documents_list:
        print("No documents found in seed file.")
        return

    client = get_chroma_client()
    # Using the default embedding function
    collection = client.get_or_create_collection(name=COLLECTION_NAME)
    
    # Check existing ids to prevent duplication
    existing = collection.get()
    existing_ids = set(existing.get("ids", []))
    
    docs_to_add = []
    metadatas_to_add = []
    ids_to_add = []
    
    for doc in documents_list:
        doc_id = str(doc.get("id")) # Chroma requires string ids
        if doc_id not in existing_ids:
            docs_to_add.append(doc.get("text", ""))
            metadatas_to_add.append({
                "category": doc.get("category", ""),
                "title": doc.get("title", ""),
                "tags": ",".join(doc.get("tags", []))
            })
            ids_to_add.append(doc_id)
            
    if docs_to_add:
        collection.add(
            documents=docs_to_add,
            metadatas=metadatas_to_add,
            ids=ids_to_add
        )
        print(f"Successfully ingested {len(docs_to_add)} new documents.")
    else:
        print("No new documents to ingest. Database is up to date.")

def build_bm25_index(collection):
    """
    Builds an in-memory BM25 index from all documents in the Chroma collection.
    """
    data = collection.get()
    docs = data.get("documents", [])
    ids = data.get("ids", [])
    
    if not docs:
        return None, [], []
        
    # Simple tokenization by splitting on whitespace
    tokenized_corpus = [doc.lower().split(" ") for doc in docs]
    bm25 = BM25Okapi(tokenized_corpus)
    return bm25, docs, ids

def retrieve_context(query: str, top_k: int = 1) -> str:
    """
    Hybrid retrieval (ChromaDB + BM25) + Cross-Encoder reranking.
    """
    client = get_chroma_client()
    try:
        collection = client.get_collection(name=COLLECTION_NAME)
    except Exception:
        return "Knowledge base not initialized. Please run ingest_vector_store.py first."

    # 1. Dense Retrieval (ChromaDB)
    n_candidates = min(10, collection.count())
    if n_candidates == 0:
        return "No relevant context found."
        
    dense_results = collection.query(
        query_texts=[query],
        n_results=n_candidates
    )
    dense_docs = dense_results.get("documents", [[]])[0]
    
    # 2. Lexical Retrieval (BM25)
    bm25, all_docs, all_ids = build_bm25_index(collection)
    bm25_docs = []
    if bm25:
        tokenized_query = query.lower().split(" ")
        bm25_docs = bm25.get_top_n(tokenized_query, all_docs, n=n_candidates)
        
    # Combine and deduplicate
    candidate_pool = list(set(dense_docs + bm25_docs))
    
    # 3. Reranking
    if reranker and candidate_pool:
        # Create pairs of (query, document)
        pairs = [[query, doc] for doc in candidate_pool]
        
        # Predict scores
        scores = reranker.predict(pairs)
        
        # Sort documents by score descending
        doc_score_pairs = list(zip(candidate_pool, scores))
        doc_score_pairs.sort(key=lambda x: x[1], reverse=True)
        
        # Select top_k
        final_docs = [doc for doc, score in doc_score_pairs[:top_k]]
    else:
        # Fallback if reranker failed to load
        final_docs = dense_docs[:top_k]

    if not final_docs:
         return "No relevant context found."
         
    return "\n\n".join(final_docs)
