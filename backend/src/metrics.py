"""Métricas globales y por hora del modelo CatBoost (datos reales)."""

from __future__ import annotations

import math

from .data_loader import load_global_metrics, load_metrics_by_hour


def global_metrics() -> dict:
    g = load_global_metrics()
    if g:
        return g
    # derivar de por-hora si no existe el json
    m = load_metrics_by_hour()
    if m.empty:
        return {}
    return {
        "MAE": round(float(m["MAE"].mean()), 2),
        "RMSE": round(float(m["RMSE"].mean()), 2),
        "R2": round(float(m["R2"].mean()), 3),
        "sMAPE": round(float(m["sMAPE"].mean()), 2),
        "validation": "holdout temporal días 25-31 oct",
    }


def metrics_by_hour() -> list[dict]:
    m = load_metrics_by_hour()
    if m.empty:
        return []
    records = m.to_dict(orient="records")
    # limpia NaN para JSON válido
    for r in records:
        for k, v in r.items():
            if isinstance(v, float) and math.isnan(v):
                r[k] = None
    return records


def metrics_for_hour(hora: int) -> dict | None:
    for row in metrics_by_hour():
        if int(row.get("Hora", -1)) == hora:
            return row
    return None
