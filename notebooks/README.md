# notebooks

Pipeline reproducible, explicado y comentado:

| Notebook | Contenido |
|---|---|
| `01_prepare_traffic_data.ipynb` | Lectura/limpieza/imputación de tráfico+meteo, baseline suavizado, EDA. |
| `02_train_catboost.ipynb` | **Modelo definitivo**: reproduce el código y la conclusión del entrenamiento original (CatBoost + baseline + shrink + embeddings). NO reentrena: carga los `.cbm` existentes y muestra validación + predicción de ejemplo. Incluye el fix del bug `Zona`. |
| `03_generate_evaluation_artifacts.ipynb` | Carga `.cbm`, re-predice holdout 25–31 oct, exporta `validation_predictions.csv` y métricas. |
| `04_prepare_optimization_data.ipynb` | Datos de optimización (población, valenbisi, isócronas) y candidatos. |
| `05_optimization_valenbisi.ipynb` | Modo A — selección de N ubicaciones (PuLP). |
| `06_optimization_coverage.ipynb` | Modo B — cobertura bajo presupuesto (PuLP). |
| `07_coverage_facilities_ilp.ipynb` | ILP deporte/salud/mixto — ejecuta `generate_coverage_artifacts.py` y valida artefactos censales. |
