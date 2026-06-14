# Despliegue — UrbanFlow Valencia

## Frontend (Vercel)
1. Importar el repo en Vercel; root del proyecto: `frontend/`.
2. Variable de entorno: `NEXT_PUBLIC_API_URL = https://<tu-space>.hf.space`.
3. Build automático en cada push a `main`/`production`.

## Backend (Hugging Face Spaces · Docker)
1. Crear un Space tipo **Docker**.
2. Subir el contenido de `backend/` (incluidos `models/` con Git LFS y `data/processed/`).
3. Variables: `ENV=production`, `ALLOW_ORIGINS=https://urbanflow-valencia.vercel.app`.
4. El `Dockerfile` instala CBC (PuLP) y arranca `uvicorn` en `$PORT` (7860 en HF).

### Local con Docker
```bash
docker compose up --build
# http://localhost:8000/health
```

## Variables de entorno
- Backend: `ENV`, `DATA_DIR`, `MODEL_DIR`, `ALLOW_ORIGINS`, `MAE_ALERT_THRESHOLD`.
- Frontend: `NEXT_PUBLIC_API_URL`.
- Plantillas en `.env.example` (raíz, `backend/`, `frontend/`).

## CI/CD (GitHub Actions)
- `backend-ci.yml`: instala deps, `ruff`, `pytest`, importa la app.
- `frontend-ci.yml`: `npm ci`, `lint`, `typecheck`, `build`.
- `docker-build.yml`: construye la imagen del backend.
- `deploy-check.yml`: `curl /health` contra `API_URL` (secret) tras push a `production`.

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
