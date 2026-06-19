# UrbanFlow Valencia

**Herramienta municipal de planificación urbana (mapa + optimización) y pipeline Jupyter de smart city.**

UrbanFlow permite a un técnico municipal explorar Valencia en capas (Valenbisi, equipamientos, demanda censal, candidatos), simular inversiones con PuLP (notebooks 05–06 + ILP equipamientos) y exportar propuestas. La **presión de tráfico** que alimenta la optimización es **precalculada** en los notebooks 01–04 (`traffic_score` en candidatos). Un sistema de predicción de tráfico en tiempo real para gestión operativa de la ciudad puede evolucionar **en paralelo** y no forma parte de este producto.

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
PuLP optimiza equipamientos urbanos (polideportivo, salud, multi) bajo presupuesto
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
│  PuLP + CBC       →  /optimize/sports, /health, /multi, /valenbisi   │
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
| `/optimizacion` | Polideportivo, salud, multi-objetivo y Valenbisi (PuLP + población real) |
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
| Trigger | Push automático a `production` (rama de despliegue) |

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
| `POST` | `/optimize/sports` | Polideportivo bajo presupuesto (ILP, población real) |
| `POST` | `/optimize/health` | Centro de salud bajo presupuesto (ILP) |
| `POST` | `/optimize/multi` | Multi-objetivo deporte + salud con λ |
| `POST` | `/optimize/valenbisi` | Selección de N ubicaciones (legacy) |
| `POST` | `/optimize/coverage` | Cobertura bajo presupuesto (legacy) |
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

Modelos del notebook SMARTCITIES portados a PuLP/CBC con población censal real (`population_spain.gpkg`):

| Modo | Restricción | Objetivo |
|---|---|---|
| **Polideportivo** | Σ coste ≤ presupuesto | max Σ pⱼ Yⱼ (habitantes sin cobertura deportiva) |
| **Centro de salud** | Σ coste ≤ presupuesto | max Σ pⱼ Yⱼ (habitantes sin cobertura sanitaria) |
| **Multi** | Σ coste ≤ presupuesto, Xᵢ+X'ᵢ≤1 | max λ·deporte + (1−λ)·salud |
| **Valenbisi (legacy)** | Σ xᵢ = N o presupuesto | Score compuesto tráfico + población + déficit |

El solver **CBC** (`coinor-cbc`) se instala en el contenedor Docker y en CI.

### Despliegue en Hugging Face Spaces

| Parámetro | Valor |
|---|---|
| Space | `cofrian/edm_proyect` |
| Tipo | Docker (`sdk: docker`, puerto 7860) |
| Imagen base | `python:3.11-slim` + FastAPI + CatBoost + CBC |
| Repo del Space | Sincronizado automáticamente desde `backend/` vía `deploy-hf.yml` |
| Despliegue | GitHub Actions → `git push` al Space → rebuild Docker en HF |

**Variables de entorno en HF:**

```env
ENV=production
ALLOW_ORIGINS=http://localhost:3000,https://edm-project.vercel.app
```

> `ALLOW_ORIGINS` debe ser **una sola línea separada por comas** (sin saltos de línea). Tras cambiar variables: **Factory rebuild** del Space.

---

## Metodología de trabajo en equipo (GitFlow)

Bloque **ModelOps / Despliegue** de la asignatura EDM. El repositorio `cofrian/edm_project` es el **único punto de entrada** para todo el equipo; Vercel y Hugging Face se actualizan automáticamente al publicar en la rama `production`.

### Ramas y responsabilidades

```
feature/*  →  develop  →  main  →  production
 (trabajo)    (integrar)  (estable)  (publicar → Vercel + HF)
```

| Rama | Qué es | ¿Despliega en Vercel/HF? |
|---|---|---|
| `feature/nombre` | Trabajo individual (Sergio, Luis, Fernando…) | No |
| `develop` | Código integrado del equipo | No |
| `main` | Versión estable, lista para entregar | No (solo CI) |
| `production` | Demo pública y entrega EDM | **Sí** |

**`main` vs `production`:** en `main` el código está validado pero **no** llega a los usuarios. En `production` sí se publica la web y la API. Así podemos acumular cambios en `main` y desplegar solo cuando convenga (p. ej. antes de la demo con el profesor).

### Cómo se juntan cambios de varias personas

Cada miembro crea su rama desde `develop` actualizado:

```bash
git checkout develop && git pull
git checkout -b feature/mi-cambio
# … editar, commit, push …
# Pull Request en GitHub → base: develop
```

Cuando se **mergea** un PR a `develop`, Git **fusiona** esa feature con todo lo ya integrado. Si Sergio sube un mapa y Luis una tabla, `develop` acumula ambos:

```
develop (lunes)     →  código base
develop + PR Luis   →  base + tabla evaluación
develop + PR Sergio →  base + tabla + mapa optimización
develop + PR Fer.   →  base + tabla + mapa + endpoint API
```

**Conflictos:** solo aparecen si dos personas editan **las mismas líneas** del mismo archivo. Se resuelven en GitHub o en local antes del merge.

Antes de abrir PR, conviene traer `develop` a tu feature:

```bash
git checkout feature/mi-cambio
git merge develop
# resolver conflictos si los hay
git push
```

### Publicar en la demo (Vercel + Hugging Face)

Cuando el equipo decide publicar:

```bash
git checkout main && git pull && git merge develop && git push
git checkout production && git pull && git merge main && git push
```

Ese último push a **`production`** es el que dispara el despliegue real.

### Qué carpeta afecta a cada servicio

| Carpeta | Servicio que se actualiza al publicar |
|---|---|
| `frontend/` | **Vercel** (https://edm-project.vercel.app) |
| `backend/` | **Hugging Face** (https://cofrian-edm-proyect.hf.space) |
| `docs/`, `README` | Solo GitHub (no despliega) |

Los colaboradores **no necesitan** cuenta en Vercel ni en Hugging Face: basta con permiso de escritura en GitHub.

Guía detallada para el equipo: [`docs/metodologia-equipo.md`](docs/metodologia-equipo.md)

---

## CI/CD y despliegue en producción

### Visión general (asignatura EDM — Despliegue y ModelOps)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GitHub (edm_project)                            │
│  feature/* ──PR──► develop ──merge──► main ──merge──► production        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
          ▼                     ▼                     ▼
   backend-ci.yml        frontend-ci.yml        deploy-hf.yml
   frontend-ci.yml        (en PR/push)          (solo production)
   docker-build.yml                             deploy-check.yml
   (lint, tests)                                  (curl /health)
          │                     │                     │
          │                     │                     │
          ▼                     ▼                     ▼
     Validación            Validación          Sync backend/ ──► HF Space
     (no despliega)        (no despliega)      Rebuild Docker
                                │
                                ▼
                          Vercel (integración
                          nativa GitHub)
                          deploy frontend/
```

GitHub Actions **no sustituye** a Vercel ni a Hugging Face: **valida** el código y **orquesta** el push al Space. Vercel despliega el frontend por su propia integración con el repo.

### Workflows de GitHub Actions

| Workflow | Cuándo se ejecuta | Qué hace |
|---|---|---|
| `backend-ci.yml` | Push/PR con cambios en `backend/` | Ruff, pytest (13 tests), import FastAPI, CBC + Git LFS |
| `frontend-ci.yml` | Push/PR con cambios en `frontend/` | ESLint, TypeScript, build Next.js |
| `docker-build.yml` | Push a `main` con cambios en `backend/` | Construye imagen Docker (prueba de empaquetado) |
| `deploy-hf.yml` | Push a `production` con cambios en `backend/` | Tests → rsync `backend/` al Space → `git push` → espera `/health` |
| `deploy-check.yml` | Push a `production` | `curl $API_URL/health` (smoke test post-despliegue) |

### Despliegue en Vercel (frontend)

| Parámetro | Valor |
|---|---|
| Proyecto | Conectado a `cofrian/edm_project` |
| Root directory | `frontend/` |
| Rama de producción | `production` |
| Variable | `NEXT_PUBLIC_API_URL=https://cofrian-edm-proyect.hf.space` |

**Flujo:** merge a `production` con cambios en `frontend/` → Vercel detecta el push → `npm run build` → nueva versión en https://edm-project.vercel.app

El frontend llama a la API por HTTP; no incluye modelos ni datos pesados.

### Despliegue en Hugging Face (backend)

| Parámetro | Valor |
|---|---|
| Space | `cofrian/edm_proyect` |
| URL pública | https://cofrian-edm-proyect.hf.space |
| Tipo | Docker (`python:3.11-slim` + FastAPI + CatBoost + CBC) |
| Origen del código | Carpeta `backend/` del monorepo |

**Flujo automatizado (`deploy-hf.yml`):**

1. Push a `production` que toca `backend/`
2. Job `validate`: mismo lint y tests que Backend CI
3. Job `deploy`: clona el Space, copia `backend/` con `rsync`, commit y push con secret `HF_TOKEN`
4. Hugging Face reconstruye la imagen Docker (~2–5 min)
5. Job `deploy-check`: comprueba que `/health` responde

**Secrets en GitHub** (Settings → Secrets → Actions):

| Secret | Uso |
|---|---|
| `HF_TOKEN` | Token Write de Hugging Face para push al Space |
| `API_URL` | (opcional) URL para smoke test; por defecto `https://cofrian-edm-proyect.hf.space` |

### Conexiones entre servicios

| Conexión | Mecanismo | Configuración |
|---|---|---|
| Usuario → Frontend | HTTPS | Vercel CDN |
| Frontend → Backend | `fetch()` JSON | `NEXT_PUBLIC_API_URL` |
| Backend → Frontend | CORS | `ALLOW_ORIGINS` en HF |
| GitHub → Vercel | Integración nativa | Push a `production` |
| GitHub → HF | `deploy-hf.yml` + `HF_TOKEN` | Push a `production` + `backend/` |
| CI → calidad | Actions en PR y push | Ruff, pytest, ESLint, build |

Detalle operativo: [`docs/despliegue.md`](docs/despliegue.md)

---

## Estructura del repositorio

```
EDM-Proyecto/
├── backend/                 # API FastAPI
│   ├── main.py              # Punto de entrada
│   ├── src/                 # Lógica: predict, metrics, optimize, monitoring
│   ├── models/              # 24 × CatBoost (.cbm) + baseline + embeddings
│   ├── data/processed/      # Métricas, predicciones, candidatos, GeoJSON
│   ├── tests/               # 13 tests pytest
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
│   ├── metodologia-equipo.md  # GitFlow, merges, CI/CD para el equipo
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
| Despliegue | Vercel + HF vía GitFlow (`production`), GitHub Actions, Git LFS |
| Monitorización | Alertas MAE, drift, metadata del modelo |
| Aplicación | Dashboard con mapas, gráficos y optimización |

Mapa completo: [`docs/metodologia_edm.md`](docs/metodologia_edm.md)  
Guía de trabajo en equipo (GitFlow + despliegue): [`docs/metodologia-equipo.md`](docs/metodologia-equipo.md)

---

## Demo para evaluación (5 min)

Guion paso a paso en [`docs/demo_profesores.md`](docs/demo_profesores.md).

1. Problema urbano → arquitectura
2. Datos (`/datos`)
3. Predicción en vivo (`/prediccion`)
4. Evaluación con métricas reales (`/evaluacion`)
5. Optimización Valenbisi y cobertura (`/optimizacion`)
6. Monitorización (`/monitorizacion`)
7. CI/CD, GitFlow y despliegue Vercel + Hugging Face (ver README § Metodología y § CI/CD)

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

## Autores

- **Sergio Ortiz Montesinos** — [scofrian@gmail.com](mailto:scofrian@gmail.com)
- **Luis Trigueros Espada**
- **Fernando Martínez Gómez**

## Licencia

MIT — ver [`LICENSE`](LICENSE).
