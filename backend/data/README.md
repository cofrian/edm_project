# Datos del backend

Esta carpeta contiene los datos que usa la API.

- `processed/`: archivos preparados a partir de datos reales. Están versionados y los usa la app.
- `raw/`: datos originales usados en local. No se versionan; están ignorados en `.gitignore`.

Los archivos de `processed/` se generan con `scripts/` y `notebooks/`. Proceden de
las carpetas fuente `samsung/proyecto_samsung` y `CURSO SMARTCITIES`.

Para ver de dónde sale cada archivo, qué script lo genera y qué columnas contiene,
consulta [`docs/informe_inspeccion.md`](../../docs/informe_inspeccion.md).
