# backend/models

Modelos CatBoost por hora (uno por cada hora del día):

```
catboost_hour_00.cbm … catboost_hour_23.cbm
```

Artefactos de apoyo del pipeline:

- `baseline_oct2023_SMOO.csv` — baseline suavizado por Zona×DíaSemana×Hora.
- `zone_embeddings.csv` — embeddings PCA de zona.
- `ratio_prior.csv` — prior de ratios.
- `shrink_cfg.json` — parámetros de shrink (`tau`, `s`).

Los `.cbm` se versionan con **Git LFS** (160 MB). Se copian desde
`samsung/proyecto_samsung/models_oct2023_catboost/` mediante `scripts/export_models.py`.
No se reentrena en producción.
