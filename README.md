# UrbanFlow Valencia

**Predicción de presión de tráfico urbano y optimización de movilidad sostenible en Valencia.**

Aplicación web de smart city desarrollada como entrega de la asignatura **EDM — Evaluación, Despliegue y Monitorización de Modelos**. Integra un modelo **CatBoost** de predicción horaria, evaluación rigurosa del rendimiento, optimización urbana con **PuLP**, monitorización de fiabilidad y despliegue profesional en producción.

| Demo | URL |
|---|---|
| **Aplicación web** | https://edm-project.vercel.app |
| **API (FastAPI)** | https://cofrian-edm-proyect.hf.space |
| **Documentación API** | https://cofrian-edm-proyect.hf.space/docs |
| **Health check** | https://cofrian-edm-proyect.hf.space/health |
| **Repositorio** | https://github.com/cofrian/edm_project |

---

## Narrativa del proyecto

UrbanFlow Valencia sigue un flujo de valor único y coherente:

```
Tráfico observado (octubre 2023, Valencia)
        ↓
CatBoost predice intensidad por zona y hora
        ↓
La intensidad se traduce en presión de tráfico urbana
        ↓
PuLP optimiza ubicaciones de movilidad sostenible (Valenbisi / cobertura)
        ↓
La app web muestra predicción, evaluación, mapas, optimización y alertas
```

El objetivo no es solo predecir tráfico: es **convertir la predicción en una señal de presión urbana** que alimenta decisiones de planificación (dónde instalar estaciones, cómo priorizar actuaciones bajo presupuesto) y **monitorizar** la fiabilidad del modelo en producción.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario / profesor (navegador)                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND — Next.js 14 (Vercel)                                 │
│  https://edm-project.vercel.app                                 │
│                                                                 │
│  Páginas: Inicio · Datos · Predicción · Evaluación ·            │
│           Optimización · Monitorización · Metodología           │
│                                                                 │
│  lib/api.ts  →  fetch(NEXT_PUBLIC_API_URL + /endpoint)          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON  (CORS)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND — FastAPI + Docker (Hugging Face Spaces)               │
│  https://cofrian-edm-proyect.hf.space                           │
│                                                                 │
│  CatBoost (.cbm)  →  /predict                                   │
│  Artefactos CSV   →  /metrics, /evaluation, /map               │
│  PuLP + CBC       →  /optimize/valenbisi, /optimize/coverage   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              Modelos (24 × .cbm, ~160 MB, Git LFS)
              Datos procesados (CSV, Parquet, GeoJSON)
```

Documentación ampliada: [`docs/arquitectura.md`](docs/arquitectura.md)

---

## Frontend (Next.js · Vercel)

### Qué hace

Dashboard interactivo orientado a la demo EDM. Permite explorar datos, solicitar predicciones en tiempo real, visualizar métricas de evaluación, ejecutar optimización sobre mapa y consultar alertas de monitorización.

### Páginas

| Ruta | Función |
|---|---|
| `/` | Presentación del proyecto y acceso rápido a módulos |
| `/datos` | Descripción del dataset, variables y pipeline de preparación |
| `/prediccion` | Formulario zona/hora/meteo → intensidad + nivel de presión |
| `/evaluacion` | MAE, RMSE, R², sMAPE; gráficos por hora; real vs predicho |
| `/optimizacion` | Modo A (Valenbisi, Σx=N) y Modo B (cobertura con presupuesto) |
| `/monitorizacion` | Alertas de MAE, drift y limitaciones del modelo |
| `/metodologia` | Mapa CRISP-DM / temario EDM → implementación |

### Conexión con el backend

El frontend **no contiene modelos ni datos pesados**. Todas las operaciones pasan por la API:

```typescript
// frontend/lib/constants.ts
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
```

```typescript
// frontend/lib/api.ts — patrón de llamada
fetch(`${API_URL}/predict`, { method: "POST", body: JSON.stringify(payload) })
```

Si la API no responde, `lib/api.ts` devuelve **datos de fallback** para que la interfaz no se rompa en demo (modo degradado).

### Despliegue en Vercel

| Parámetro | Valor |
|---|---|
| Repositorio | `cofrian/edm_project` |
| Root directory | `frontend/` |
| Variable de entorno | `NEXT_PUBLIC_API_URL=https://cofrian-edm-proyect.hf.space` |
| Trigger | Push automático a `main` |

---

## Backend (FastAPI · Hugging Face Spaces)

### Qué hace

API REST que **carga artefactos precomputados** (no entrena en producción). Sirve predicciones CatBoost, métricas de evaluación, mapas GeoJSON, candidatos de optimización y resolución de problemas PuLP.

### Endpoints principales

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Estado de la API |
| `GET` | `/metadata` | Modelo activo, fecha de datos, validación |
| `GET` | `/metrics/global` | MAE, RMSE, R², sMAPE (CatBoost) |
| `GET` | `/metrics/by-hour` | Métricas desglosadas por hora |
| `GET` | `/metrics/errors-by-zone` | Zonas con mayor error |
| `GET` | `/evaluation/scatter` | Muestra real vs predicho |
| `POST` | `/predict` | Intensidad y nivel (baja/media/alta) |
| `POST` | `/optimize/valenbisi` | Selección de N ubicaciones (PuLP) |
| `POST` | `/optimize/coverage` | Cobertura bajo presupuesto (PuLP) |
| `GET` | `/map/traffic-segments` | GeoJSON de segmentos de tráfico |
| `GET` | `/map/current-valenbisi` | Estaciones Valenbisi actuales |
| `GET` | `/candidates/valenbisi` | Puntos candidatos |
| `GET` | `/monitoring/alerts` | Alertas de fiabilidad |

Documentación interactiva (Swagger): https://cofrian-edm-proyect.hf.space/docs

### Modelo predictivo

- **Algoritmo:** CatBoost por hora (24 modelos `.cbm`).
- **Arquitectura híbrida:** baseline suavizado + residuo log-ratio + shrink sigmoidal + embeddings de zona.
- **Validación:** temporal (train 1–24 oct, holdout 25–31 oct 2023).
- **Métricas reales (holdout):**

| MAE | RMSE | R² | sMAPE |
|---|---|---|---|
| ≈ 44.4 veh/h | ≈ 87.8 | ≈ 0.92 | ≈ 16.8 % |

Detalle completo: [`docs/modelo_predictivo.md`](docs/modelo_predictivo.md)

### Optimización (PuLP)

| Modo | Restricción | Objetivo |
|---|---|---|
| **A — Valenbisi** | Σ xᵢ = N | Maximizar score (tráfico + población + déficit) |
| **B — Cobertura** | Σ coste ≤ presupuesto | Maximizar cobertura de población bajo presión |

El solver **CBC** (`coinor-cbc`) se instala en el contenedor Docker.

### Despliegue en Hugging Face Spaces

| Parámetro | Valor |
|---|---|
| Space | `cofrian/edm_proyect` |
| Tipo | Docker (`sdk: docker`, puerto 7860) |
| Imagen base | `python:3.11-slim` + FastAPI + CatBoost + CBC |
| Repo del Space | Contenido de `backend/` (modelos vía Git LFS) |

**Variables de entorno en HF:**

```env
ENV=production
ALLOW_ORIGINS=http://localhost:3000,https://edm-project.vercel.app
```

> `ALLOW_ORIGINS` debe ser **una sola línea separada por comas** (sin saltos de línea). Tras cambiar variables: **Factory rebuild** del Space.

---

## Conexiones entre servicios

```
┌──────────────┐     NEXT_PUBLIC_API_URL      ┌──────────────────┐
│    Vercel    │ ───────────────────────────► │  Hugging Face    │
│  (frontend)  │     HTTPS + JSON             │  (backend API)   │
└──────────────┘                              └──────────────────┘
       │                                              ▲
       │ push a main                                  │ push a main
       ▼                                              │ (repo Space)
┌──────────────┐     CI valida código        ┌──────┴───────────┐
│    GitHub    │ ───────────────────────────►│  cofrian/        │
│ edm_project  │     Actions (lint, tests)     │  edm_proyect     │
└──────────────┘                              └──────────────────┘
       │
       │ push a production
       ▼
  Deploy Check  →  curl API_URL/health
```

| Conexión | Mecanismo | Configuración |
|---|---|---|
| Frontend → Backend | `fetch()` HTTP/JSON | `NEXT_PUBLIC_API_URL` en Vercel |
| Backend → Frontend | CORS | `ALLOW_ORIGINS` en Hugging Face |
| GitHub → Vercel | Integración nativa | Auto-deploy en push a `main` |
| GitHub → HF Space | Push manual al repo del Space | Repo `cofrian/edm_proyect` |
| GitHub → API (smoke test) | `deploy-check.yml` | Secret `API_URL` en GitHub Actions |

---

## CI/CD (GitHub Actions)

Flujo de ramas:

```
feature/*  →  develop  →  main  →  production
```

| Workflow | Trigger | Qué valida |
|---|---|---|
| `backend-ci.yml` | Push/PR en `backend/` | Ruff, pytest (9 tests), import FastAPI, CBC + Git LFS |
| `frontend-ci.yml` | Push/PR en `frontend/` | ESLint, TypeScript, build Next.js |
| `docker-build.yml` | Push/PR en `backend/` (rama `main`) | Construcción imagen Docker |
| `deploy-check.yml` | Push a `production` | `curl $API_URL/health` (secret `API_URL`) |

El **despliegue real** lo ejecutan Vercel y Hugging Face; GitHub Actions **valida calidad** y comprueba que la API responde tras promover a `production`.

Detalle: [`docs/despliegue.md`](docs/despliegue.md)

---

## Estructura del repositorio

```
EDM-Proyecto/
├── backend/                 # API FastAPI
│   ├── main.py              # Punto de entrada
│   ├── src/                 # Lógica: predict, metrics, optimize, monitoring
│   ├── models/              # 24 × CatBoost (.cbm) + baseline + embeddings
│   ├── data/processed/      # Métricas, predicciones, candidatos, GeoJSON
│   ├── tests/               # 9 tests pytest
│   └── Dockerfile           # Imagen Docker (HF Spaces)
│
├── frontend/                # App Next.js
│   ├── app/                 # Páginas (App Router)
│   ├── components/          # UI, mapas, gráficos
│   └── lib/                 # api.ts, types, constants
│
├── notebooks/               # 01–06: pipeline explicado (sin reentrenar)
├── scripts/                 # export_models, generate_metrics, validate_artifacts
├── docs/                    # Documentación EDM completa
│   ├── arquitectura.md
│   ├── despliegue.md
│   ├── modelo_predictivo.md
│   ├── metodologia_edm.md
│   ├── demo_profesores.md   # Guion de demo (5 min)
│   └── informe_inspeccion.md
│
├── .github/workflows/       # CI/CD
├── docker-compose.yml       # Backend local en Docker
└── .gitattributes           # Git LFS (*.cbm, *.parquet)
```

---

## Ejecución local

### Requisitos

- Python 3.11+
- Node.js 20+
- Git LFS (`git lfs install` para clonar modelos `.cbm`)
- Docker (opcional, solo backend)

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Editar .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
```

- App: http://localhost:3000

### Docker (solo backend)

```bash
docker compose up --build
# API en http://localhost:8000/health
```

### Tests y validación

```bash
# Backend
cd backend && pytest -q && ruff check .

# Frontend
cd frontend && npm run lint && npm run typecheck && npm run build

# Artefactos
python scripts/validate_artifacts.py
```

---

## Variables de entorno

### Backend (`backend/.env` o Hugging Face)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `ENV` | Entorno de ejecución | `production` |
| `DATA_DIR` | Ruta a datos procesados | `/app/data/processed` |
| `MODEL_DIR` | Ruta a modelos CatBoost | `/app/models` |
| `ALLOW_ORIGINS` | Orígenes CORS (coma, una línea) | `http://localhost:3000,https://edm-project.vercel.app` |
| `MAE_ALERT_THRESHOLD` | Umbral de alerta MAE (opcional) | `60` |

### Frontend (`frontend/.env.local` o Vercel)

| Variable | Descripción | Ejemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API | `https://cofrian-edm-proyect.hf.space` |

Plantillas: `.env.example`, `backend/.env.example`, `frontend/.env.example`

---

## Metodología EDM

El proyecto cubre el ciclo CRISP-DM y el temario completo de EDM:

| Bloque | Implementación |
|---|---|
| Evaluación | Validación temporal, MAE/RMSE/R²/sMAPE, errores por hora/zona |
| Modelado | CatBoost boosting (vs LightGBM documentado por separado) |
| Fiabilidad | Pydantic, CORS, alertas, limitaciones por zona |
| Automatización | Scripts, notebooks, `validate_artifacts.py`, CI |
| Despliegue | Vercel + Docker/HF, Git LFS, ramas GitFlow |
| Monitorización | Alertas MAE, drift, metadata del modelo |
| Aplicación | Dashboard con mapas, gráficos y optimización |

Mapa completo: [`docs/metodologia_edm.md`](docs/metodologia_edm.md)

---

## Demo para evaluación (5 min)

Guion paso a paso en [`docs/demo_profesores.md`](docs/demo_profesores.md).

1. Problema urbano → arquitectura
2. Datos (`/datos`)
3. Predicción en vivo (`/prediccion`)
4. Evaluación con métricas reales (`/evaluacion`)
5. Optimización Valenbisi y cobertura (`/optimizacion`)
6. Monitorización (`/monitorizacion`)
7. CI/CD y metodología EDM

---

## Stack tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | Next.js 14, React, TypeScript, TailwindCSS, Recharts, Leaflet |
| **Backend** | FastAPI, Pydantic, Uvicorn |
| **ML** | CatBoost, scikit-learn, Pandas, NumPy, PyArrow |
| **Optimización** | PuLP, CBC |
| **Infra** | Vercel, Hugging Face Spaces (Docker), GitHub Actions |
| **Datos** | Git LFS (`.cbm`, `.parquet`), CSV, GeoJSON |

---

## Autor

**Sergio Ortiz** — [scofrian@gmail.com](mailto:scofrian@gmail.com)

## Licencia

MIT — ver [`LICENSE`](LICENSE).
