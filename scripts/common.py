"""Rutas y utilidades compartidas por los scripts de generación de artefactos.

Las carpetas fuente (`samsung/`, `CURSO SMARTCITIES/`) son SOLO contexto local y no
se versionan. Estos scripts leen de ellas y escriben artefactos curados en
`backend/data/processed` y `backend/models`.
"""

from __future__ import annotations

import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SOURCE_SAMSUNG = os.getenv(
    "SOURCE_SAMSUNG", os.path.join(ROOT, "samsung", "proyecto_samsung")
)
SOURCE_SMARTCITIES = os.getenv(
    "SOURCE_SMARTCITIES", os.path.join(ROOT, "CURSO SMARTCITIES")
)

SRC_MODELS = os.path.join(SOURCE_SAMSUNG, "models_oct2023_catboost")
SRC_BASES = os.path.join(SOURCE_SAMSUNG, "BASES_DATOS")
SRC_CONTENT = os.path.join(SOURCE_SMARTCITIES, "content")

BACKEND = os.path.join(ROOT, "backend")
OUT_DATA = os.path.join(BACKEND, "data", "processed")
OUT_MODELS = os.path.join(BACKEND, "models")

CSV_IMPUTADO = os.path.join(SRC_BASES, "oct_2023_imputado.csv")
ZONAS_COORD = os.path.join(SRC_BASES, "zonas_coordenadas.csv")


def ensure_dirs() -> None:
    os.makedirs(OUT_DATA, exist_ok=True)
    os.makedirs(OUT_MODELS, exist_ok=True)
