# UrbanFlow Valencia

> Aplicación web de smart city para **predecir la presión de tráfico urbano en Valencia** y
> **optimizar ubicaciones de movilidad sostenible**, con evaluación rigurosa del modelo,
> monitorización de fiabilidad y despliegue profesional. Entrega de la asignatura
> **EDM — Evaluación, Despliegue y Monitorización de Modelos**.

Narrativa única:

```
CatBoost predice tráfico por zona/hora
   → esa predicción se convierte en una señal de presión urbana
      → la optimización (PuLP) selecciona ubicaciones/actuaciones prioritarias
         → la app muestra predicción, evaluación, optimización, mapas y monitorización
```

---

## Demo

- Frontend (Vercel): _pendiente de URL pública_
- Backend (Hugging Face Spaces, Docker): _pendiente de URL pública_ — health en `/health`

---

## Arquitectura

```
Usuario / profesor
      ↓
Frontend Next.js (Vercel)
      ↓  HTTP/JSON
Backend FastAPI (Hugging Face Spaces, Docker)
      ↓
Modelos CatBoost (.cbm) + datos procesados + optimización PuLP
```

Detalle en [`docs/arquitectura.md`](docs/arquitectura.md).

---

## Stack

| Capa | Tecnologías |
|---|---|
| Frontend | Next.js, React, TypeScript, TailwindCSS, shadcn/ui, Recharts, Leaflet |
| Backend | FastAPI, Pydantic, CatBoost, Pandas, PuLP, PyArrow |
| Modelado | CatBoost por hora (baseline + residuo log-ratio + shrink + embeddings) |
| MLOps | GitHub Actions, Docker, Git LFS, validación de artefactos |

---

## Estructura del repositorio

```
.
├── backend/        # API FastAPI + modelos + datos procesados + tests
├── frontend/       # App Next.js (dashboard smart city)
├── notebooks/      # 01..06: datos, CatBoost, evaluación, optimización (explicados)
├── scripts/        # export_models, generate_metrics, generate_candidates, validate_artifacts
├── docs/           # documentación EDM
└── .github/        # CI/CD (workflows) + plantilla de PR
```

---

## Cómo ejecutar

### Backend

```bash
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# http://localhost:8000/health  y  http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # ajusta NEXT_PUBLIC_API_URL
npm run dev
# http://localhost:3000
```

### Con Docker (backend)

```bash
docker compose up --build
```

### Tests

```bash
cd backend && pytest -q
cd frontend && npm run lint && npm run typecheck && npm run build
```

---

## Modelo y datos

- Modelo definitivo: **CatBoost por hora**. Validación temporal (train 1–24 oct, holdout 25–31 oct).
  Métricas reales: **MAE ≈ 44.4, RMSE ≈ 87.8, R² ≈ 0.92, sMAPE ≈ 16.8 %**.
- Los datos crudos y secretos **no** se versionan; solo artefactos derivados en `backend/data/processed/`.
- Detalle en [`docs/modelo_predictivo.md`](docs/modelo_predictivo.md) y el informe de inspección
  [`docs/informe_inspeccion.md`](docs/informe_inspeccion.md).

---

## Metodología EDM

Cobertura completa de CRISP-DM y del temario en [`docs/metodologia_edm.md`](docs/metodologia_edm.md).

---

## Autor

Sergio Ortiz — `scofrian@gmail.com`

## Licencia

Ver [`LICENSE`](LICENSE).
