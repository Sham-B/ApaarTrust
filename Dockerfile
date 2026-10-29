# ApaarTrust - Production Container
# Compatible with Hugging Face Spaces (Port 7860), Koyeb ($PORT), Render, and Docker hosts

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=7860 \
    DEMO_MODE=1 \
    LOW_MEMORY=1

# Install minimal OS dependencies for OpenCV Headless and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements-render.txt .
RUN pip install --no-cache-dir -r requirements-render.txt

# Copy codebase
COPY . .

# Pre-initialize SQLite tables and seed synthetic archetype data at build time
RUN python -c "from backend.app.db import init_db; from backend.synth.seed import seed_database; init_db(); seed_database(force=False)"

# Expose default container ports (7860 for Hugging Face Spaces, 8080 for standard)
EXPOSE 7860 8080

# Run uvicorn bound to 0.0.0.0 and dynamic PORT
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
