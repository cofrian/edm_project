# Arquitectura — UrbanFlow Valencia

```
Usuario / profesor
      │
      ▼
Frontend Next.js (Vercel)
      │  HTTP / JSON  (NEXT_PUBLIC_API_URL)
      ▼
Backend FastAPI (Docker · Hugging Face Spaces)
      │
      ├── Modelos CatBoost (.cbm)  ──► /predict
      ├── Datos procesados (CSV/Parquet/GeoJSON) ──► /metrics, /map, /candidates
      └── Optimización PuLP ──► /optimize/valenbisi, /optimize/coverage
```

## Componentes

### Frontend (`frontend/`)
- Next.js 14 (App Router), TypeScript, TailwindCSS, Recharts, Leaflet.
- `lib/api.ts` centraliza las llamadas y aplica **fallback** si la API no responde.
- Páginas: inicio, datos, predicción, evaluación, optimización, monitorización, metodología.

### Backend (`backend/`)
- FastAPI + Pydantic. Carga artefactos desde `DATA_DIR` y modelos desde `MODEL_DIR`.
- No entrena en producción: solo carga `.cbm` y datos derivados.
- Optimización con PuLP (solver CBC).

### Flujo de datos (narrativa única)
1. CatBoost predice intensidad por zona/hora (`/predict`).
2. Esa intensidad agregada por zona es la **presión de tráfico**.
3. La presión alimenta el score de optimización (`/optimize/*`).
4. La app muestra predicción, evaluación, mapas, optimización y monitorización.

## Principios
- Sin rutas absolutas (todo por variables de entorno).
- Sin secretos en el repo.
- Datos pesados fuera del frontend; modelos vía Git LFS.
- CORS restringido por entorno.
