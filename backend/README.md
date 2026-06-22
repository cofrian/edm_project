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

API de UrbanFlow Valencia. Sirve predicciones de tráfico con CatBoost, datos para
mapas, métricas de evaluación, movilidad en tiempo real y resultados de
optimización con PuLP. Forma parte de la entrega de EDM.

## Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | Estado de la API |
| GET | `/metadata` | Modelo activo, fecha de datos, validación |
| GET | `/metrics/global` | MAE, RMSE, R², sMAPE (CatBoost) |
| GET | `/metrics/by-hour` | Métricas por hora |
| GET | `/metrics/errors-by-zone` | Zonas con más error |
| POST | `/predict` | Intensidad de tráfico y nivel de presión |
| POST | `/optimize/valenbisi` | Selección de un número fijo de ubicaciones (PuLP) |
| POST | `/optimize/coverage` | Cobertura bajo presupuesto (PuLP) |
| GET | `/map/traffic-segments` | Segmentos de tráfico en GeoJSON |
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
python -m venv .venv
source .venv/bin/activate
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
  `VALENCIA_EMT_ARRIVALS_TTL_SECONDS`, `VALENCIA_EMT_ROUTES_TTL_SECONDS`: tiempos de caché.
- `VALENCIA_EMT_ARRIVALS_TIMEOUT_SECONDS`: tiempo máximo de consulta SAE EMT.
- `VALENCIA_EMT_ARRIVALS_LAST_GOOD_TTL_SECONDS`: ventana para reutilizar la última respuesta SAE válida.
- `VALENCIA_EMT_FALLBACK_HEADWAY_MINUTES`, `VALENCIA_EMT_FALLBACK_MAX_LINES`: frecuencia media y número máximo de líneas usadas cuando SAE no responde.
- `VALENCIA_EMT_ROUTES_URL`: fuente GeoJSON opcional de rutas o trazados EMT.
- `VALENCIA_EMT_GTFS_RESOURCE_ID`: recurso CKAN Open Data Valencia para resolver el ZIP GTFS oficial de EMT.
- `VALENCIA_EMT_GTFS_URL`: URL ZIP GTFS manual si no se usa CKAN.
- `VALENCIA_EMT_GTFS_NAP_FILE_ID`, `VALENCIA_EMT_GTFS_API_KEY`: alternativa NAP con API key.
- Si no hay GeoJSON ni GTFS disponible, se crean rutas aproximadas a partir de las paradas.

## Modelo

CatBoost por hora. El modelo combina un patrón base por zona y hora con variables
de calendario, meteorología y tráfico. Los 24 modelos `.cbm` (~160 MB) se guardan
con Git LFS. No se entrena en producción.
