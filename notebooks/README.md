# Notebooks

Notebooks usados para preparar datos, revisar el modelo y generar archivos para
la app. Están pensados como apoyo al proyecto: explican el proceso, pero la app
desplegada usa los archivos ya preparados.

| Notebook | Contenido |
|---|---|
| `01_prepare_traffic_data.ipynb` | Lee y limpia datos de tráfico y meteorología. Rellena huecos, calcula patrones base y revisa los datos. |
| `02_train_catboost.ipynb` | Documenta el modelo CatBoost definitivo. No reentrena: carga los `.cbm` existentes, muestra validación y una predicción de ejemplo. También incluye la corrección del campo `Zona`. |
| `03_generate_evaluation_artifacts.ipynb` | Carga los modelos `.cbm`, predice los días 25-31 de octubre y exporta `validation_predictions.csv` junto con las métricas. |
| `04_prepare_optimization_data.ipynb` | Prepara datos para la optimización: población, Valenbisi, áreas de alcance y candidatos. |
| `05_optimization_valenbisi.ipynb` | Prueba la selección de un número fijo de ubicaciones para Valenbisi con PuLP. |
| `06_optimization_coverage.ipynb` | Prueba la selección de ubicaciones bajo presupuesto con PuLP. |
