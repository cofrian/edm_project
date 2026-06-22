# UrbanFlow Valencia

**Predicción de tráfico y optimización urbana en Valencia.**

Aplicación web desarrollada como entrega de la asignatura **EDM — Evaluación, Despliegue y Monitorización de Modelos**. Integra predicción horaria con **CatBoost**, evaluación del modelo, optimización urbana con **PuLP**, monitorización de fiabilidad y despliegue en Vercel y Hugging Face.

| Demo | URL |
|---|---|
| **Aplicación web** | https://edm-project.vercel.app |
| **API (FastAPI)** | https://cofrian-edm-proyect.hf.space |
| **Documentación API** | https://cofrian-edm-proyect.hf.space/docs |
| **Estado de la API** | https://cofrian-edm-proyect.hf.space/health |
| **Repositorio** | https://github.com/cofrian/edm_project |

---

## Narrativa del proyecto

UrbanFlow Valencia sigue un flujo sencillo:

```
Tráfico observado (octubre 2023, Valencia)
        ↓
CatBoost predice intensidad por zona y hora
        ↓
La intensidad se traduce en presión de tráfico
        ↓
PuLP recomienda equipamientos urbanos bajo presupuesto
        ↓
La app web muestra predicción, evaluación, mapas, optimización y alertas
```

El objetivo no es solo predecir tráfico. La predicción se usa como señal para tomar decisiones de planificación: dónde instalar nuevos puntos, cómo priorizar actuaciones con presupuesto limitado y cómo vigilar si el modelo sigue siendo fiable.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│  Usuario (navegador)                                            │
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
│  Archivos CSV     →  /metrics, /evaluation, /map               │
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

Panel web para explorar datos, consultar tráfico y predicción, revisar métricas de evaluación, ejecutar optimizaciones sobre el mapa y ver alertas de fiabilidad.

### Páginas

| Ruta | Función |
|---|---|
| `/` | Presentación del proyecto y acceso rápido a módulos |
| `/datos` | Datos usados por la app, variables y preparación |
| `/prediccion` | Tráfico real, predicción por hora y movilidad en tiempo real |
| `/evaluacion` | MAE, RMSE, R², sMAPE; gráficos por hora; real vs predicho |
| `/optimizacion` | Polideportivo, salud, varios objetivos y Valenbisi |
| `/monitorizacion` | Alertas de MAE, pérdida de precisión y limitaciones del modelo |
| `/metodologia` | Cómo encaja el proyecto con CRISP-DM y EDM |

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

Si la API no responde, `lib/api.ts` devuelve **datos alternativos** para que la interfaz no se rompa durante la demo.

### Despliegue en Vercel

| Parámetro | Valor |
|---|---|
| Repositorio | `cofrian/edm_project` |
| Carpeta raíz | `frontend/` |
| Variable de entorno | `NEXT_PUBLIC_API_URL=https://cofrian-edm-proyect.hf.space` |
| Publicación | Push automático a `production` |

---

## Backend (FastAPI · Hugging Face Spaces)

### Qué hace

API REST que **carga archivos ya preparados**. No entrena modelos en producción. Sirve predicciones CatBoost, métricas de evaluación, mapas GeoJSON, candidatos de optimización y resultados de PuLP.

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
| `GET` | `/predict/heatmap` | Predicción de todas las zonas para una hora |
| `POST` | `/predict/hour` | Igual que heatmap con body JSON |
| `GET` | `/weather/current` | Tiempo actual (AEMET o valores por defecto) |
| `GET` | `/weather/forecast` | Serie horaria del día |
| `GET` | `/traffic/live` | Tráfico real del Ayuntamiento (ArcGIS) |
| `GET` | `/api/mobility/valenbisi/stations` | Valenbisi en tiempo real + alertas |
| `GET` | `/api/mobility/emt/stops` | Paradas EMT desde Geoportal |
| `GET` | `/api/mobility/emt/stops/{stop_id}/arrivals` | Llegadas SAE EMT por parada seleccionada |
| `GET` | `/api/mobility/emt/routes` | Rutas EMT configuradas o aproximadas por paradas |
| `GET` | `/api/mobility/alerts` | Alertas operativas de movilidad |
| `GET` | `/events` | Eventos urbanos (`?from=&to=`) |
| `GET` | `/map/zones` | GeoJSON ~1.158 puntos zona |
| `POST` | `/optimize/sports` | Polideportivo bajo presupuesto |
| `POST` | `/optimize/health` | Centro de salud bajo presupuesto |
| `POST` | `/optimize/multi` | Varios objetivos: deporte + salud con λ |
| `POST` | `/optimize/valenbisi` | Selección de un número fijo de ubicaciones |
| `POST` | `/optimize/coverage` | Cobertura bajo presupuesto |
| `GET` | `/map/traffic-segments` | GeoJSON de segmentos de tráfico |
| `GET` | `/map/current-valenbisi` | Estaciones Valenbisi actuales |
| `GET` | `/candidates/valenbisi` | Puntos candidatos |
| `GET` | `/monitoring/alerts` | Alertas de fiabilidad |

Documentación interactiva (Swagger): https://cofrian-edm-proyect.hf.space/docs

### Modelo predictivo

- **Algoritmo:** CatBoost por hora (24 modelos `.cbm`).
- **Enfoque:** patrón base por zona y hora + ajuste con CatBoost.
- **Validación:** temporal, entrenando con los días 1-24 y probando con los días 25-31 de octubre de 2023.
- **Métricas reales de prueba:**

| MAE | RMSE | R² | sMAPE |
|---|---|---|---|
| ≈ 44.4 veh/h | ≈ 87.8 | ≈ 0.92 | ≈ 16.8 % |

Detalle completo: [`docs/modelo_predictivo.md`](docs/modelo_predictivo.md)

### Optimización (PuLP)

Modelos de optimización implementados con PuLP/CBC y población censal real (`population_spain.gpkg`):

| Modo | Restricción | Objetivo |
|---|---|---|
| **Polideportivo** | Σ coste ≤ presupuesto | Maximizar habitantes sin cobertura deportiva |
| **Centro de salud** | Σ coste ≤ presupuesto | Maximizar habitantes sin cobertura sanitaria |
| **Multi** | Σ coste ≤ presupuesto, Xᵢ+X'ᵢ≤1 | Equilibrar deporte y salud |
| **Valenbisi** | Número fijo o presupuesto | Puntuación de tráfico + población + déficit |

El optimizador **CBC** (`coinor-cbc`) se instala en el contenedor Docker y en CI.

### Despliegue en Hugging Face Spaces

| Parámetro | Valor |
|---|---|
| Space | `cofrian/edm_proyect` |
| Tipo | Docker, puerto 7860 |
| Imagen base | `python:3.11-slim` + FastAPI + CatBoost + CBC |
| Repo del Space | Sincronizado automáticamente desde `backend/` con `deploy-hf.yml` |
| Despliegue | GitHub Actions → `git push` al Space → reconstrucción de Docker en HF |

**Variables de entorno en HF** (Settings → Variables and secrets):

```env
ENV=production
ALLOW_ORIGINS=http://localhost:3000,https://edm-project.vercel.app
VALENCIA_VALENBISI_TTL_SECONDS=180
VALENCIA_EMT_ARRIVALS_TTL_SECONDS=45
```

| Secreto / variable | Obligatorio | Descripción |
|---|---|---|
| `AEMET_API_KEY` | No | API key de [opendata.aemet.es](https://opendata.aemet.es). Sin ella, `/weather/current` devuelve valores por defecto (`source: "default"`). Con clave válida devuelve datos de AEMET. |

> `ALLOW_ORIGINS` debe ser **una sola línea separada por comas**. Tras cambiar variables o secretos, conviene hacer **Factory rebuild** en el Space para reconstruirlo por completo.

---

## Metodología de trabajo en equipo (GitFlow)

Bloque de **despliegue y monitorización** de la asignatura EDM. El repositorio `cofrian/edm_project` es el punto de entrada para todo el equipo. Vercel y Hugging Face se actualizan automáticamente al publicar en la rama `production`.

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

Cuando se fusiona un PR en `develop`, Git junta ese cambio con todo lo ya integrado. Si Sergio sube un mapa y Luis una tabla, `develop` acumula ambos:

```
develop (lunes)     →  código base
develop + PR Luis   →  base + tabla evaluación
develop + PR Sergio →  base + tabla + mapa optimización
develop + PR Fer.   →  base + tabla + mapa + endpoint API
```

**Conflictos:** solo aparecen si dos personas editan **las mismas líneas** del mismo archivo. Se resuelven en GitHub o en local antes de fusionar.

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
| `docs/`, `README.md` | Solo GitHub (no despliega) |

Los colaboradores **no necesitan** cuenta en Vercel ni en Hugging Face: basta con permiso de escritura en GitHub.

Guía detallada para el equipo: [`docs/metodologia-equipo.md`](docs/metodologia-equipo.md)

---

## CI/CD y despliegue en producción

### Visión general (asignatura EDM — despliegue y monitorización)

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
     Validación            Validación          Copia backend/ ──► HF Space
     (no despliega)        (no despliega)      Reconstruye Docker
                                │
                                ▼
                          Vercel (integración
                          nativa GitHub)
                          despliega frontend/
```

GitHub Actions **no sustituye** a Vercel ni a Hugging Face: revisa el código y publica el backend en el Space. Vercel despliega el frontend con su integración propia de GitHub.

### Procesos de GitHub Actions

| Proceso | Cuándo se ejecuta | Qué hace |
|---|---|---|
| `backend-ci.yml` | Push/PR con cambios en `backend/` | Ruff, pytest (13 tests), carga de FastAPI, CBC + Git LFS |
| `frontend-ci.yml` | Push/PR con cambios en `frontend/` | ESLint, TypeScript, build Next.js |
| `docker-build.yml` | Push a `main` con cambios en `backend/` | Construye imagen Docker (prueba de empaquetado) |
| `deploy-hf.yml` | Push a `production` con cambios en `backend/` | Tests → rsync `backend/` al Space → `git push` → espera `/health` |
| `deploy-check.yml` | Push a `production` | `curl $API_URL/health` para comprobar que la API responde |

### Despliegue en Vercel (frontend)

| Parámetro | Valor |
|---|---|
| Proyecto | Conectado a `cofrian/edm_project` |
| Carpeta raíz | `frontend/` |
| Rama de producción | `production` |
| Variable | `NEXT_PUBLIC_API_URL=https://cofrian-edm-proyect.hf.space` |

**Flujo:** fusión a `production` con cambios en `frontend/` → Vercel detecta el push → `npm run build` → nueva versión en https://edm-project.vercel.app

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
2. Trabajo `validate`: mismas revisiones y tests que Backend CI
3. Trabajo `deploy`: clona el Space, copia `backend/` con `rsync`, hace commit y push con el secreto `HF_TOKEN`
4. Hugging Face reconstruye la imagen Docker (~2–5 min)
5. Trabajo `deploy-check`: comprueba que `/health` responde

**Secretos en GitHub** (Settings → Secrets → Actions):

| Secret | Uso |
|---|---|
| `HF_TOKEN` | Token Write de Hugging Face para push al Space |
| `API_URL` | (opcional) URL para comprobar la API; por defecto `https://cofrian-edm-proyect.hf.space` |

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
│   ├── models/              # 24 × CatBoost (.cbm) + patrón base y datos de zona
│   ├── data/processed/      # Métricas, predicciones, candidatos, GeoJSON
│   ├── tests/               # 13 tests pytest
│   └── Dockerfile           # Imagen Docker (HF Spaces)
│
├── frontend/                # App Next.js
│   ├── app/                 # Páginas (App Router)
│   ├── components/          # UI, mapas, gráficos
│   └── lib/                 # api.ts, types, constants
│
├── notebooks/               # 01–06: flujo explicado (sin reentrenar)
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

# Archivos
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
| `AEMET_API_KEY` | API key opendata.aemet.es (tiempo en vivo) | *(opcional)* |
| `MAE_ALERT_THRESHOLD` | Umbral de alerta MAE (opcional) | `60` |
| `VALENCIA_VALENBISI_TTL_SECONDS` | Caché de Valenbisi en tiempo real | `180` |
| `VALENCIA_EMT_STOPS_TTL_SECONDS` | Caché de paradas EMT | `21600` |
| `VALENCIA_EMT_ARRIVALS_TTL_SECONDS` | Caché de llegadas SAE por parada | `45` |
| `VALENCIA_EMT_ARRIVALS_TIMEOUT_SECONDS` | Tiempo máximo de consulta SAE EMT | `12` |
| `VALENCIA_EMT_ROUTES_TTL_SECONDS` | Caché de rutas EMT | `21600` |
| `VALENCIA_EVENT_VALENBISI_RADIUS_METERS` | Radio para alertas Valenbisi cerca de eventos | `1000` |
| `VALENCIA_EMT_DELAY_THRESHOLD_MINUTES` | Umbral de retraso EMT | `3` |
| `VALENCIA_EMT_AVG_SPEED_KMH` | Velocidad media para posición estimada | `14` |
| `VALENCIA_EMT_ROUTES_URL` | Fuente GeoJSON opcional de rutas o trazados EMT | *(opcional)* |
| `VALENCIA_EMT_GTFS_RESOURCE_ID` | Recurso CKAN Open Data Valencia para GTFS EMT | `c81b69e6-c082-44dc-acc6-66fc417b4e66` |
| `VALENCIA_EMT_GTFS_URL` | URL ZIP GTFS manual si no se usa CKAN | *(opcional)* |
| `VALENCIA_EMT_GTFS_NAP_FILE_ID` | Fichero NAP GTFS alternativo | `1166` |
| `VALENCIA_EMT_GTFS_API_KEY` | API key NAP para descargar desde transportes.gob.es | *(opcional)* |

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
| Modelado | CatBoost; LightGBM queda documentado por separado |
| Fiabilidad | Pydantic, CORS, alertas, limitaciones por zona |
| Automatización | Scripts, notebooks, `validate_artifacts.py`, CI |
| Despliegue | Vercel + HF vía GitFlow (`production`), GitHub Actions, Git LFS |
| Monitorización | Alertas MAE, pérdida de precisión y metadatos del modelo |
| Aplicación | Panel con mapas, gráficos y optimización |

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
