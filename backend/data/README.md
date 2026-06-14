# backend/data

- `processed/`: artefactos derivados de datos reales (versionados). Generados por `scripts/` y `notebooks/`.
- `raw/`: datos crudos locales (NO versionados; ver `.gitignore`).

Todos los artefactos de `processed/` provienen de las carpetas fuente
(`samsung/proyecto_samsung`, `CURSO SMARTCITIES`). Ver `docs/informe_inspeccion.md`
para la trazabilidad (archivo → origen → generador → columnas → filas).
