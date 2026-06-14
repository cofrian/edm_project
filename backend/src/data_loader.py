"""Carga de datos procesados desde DATA_DIR, con cache y fallback demo."""

from __future__ import annotations

import json
import os
from functools import lru_cache

import pandas as pd

from .config import get_settings


def _exists(name: str) -> bool:
    return os.path.exists(get_settings().path(name))


@lru_cache
def load_global_metrics() -> dict:
    s = get_settings()
    p = s.path("global_metrics_catboost.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return _fallback().get("global_metrics", {})


@lru_cache
def load_metrics_by_hour() -> pd.DataFrame:
    s = get_settings()
    p = s.path("metrics_by_hour_catboost.csv")
    if os.path.exists(p):
        return pd.read_csv(p)
    fb = _fallback().get("metrics_by_hour", [])
    return pd.DataFrame(fb)


@lru_cache
def load_validation_predictions() -> pd.DataFrame:
    s = get_settings()
    p = s.path("validation_predictions.csv")
    if os.path.exists(p):
        return pd.read_csv(p)
    return pd.DataFrame()


@lru_cache
def load_candidates_valenbisi() -> pd.DataFrame:
    s = get_settings()
    p = s.path("candidate_points_valenbisi.csv")
    if os.path.exists(p):
        return pd.read_csv(p)
    return pd.DataFrame()


@lru_cache
def load_coverage_candidates() -> pd.DataFrame:
    s = get_settings()
    p = s.path("coverage_candidates.csv")
    if os.path.exists(p):
        return pd.read_csv(p)
    return pd.DataFrame()


@lru_cache
def load_traffic_segments() -> dict:
    s = get_settings()
    p = s.path("traffic_segments_sample.geojson")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}


@lru_cache
def load_current_valenbisi() -> dict:
    s = get_settings()
    p = s.path("current_valenbisi.geojson")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}


@lru_cache
def _fallback() -> dict:
    """Datos de DEMOSTRACIÓN (no reales) para que la app no se rompa sin artefactos."""
    s = get_settings()
    p = s.path("fallback_demo_results.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {}


def models_available() -> bool:
    s = get_settings()
    return os.path.exists(os.path.join(s.model_dir, "baseline_oct2023_SMOO.csv"))
