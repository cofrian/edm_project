"""Provisión de GeoJSON ligero para los mapas del frontend."""

from __future__ import annotations

from .data_loader import load_candidates_valenbisi, load_current_valenbisi, load_traffic_segments


def traffic_segments() -> dict:
    return load_traffic_segments()


def current_valenbisi() -> dict:
    return load_current_valenbisi()


def candidates_valenbisi() -> list[dict]:
    df = load_candidates_valenbisi()
    if df.empty:
        return []
    cols = [c for c in ["candidate_id", "lat", "lon", "zona", "traffic_score",
                        "population_score", "valenbisi_deficit_score", "cost"]
            if c in df.columns]
    return df[cols].to_dict(orient="records")
