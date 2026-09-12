# WeatherGPT RAG Pipeline

This directory contains the FastAPI-based Retrieval-Augmented Generation pipeline.

## ⚠️ Important Demo Day Note: Render Cold Starts
This service is deployed on Render's free tier. Render spins down the service after 15 minutes of inactivity. **The next request will take 30-60 seconds to wake it back up.**
Before presenting your demo, ping the `/health` endpoint or send a test query a few minutes beforehand to pre-warm the service so your live demo is fast!
