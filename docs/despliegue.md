# Despliegue — UrbanFlow Valencia

## Frontend (Vercel)
1. Importar el repo en Vercel; root del proyecto: `frontend/`.
2. Variable de entorno: `NEXT_PUBLIC_API_URL = https://<tu-space>.hf.space`.
3. Build automático en cada push a `main`/`production`.

## Backend (Hugging Face Spaces · Docker)
1. Crear un Space tipo **Docker**.
2. Subir el contenido de `backend/` (incluidos `models/` con Git LFS y `data/processed/`).
3. Variables: `ENV=production`, `ALLOW_ORIGINS=https://edm-project.vercel.app`.
4. Secret opcional: `AEMET_API_KEY` ([opendata.aemet.es](https://opendata.aemet.es)) para meteo en vivo; sin ella la API usa defaults.
5. Variables opcionales de movilidad: `VALENCIA_VALENBISI_TTL_SECONDS`, `VALENCIA_EMT_ARRIVALS_TTL_SECONDS`, `VALENCIA_EMT_ROUTES_URL`.
6. El `Dockerfile` instala CBC (PuLP) y arranca `uvicorn` en `$PORT` (7860 en HF).

### Local con Docker
```bash
docker compose up --build
# http://localhost:8000/health
```

## Variables de entorno
- Backend: `ENV`, `DATA_DIR`, `MODEL_DIR`, `ALLOW_ORIGINS`, `MAE_ALERT_THRESHOLD`, `AEMET_API_KEY` (opcional, solo en HF).
- Movilidad backend: `VALENCIA_VALENBISI_TTL_SECONDS=180`, `VALENCIA_EMT_STOPS_TTL_SECONDS=21600`, `VALENCIA_EMT_ARRIVALS_TTL_SECONDS=45`, `VALENCIA_EMT_ROUTES_TTL_SECONDS=21600`, `VALENCIA_EVENT_VALENBISI_RADIUS_METERS=1000`, `VALENCIA_EMT_DELAY_THRESHOLD_MINUTES=3`, `VALENCIA_EMT_AVG_SPEED_KMH=14`, `VALENCIA_EMT_ROUTES_URL` (opcional).
- Frontend: `NEXT_PUBLIC_API_URL`.
- Plantillas en `.env.example` (raíz, `backend/`, `frontend/`).

## CI/CD (GitHub Actions)
- `backend-ci.yml`: instala deps, `ruff`, `pytest`, importa la app.
- `frontend-ci.yml`: `npm ci`, `lint`, `typecheck`, `build`.
- `docker-build.yml`: construye la imagen del backend.
- `deploy-hf.yml`: tras validar backend en `production`, sincroniza `backend/` al Space de Hugging Face.
- `deploy-check.yml`: `curl /health` contra `API_URL` (secret) tras push a `production`.

### Secret para despliegue automático a Hugging Face

En **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Descripción |
|---|---|
| `HF_TOKEN` | Token de Hugging Face con permiso **write** ([crear aquí](https://huggingface.co/settings/tokens)) |
| `API_URL` | (opcional) URL de la API para smoke test; por defecto `https://cofrian-edm-proyect.hf.space` |

Flujo en `production`:
```
push production → backend-ci + deploy-hf (validate → sync HF → health check)
                → deploy-check (curl /health)
```

Vercel sigue desplegando el frontend por su integración nativa con GitHub.

## Modelos pesados (Git LFS)
Los `.cbm` (160 MB) se versionan con Git LFS (`.gitattributes`). Antes del primer push:
```bash
git lfs install
git lfs track "*.cbm"
```

## Smoke test
```bash
python scripts/validate_artifacts.py     # valida artefactos
curl -f http://localhost:8000/health      # backend vivo
```

## Rollback básico
- `production` se actualiza solo desde `main` validado. Para revertir: `git revert` del merge
  o reapuntar `production` al commit estable anterior y volver a desplegar.
