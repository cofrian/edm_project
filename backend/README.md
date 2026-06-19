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
| POST | `/optimize/valenbisi` | Modo A — N estaciones Valenbisi (PuLP, notebook 05) |
| POST | `/optimize/coverage` | Modo B — cobertura bajo presupuesto (PuLP, notebook 06) |
| POST | `/optimize/sports` | ILP polideportivos (población censal) |
| POST | `/optimize/health` | ILP centros de salud |
| POST | `/optimize/multi` | Plan mixto deporte + salud |
| GET | `/map/traffic-segments` | GeoJSON red viaria (muestra) |
| GET | `/map/current-valenbisi` | Estaciones Valenbisi actuales |
| GET | `/map/existing-sports` | Polideportivos + isócronas |
| GET | `/map/existing-health` | Centros de salud + isócronas |
| GET | `/map/population-hexes` | Demanda censal (query `facility_type=sports\|health`) |
| GET | `/map/candidates-facilities` | 131 candidatos como GeoJSON |
| POST | `/map/covered-hexes` | Hexágonos cubiertos por candidatos seleccionados |
| GET | `/coverage/summary` | Contadores de demanda y candidatos |
| GET | `/candidates/valenbisi` | Candidatos Modo A (CSV-like JSON) |
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

## Modelo

CatBoost por hora (baseline + residuo log-ratio + shrink + embeddings). Los 24 modelos
`.cbm` (~160 MB) se versionan con Git LFS. No se entrena en producción.
