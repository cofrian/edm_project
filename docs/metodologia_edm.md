# Metodología EDM — UrbanFlow Valencia

Cobertura de CRISP-DM y del temario de Evaluación, Despliegue y Monitorización.

## Mapa Bloque EDM → Implementación

| Bloque EDM | Implementación en UrbanFlow Valencia |
|---|---|
| Business Understanding | Problema de movilidad urbana: predecir presión de tráfico y priorizar actuaciones de movilidad sostenible. |
| Data Understanding | EDA de tráfico, meteorología y geometría de zonas (octubre 2023, ~853k registros). |
| Data Preparation | Limpieza, imputación, baseline suavizado, features de calendario y lags; fix de tipo de `Zona`. |
| Modeling | CatBoost por hora (baseline + residuo log-ratio + shrink + embeddings de zona). |
| Evaluation | MAE, RMSE, R², sMAPE en validación temporal; análisis de errores por hora/zona. |
| Deployment | Vercel (frontend) + FastAPI Docker en Hugging Face Spaces (backend). |
| Monitoring | Alertas de MAE por hora/zona, fecha de datos, modelo activo, drift. |
| ModelOps | CI/CD (GitHub Actions), ramas `feature→develop→main→production`, Git LFS, validación de artefactos → [`docs/metodologia-equipo.md`](metodologia-equipo.md). |
| Aplicación | Dashboard web con predicción, mapas y optimización bajo demanda. |

## Temario

- **T1 — Evaluación**: validación temporal, métricas de regresión, análisis de error, comparación con baseline → página `/evaluacion`.
- **T2 — Ensembles/boosting**: CatBoost como modelo de boosting; comparación documentada frente a LightGBM (sin mezclar métricas) → `docs/modelo_predictivo.md`.
- **T3 — Modelos fiables**: importancia de variables, limitaciones, sesgos por zona/fecha, validación de payloads (Pydantic), CORS.
- **T4 — Automatización**: scripts reproducibles, pipeline notebooks→artefactos, `scripts/validate_artifacts.py`, CI.
- **T5 — Despliegue/ModelOps**: Docker, GitHub Actions, versionado de modelos (LFS), `.env.example` → `docs/despliegue.md`.
- **T6 — Monitorización**: error por hora/zona, alertas de MAE, drift → `/monitorizacion`.
- **T7 — Aplicaciones**: dashboard interactivo con mapas, formularios y optimización.
