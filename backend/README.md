---
title: UrbanFlow Valencia API
emoji: 🚦
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# UrbanFlow Valencia — Backend (FastAPI)

API de predicción de presión de tráfico urbano en Valencia (CatBoost) y optimización de
movilidad sostenible (PuLP). Forma parte de la entrega EDM.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API |
| GET | `/metadata` | Modelo activo, fecha de datos, validación |
| GET | `/metrics/global` | MAE, RMSE, R², sMAPE (CatBoost) |
| GET | `/metrics/by-hour` | Métricas por hora |
| GET | `/metrics/errors-by-zone` | Zonas con más error |
| POST | `/predict` | Intensidad y nivel de presión |
| POST | `/optimize/valenbisi` | Selección de N ubicaciones (PuLP) |
| POST | `/optimize/coverage` | Cobertura bajo presupuesto (PuLP) |
| GET | `/map/traffic-segments` | GeoJSON ligero |
| GET | `/api/mobility/valenbisi/stations` | Valenbisi en tiempo real + alertas |
| GET | `/api/mobility/emt/stops` | Paradas EMT |
| GET | `/api/mobility/emt/stops/{stop_id}/arrivals` | Llegadas EMT por parada seleccionada |
| GET | `/api/mobility/emt/routes` | Rutas EMT configuradas o aproximadas |
| GET | `/api/mobility/alerts` | Alertas operativas de movilidad |
| GET | `/candidates/valenbisi` | Candidatos disponibles |
| GET | `/monitoring/alerts` | Alertas de fiabilidad |

Documentación interactiva en `/docs`.

## Ejecución local

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Docker

```bash
docker build -t urbanflow-api .
docker run -p 8000:8000 urbanflow-api
```

## Variables de entorno

- `ALLOW_ORIGINS`: orígenes CORS permitidos (incluir la URL de Vercel).
- `DATA_DIR`, `MODEL_DIR`: rutas a datos procesados y modelos.
- `VALENCIA_VALENBISI_TTL_SECONDS`, `VALENCIA_EMT_STOPS_TTL_SECONDS`,
  `VALENCIA_EMT_ARRIVALS_TTL_SECONDS`, `VALENCIA_EMT_ROUTES_TTL_SECONDS`: TTL de cache.
- `VALENCIA_EMT_ARRIVALS_TIMEOUT_SECONDS`: timeout de consulta SAE EMT.
- `VALENCIA_EMT_ARRIVALS_LAST_GOOD_TTL_SECONDS`: ventana para reutilizar la ultima respuesta SAE valida.
- `VALENCIA_EMT_FALLBACK_HEADWAY_MINUTES`, `VALENCIA_EMT_FALLBACK_MAX_LINES`: frecuencia media y numero maximo de lineas usadas cuando SAE no responde.
- `VALENCIA_EMT_ROUTES_URL`: fuente GeoJSON opcional de shapes/rutas EMT.
- `VALENCIA_EMT_GTFS_RESOURCE_ID`: recurso CKAN Open Data Valencia para resolver el ZIP GTFS oficial de EMT.
- `VALENCIA_EMT_GTFS_URL`: URL ZIP GTFS manual si no se usa CKAN.
- `VALENCIA_EMT_GTFS_NAP_FILE_ID`, `VALENCIA_EMT_GTFS_API_KEY`: alternativa NAP con ApiKey.
- Si no hay GeoJSON ni GTFS disponible, se derivan rutas aproximadas desde paradas como fallback.

## Modelo

CatBoost por hora (baseline + residuo log-ratio + shrink + embeddings). Los 24 modelos
`.cbm` (~160 MB) se versionan con Git LFS. No se entrena en producción.
