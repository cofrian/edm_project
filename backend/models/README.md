# Modelos del backend

Esta carpeta contiene los modelos que usa la API para predecir tráfico. Hay un
modelo CatBoost por cada hora del día:

```
catboost_hour_00.cbm … catboost_hour_23.cbm
```

Archivos de apoyo usados por el modelo:

- `baseline_oct2023_SMOO.csv`: patrón base de tráfico por zona, día de la semana y hora.
- `zone_embeddings.csv`: representación numérica de cada zona.
- `ratio_prior.csv`: valores de referencia para ajustar la predicción.
- `shrink_cfg.json`: parámetros usados para suavizar ajustes extremos.

Los modelos `.cbm` pesan unos 160 MB y se versionan con **Git LFS**. Se copian
desde `samsung/proyecto_samsung/models_oct2023_catboost/` mediante
`scripts/export_models.py`.

La API carga estos modelos ya entrenados. No entrena modelos en producción.
