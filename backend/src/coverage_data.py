"""Carga de artefactos de cobertura poblacional (notebook SMARTCITIES)."""

from __future__ import annotations

import json
import os
from functools import lru_cache

import pandas as pd

from .config import get_settings


@lru_cache
def load_population_hexes() -> pd.DataFrame:
    p = get_settings().path("population_hexes.csv")
    if os.path.exists(p):
        return pd.read_csv(p)
    return pd.DataFrame()


@lru_cache
def load_population_hexes_geojson() -> dict:
    p = get_settings().path("population_hexes.geojson")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}


@lru_cache
def load_coverage_alpha() -> dict:
    p = get_settings().path("coverage_alpha.json")
    if not os.path.exists(p):
        return {"n_candidates": 0, "n_hexes": 0, "alpha": {}}
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def load_candidates_facilities() -> pd.DataFrame:
    p = get_settings().path("candidates_facilities.csv")
    if os.path.exists(p):
        return pd.read_csv(p)
    return pd.DataFrame()


@lru_cache
def load_existing_sports() -> dict:
    p = get_settings().path("existing_sports.geojson")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}


@lru_cache
def load_existing_health() -> dict:
    p = get_settings().path("existing_health.geojson")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return {"type": "FeatureCollection", "features": []}


def coverage_data_available() -> bool:
    s = get_settings()
    return os.path.exists(s.path("population_hexes.csv")) and os.path.exists(
        s.path("coverage_alpha.json")
    )
