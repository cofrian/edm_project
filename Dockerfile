# UrbanFlow Valencia — backend FastAPI (Hugging Face Spaces / Docker)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    ENV=production \
    DATA_DIR=/app/data/processed \
    MODEL_DIR=/app/models

WORKDIR /app

# CBC solver para PuLP
RUN apt-get update && apt-get install -y --no-install-recommends coinor-cbc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY . .

EXPOSE 7860
# Hugging Face Spaces Docker debe escuchar en el puerto 7860 (configurable por $PORT)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
