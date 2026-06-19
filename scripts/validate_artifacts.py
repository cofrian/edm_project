"""Valida los artefactos generados: existencia, columnas, NaNs críticos y tipos.

Cubre el bloque EDM de automatización (T4). Devuelve código != 0 si algo falla.
"""

from __future__ import annotations

import json
import os
import sys

import pandas as pd

from common import OUT_DATA, OUT_MODELS

REQUIRED_CSV = {
    "metrics_by_hour_catboost.csv": ["Hora", "MAE", "RMSE", "R2", "sMAPE"],
    "candidate_points_valenbisi.csv": [
        "candidate_id", "lat", "lon", "zona", "traffic_score",
        "population_score", "valenbisi_deficit_score", "cost",
    ],
    "coverage_candidates.csv": [
        "candidate_id", "lat", "lon", "zona", "population_covered",
        "traffic_pressure", "coverage_deficit", "cost",
    ],
}
REQUIRED_JSON = ["global_metrics_catboost.json", "fallback_demo_results.json"]


def main() -> int:
    errors: list[str] = []

    for name, cols in REQUIRED_CSV.items():
        path = os.path.join(OUT_DATA, name)
        if not os.path.exists(path):
            errors.append(f"FALTA {name}")
            continue
        df = pd.read_csv(path)
        missing = [c for c in cols if c not in df.columns]
        if missing:
            errors.append(f"{name}: faltan columnas {missing}")
        if df.empty:
            errors.append(f"{name}: está vacío")
        if name == "metrics_by_hour_catboost.csv" and df["MAE"].isna().any():
            errors.append(f"{name}: hay NaN en MAE")

    for name in REQUIRED_JSON:
        path = os.path.join(OUT_DATA, name)
        if not os.path.exists(path):
            errors.append(f"FALTA {name}")
            continue
        with open(path, "r", encoding="utf-8") as f:
            json.load(f)

    g = os.path.join(OUT_DATA, "global_metrics_catboost.json")
    if os.path.exists(g):
        with open(g, "r", encoding="utf-8") as f:
            gm = json.load(f)
        for k in ["MAE", "RMSE", "R2", "sMAPE"]:
            if k not in gm:
                errors.append(f"global_metrics_catboost.json: falta {k}")

    n_cbm = len([x for x in os.listdir(OUT_MODELS)
                 if x.startswith("catboost_hour_") and x.endswith(".cbm")]) \
        if os.path.isdir(OUT_MODELS) else 0
    if n_cbm < 24:
        errors.append(f"Modelos: solo {n_cbm}/24 .cbm en {OUT_MODELS}")

    if errors:
        print("VALIDACIÓN FALLIDA:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("VALIDACIÓN OK: todos los artefactos presentes y con columnas correctas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
