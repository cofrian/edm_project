# Informe de inspección — UrbanFlow Valencia (EDM)

> Documento de Fase 1. Inventario de lo que existe en las carpetas fuente
> (`samsung/proyecto_samsung` y `CURSO SMARTCITIES`) **antes** de construir la app.
> Regla rectora: no inventar datos ni métricas. Todo lo de aquí está verificado en disco.

Fecha de inspección: 2026-06-14
Autor de la entrega: Sergio Ortiz (`scofrian@gmail.com`)

---

## 1. Estructura encontrada en `samsung/proyecto_samsung`

```
samsung/proyecto_samsung/
├── BASES_DATOS/
│   ├── oct_2023_completo.csv         # tráfico+meteo octubre 2023 (crudo)
│   ├── oct_2023_imputado.csv         # igual, con imputación de huecos
│   ├── zonas_coordenadas.csv         # zona -> lat/lon (KEY)
│   ├── geo_data.csv                  # calle -> lat/lon -> zona
│   ├── calles_valencia.geojson       # geometría de calles
│   ├── df_connections.csv            # conexiones entre calles
│   └── grafo_conexiones_calles.gexf  # grafo de calles
├── models_oct2023_catboost/          # MODELO DEFINITIVO (CatBoost)
│   ├── cat_hour_00.cbm … cat_hour_23.cbm   # 24 modelos entrenados (160,1 MB)
│   ├── baseline_oct2023_SMOO.csv     # baseline suavizado por Zona×DOW×Hora
│   ├── zone_embeddings.csv           # embeddings PCA de zona (z_emb1..5)
│   ├── ratio_prior.csv               # prior de ratios Zona×DOW×Hora
│   ├── shrink_cfg.json               # {"tau":48.0,"s":16.0}
│   └── metrics_by_hour_cat_raw.csv   # MÉTRICAS REALES CatBoost (holdout)
├── models_oct2023_opt/               # LightGBM "optimizado" (NO usar como final)
│   ├── lgb_opt_hour_00.txt … 23.txt
│   ├── metrics_by_hour_holdout_opt.csv
│   ├── metrics_by_hour_trainvalid.csv
│   └── baseline_oct2023_KEYS_Zona_DOW_Hora.csv
├── models_oct2023_no_lag/            # LightGBM base (NO usar como final)
│   ├── lgb_hour_0.txt … 23.txt
│   ├── metrics_by_hour.csv
│   ├── metrics_by_hour_holdout.csv
│   └── baseline_oct2023.csv
├── CLASES_UTILES/
│   ├── Mongo_Conection.py            # ⚠️ credenciales MongoDB hardcodeadas
│   └── MAPA_HTML.py
├── NOTICIAS/                          # scraping de noticias (fuera de alcance)
├── PRUEBAS_CODIGO/                    # experimentos sueltos
├── PROYECTO FINAL AION/               # copia casi-duplicada del proyecto
│   └── BASES_DATOS/ con predicciones_2025-10-*.json y clasificacion_intensidad_*.csv
├── traffic_pred.ipynb                # notebook principal de modelado de tráfico
├── categoria_intensidad.ipynb        # clasificación baja/media/alta (reglas v/c)
├── meteo_traffic_merge.ipynb         # cruce meteo + tráfico
├── clustering_intensidad.ipynb
├── visualizacion_trafico_valencia.ipynb
├── dashboard.py / prueba_st.py       # dashboards Streamlit (no se reutilizan)
└── README.md
```

---

## 2. Estructura encontrada en `CURSO SMARTCITIES`

```
CURSO SMARTCITIES/
├── optimizacion (1).ipynb            # cobertura "15-min city" con OR-Tools
├── OptimizaciónValenbisi_CátedraENIA2025.ipynb  # Valenbisi con PuLP + genético
├── content/
│   ├── localizaciones2.csv           # 131 candidatos (POINT + isócrona + cost1/cost2)
│   ├── centros-deportivo-valencia.csv# 18 instalaciones existentes + isócrona
│   └── (population_spain.gpkg)        # NO presente: se descarga por wget
└── cache/                            # caché de descargas (1 json)
```

---

## 3. Notebooks útiles y para qué

| Notebook | Útil para | Observaciones |
|---|---|---|
| `traffic_pred.ipynb` | Modelo definitivo CatBoost (bloque "MODELO C") | Contiene entrenamiento, validación y predicción. La validación con shrink **petó** por el bug de `Zona`. |
| `categoria_intensidad.ipynb` | Reglas baja/media/alta | Clasificación **basada en reglas** (ratio v/c con umbrales 0.30 / 0.60), NO clasificador entrenado. |
| `meteo_traffic_merge.ipynb` | Origen de `oct_2023_*.csv` | Cruce meteo + tráfico. |
| `optimizacion (1).ipynb` | Formulación cobertura urbana (Modo B) | Usa OR-Tools + isócronas + población. Se reimplementa con PuLP. |
| `OptimizaciónValenbisi_CátedraENIA2025.ipynb` | Formulación Valenbisi (Modo A) | Usa PuLP + algoritmo genético (DEAP). Datos desde Google Drive. |

---

## 4. Datasets reales existentes (verificado)

| Archivo | Filas (incl. cabecera) | Sep | Columnas clave |
|---|---|---|---|
| `BASES_DATOS/oct_2023_completo.csv` | 853 369 | `;` | Año;Mes;Dia;Hora;Dia_Semana;Zona;Intensidad;Velocidad;Ocupacion;temp_c;hum_rel_%;pres_mb;vel_viento_ms;vel_viento_max_ms;dir_viento_grados;rad_wm2;precip_lm2 |
| `BASES_DATOS/oct_2023_imputado.csv` | 853 369 | `;` | Igual que completo, con huecos imputados |
| `BASES_DATOS/zonas_coordenadas.csv` | 1 159 | `,` | Descripcion,Lat,Lon,KEY,Descripcion |
| `BASES_DATOS/geo_data.csv` | 1 148 | `,` | Nombre_Calle,Lat,Lon,Zona |
| `content/localizaciones2.csv` | 132 | `;` | geometry;isochrone;cost1;cost2 |
| `content/centros-deportivo-valencia.csv` | 19 | `;` | geometry;name;isochrone |
| `PROYECTO FINAL AION/.../predicciones_2025-10-16..19.json` | — | — | Predicciones CatBoost precalculadas por zona/hora |
| `PROYECTO FINAL AION/.../clasificacion_intensidad_Zona_*.csv` | — | `,` | Zona,nombre_via,fecha_hora,Hora,Intensidad_pred,…,categoria_dir,categoria_total |

Datos **NO presentes en local** (se descargaban desde URLs externas en los notebooks):
- `population_spain.gpkg` (capa de población hexagonal) → `wget` desde gitlab `drvicsana/catedra_enia`.
- `population_valencia.json`, `valenbisi-disponibilitat.geojson`, tráfico/tweets → Google Drive (notebook Valenbisi).

Decisión tomada con el usuario: se permite **una descarga única** desde esas mismas URLs ya documentadas en los notebooks; se tratan como datos del proyecto y se documenta su origen.

---

## 5. Modelos existentes

| Familia | Ubicación | Estado |
|---|---|---|
| **CatBoost por hora (DEFINITIVO)** | `models_oct2023_catboost/cat_hour_00..23.cbm` | **24 modelos presentes, 160,1 MB total.** Reutilizables sin reentrenar. |
| LightGBM "opt" | `models_oct2023_opt/lgb_opt_hour_*.txt` | Presentes. Métricas propias (peores). NO es el modelo final. |
| LightGBM "no_lag" | `models_oct2023_no_lag/lgb_hour_*.txt` | Presentes. Métricas propias (peores). NO es el modelo final. |

Artefactos de apoyo del pipeline CatBoost (presentes):
`baseline_oct2023_SMOO.csv`, `zone_embeddings.csv`, `ratio_prior.csv`, `shrink_cfg.json`.

### 5.1 Arquitectura del modelo definitivo (verificada en el notebook)

Modelo híbrido por hora:

```
Intensidad_{z,t} = baseline_{z,dow,h}  +  f_CatBoost(meteo, hora, día, z_emb)  +  ε
```

- `baseline` suavizado por Zona×DíaSemana×Hora (`baseline_oct2023_SMOO.csv`).
- `f_CatBoost`: 24 `CatBoostRegressor` (uno por hora) que aprenden el **residuo log-ratio** sobre el baseline.
- `z_emb`: embeddings PCA de zona (5 componentes).
- `shrink` sigmoidal con `tau=48, s=16` para regularizar zonas/franjas de baja intensidad.
- Features: `Zona, Mes, Dia_Semana, temp_c, hum_rel_%, pres_mb, …` + embeddings; categóricas: `Zona, Dia_Semana, tipo_dia`.

Importante para la app: el modelo **no predice intensidad directa**, predice un residuo sobre baseline; por tanto `/predict` reconstruye `intensidad = baseline · exp(residuo)`.

---

## 6. Métricas válidas (CatBoost) — holdout temporal 25–31 oct 2023

Fuente real: `models_oct2023_catboost/metrics_by_hour_cat_raw.csv` (sin shrink).

Globales (media sobre las 24 horas):

| Métrica | Valor |
|---|---|
| MAE | ≈ 44.38 veh/h |
| RMSE | ≈ 87.80 |
| R² | ≈ 0.920 |
| sMAPE | ≈ 16.79 % |

Por hora (extracto real):

| Hora | MAE | RMSE | R² | sMAPE |
|---|---|---|---|---|
| 07 | 52.47 | 101.72 | 0.977 | 13.19 |
| 08 | 109.71 | 187.39 | 0.933 | 20.94 |
| 14 | 49.08 | 86.80 | 0.983 | 10.04 |
| 18 | 48.96 | 91.03 | 0.982 | 9.91 |
| 23 | 43.94 | 84.13 | 0.836 | 26.21 |

Validación = **temporal** (train días 1–24, holdout 25–31 oct). No split aleatorio.

---

## 7. Qué métricas pertenecen a CatBoost vs otros modelos

- **CatBoost (final):** `models_oct2023_catboost/metrics_by_hour_cat_raw.csv` → las de la sección 6.
- **LightGBM no_lag:** `models_oct2023_no_lag/metrics_by_hour_holdout.csv` (p. ej. hora 07 MAE≈196.9, R²≈0.64) — claramente peor.
- **LightGBM opt:** `models_oct2023_opt/metrics_by_hour_holdout_opt.csv` (p. ej. hora 07 MAE≈178.4, R²≈0.65) — peor que CatBoost.

**Regla:** la app y la documentación usan únicamente las métricas CatBoost. Las de LightGBM solo pueden citarse como comparación/baseline, nunca mezcladas en la tabla principal.

---

## 8. Errores a corregir

1. **Bug `Zona` (object vs int64).** `validate_on_holdout_cat` en `traffic_pred.ipynb` falla al hacer `merge` por `Zona` con tipos mezclados (`You are trying to merge on object and int64 columns for key 'Zona'`). Por eso nunca se guardaron las predicciones fila a fila. **Fix:** forzar `Zona` a un único tipo (`int`) en todo el pipeline antes de cualquier merge.
2. **Validación con shrink incompleta.** Solo se guardaron las métricas no-shrink. Se re-predice el holdout cargando los `.cbm` para exportar `validation_predictions.csv`.
3. **Credenciales en código.** `CLASES_UTILES/Mongo_Conection.py` contiene usuario/contraseña de MongoDB Atlas. No se migra al repo nuevo.

---

## 9. Rutas absolutas / dependencias externas a eliminar

- Notebooks de optimización usan rutas Colab `"/content/…"` → reescribir a rutas relativas/parametrizadas.
- `optimizacion (1).ipynb` usa `!wget https://gitlab.com/.../population_spain.gpkg` y CSV → documentar como descarga única.
- Notebook Valenbisi usa `gdown` con IDs de Google Drive → documentar como descarga única.
- `traffic_pred.ipynb` usa rutas relativas `BASES_DATOS/…` (correcto), no requiere cambios de ruta.
- Eliminar cualquier referencia a MongoDB Atlas y secretos.

---

## 10. Datos usables para la app

- Tráfico/meteo: `oct_2023_imputado.csv` (entrenamiento/validación y baseline).
- Geo: `zonas_coordenadas.csv` (zona→lat/lon), `calles_valencia.geojson` (muestra ligera para mapa).
- Modelo: 24 `.cbm` + `baseline_oct2023_SMOO.csv` + `zone_embeddings.csv` + `shrink_cfg.json`.
- Métricas: `metrics_by_hour_cat_raw.csv`.
- Optimización: `localizaciones2.csv` (candidatos + isócrona + coste), `centros-deportivo-valencia.csv` (existentes), población re-descargada.
- Predicciones precalculadas (apoyo/fallback): `predicciones_2025-10-*.json`.

---

## 11. Artefactos a generar (sin inventar datos)

| Archivo final | Origen real | Generado por | Columnas | Filas aprox. | Tipo |
|---|---|---|---|---|---|
| `backend/data/processed/traffic_hourly_oct2023.parquet` | `oct_2023_imputado.csv` | `01_prepare_traffic_data.ipynb` | Zona,Año,Mes,Dia,Hora,Dia_Semana,Intensidad,Velocidad,Ocupacion,temp_c,hum_rel_%,pres_mb,… | 853 368 | Derivado |
| `backend/models/catboost_hour_HH.cbm` ×24 | `models_oct2023_catboost/cat_hour_*.cbm` | `scripts/export_models.py` (copia) | binario CatBoost | — | Original |
| `backend/data/processed/metrics_by_hour_catboost.csv` | `metrics_by_hour_cat_raw.csv` | `scripts/generate_metrics.py` | Hora,MAE,RMSE,R2,sMAPE | 24 | Original |
| `backend/data/processed/global_metrics_catboost.json` | idem (media) | `scripts/generate_metrics.py` | MAE,RMSE,R2,sMAPE,validation | — | Derivado |
| `backend/data/processed/validation_predictions.csv` | `.cbm` + `oct_2023_imputado.csv` | `03_generate_evaluation_artifacts.ipynb` | Zona,Dia,Hora,Dia_Semana,y_real,baseline,y_pred,abs_error,nivel_real,nivel_pred | ~265k | Derivado |
| `backend/data/processed/candidate_points_valenbisi.csv` | zonas + tráfico + población + `localizaciones2.csv` | `scripts/generate_candidates.py` | candidate_id,lat,lon,zona,traffic_score,population_score,valenbisi_deficit_score,cost | 131 | Derivado |
| `backend/data/processed/coverage_candidates.csv` | `localizaciones2.csv` + población | `scripts/generate_candidates.py` | candidate_id,lat,lon,zona,population_covered,traffic_pressure,coverage_deficit,cost | 131 | Derivado |
| `backend/data/processed/traffic_segments_sample.geojson` | `calles_valencia.geojson` | `scripts/generate_candidates.py` | geometry,Zona,intensidad | muestra | Derivado |
| `backend/data/processed/current_valenbisi.geojson` | capa Valenbisi re-descargada | `04_prepare_optimization_data.ipynb` | geometry,name | — | Original ext. |
| `backend/data/processed/fallback_demo_results.json` | resultados precalculados | `scripts/generate_candidates.py` | demo de predicción/optimización | — | **Demo** |

> Si alguno no se puede generar con datos reales, no se inventa: se documenta la limitación y solo se crea `fallback_demo_results.json` claramente etiquetado como demo.

---

## 12. Partes de optimización reutilizables

- **Modo A (Valenbisi):** selección binaria de N ubicaciones maximizando `α·tráfico + β·población + γ·déficit`. Reformulado con **PuLP** (estable y rápido). El algoritmo genético del notebook queda como análisis secundario opcional.
- **Modo B (Cobertura urbana):** selección bajo presupuesto maximizando `α·población_cubierta + β·presión_tráfico + γ·déficit_cobertura` con `Σ coste·x ≤ presupuesto`. Reimplementado con **PuLP** (el notebook original usa OR-Tools). Las isócronas y `cost1` de `localizaciones2.csv` son datos reales reutilizables.
- **Conexión con CatBoost:** la presión de tráfico de cada candidato proviene de la predicción CatBoost agregada por zona/hora. Esa es la narrativa única.

---

## 13. Riesgos técnicos

| Riesgo | Mitigación |
|---|---|
| Bug de tipos en `Zona` rompe merges | Forzar `Zona` a `int` en todo el pipeline (`fix/zona-dtype-merge`). |
| Modelos `.cbm` 160 MB | Git LFS; backend los monta; HF Spaces los admite. |
| Datos de población/Valenbisi no locales | Descarga única documentada desde URLs de los notebooks; fallback demo etiquetado si falla. |
| Credenciales Mongo en fuente | `samsung/` y `CURSO SMARTCITIES/` se ignoran en git; nunca se commitean. |
| GeoJSON de calles pesado | Subir solo una muestra ligera (`traffic_segments_sample.geojson`). |
| Shell Windows sin sandbox | Ejecutar comandos sin sandbox (resuelto). |

---

## 14. Plan de implementación por fases

1. **Fase 1 — Inspección (este documento).**
2. **Fase 2 — Artefactos reales:** copiar `.cbm` (LFS), exportar métricas y `validation_predictions.csv` (con fix `Zona`), generar candidatos y geo.
3. **Fase 3 — Backend FastAPI:** endpoints, Pydantic, PuLP, Docker, tests.
4. **Fase 4 — Frontend Next.js:** páginas, gráficos, mapas, fallback.
5. **Fase 5 — Optimización integrada:** Modo A + Modo B en una sola página.
6. **Fase 6 — Evaluación y monitorización:** páginas y endpoints.
7. **Fase 7 — CI/CD y documentación:** workflows, docs EDM, README, ramas.

Estrategia Git: `feature/* → develop → main → production`, una rama + PR por feature, commits a nombre de Sergio Ortiz.

---

## 15. Conclusión de la inspección

El modelo definitivo de tráfico es **CatBoost por hora** (híbrido baseline + residuo log-ratio + shrink + embeddings), con métricas reales en holdout temporal (MAE≈44.4, R²≈0.92). Los 24 modelos entrenados existen y se reutilizan sin reentrenar. Los datos de tráfico, geometría y candidatos de optimización son reales y suficientes; la población/Valenbisi se obtienen de las fuentes ya referenciadas en los notebooks. Los únicos arreglos imprescindibles son el tipo de `Zona` y la exclusión de secretos. Con esto, la entrega puede construirse de forma reproducible y sin inventar datos.
