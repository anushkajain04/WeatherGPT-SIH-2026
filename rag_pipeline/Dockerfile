FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install them
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# (Local PyTorch models have been replaced by Gemini Embedding APIs to save RAM)

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 8000

# Run the ingestion script, then start the uvicorn server
CMD python scripts/ingest_vector_store.py && uvicorn src.main:app --host 0.0.0.0 --port 8000

