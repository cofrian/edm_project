"""Provisión de GeoJSON y datos espaciales para los mapas del frontend."""

from __future__ import annotations

from typing import Literal

import pandas as pd

from .coverage_data import load_candidates_facilities, load_coverage_alpha, load_population_hexes
from .data_loader import load_candidates_valenbisi, load_current_valenbisi, load_traffic_segments


def traffic_segments() -> dict:
    return load_traffic_segments()


def current_valenbisi() -> dict:
    return load_current_valenbisi()


def candidates_valenbisi() -> list[dict]:
    df = load_candidates_valenbisi()
    if df.empty:
        return []
    cols = [
        c
        for c in [
            "candidate_id",
            "lat",
            "lon",
            "zona",
            "traffic_score",
            "population_score",
            "valenbisi_deficit_score",
            "cost",
        ]
        if c in df.columns
    ]
    return df[cols].to_dict(orient="records")


def candidates_facilities_geojson() -> dict:
    df = load_candidates_facilities()
    if df.empty:
        return {"type": "FeatureCollection", "features": []}
    features = []
    for _, row in df.iterrows():
        props = {
            k: (None if pd.isna(v) else (float(v) if isinstance(v, (int, float)) else v))
            for k, v in row.items()
            if k not in ("lat", "lon")
        }
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(row["lon"]), float(row["lat"])]},
                "properties": props,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def population_hexes_geojson(facility_type: Literal["sports", "health"] = "sports") -> dict:
    df = load_population_hexes()
    if df.empty:
        return {"type": "FeatureCollection", "features": []}

    weight_col = "weight_sports" if facility_type == "sports" else "weight_health"
    need_col = "need_sports" if facility_type == "sports" else "need_health"
    if weight_col not in df.columns:
        return {"type": "FeatureCollection", "features": []}

    subset = df[df[weight_col] > 0].copy()
    features = []
    for _, row in subset.iterrows():
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["centroid_lon"]), float(row["centroid_lat"])],
                },
                "properties": {
                    "hex_id": int(row["hex_id"]),
                    "population": float(row["population"]),
                    "weight": float(row[weight_col]),
                    "need": bool(row.get(need_col, True)),
                    "facility_type": facility_type,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def covered_hexes_geojson(
    candidate_ids: list[int],
    facility_type: Literal["sports", "health"] = "sports",
) -> dict:
    alpha_data = load_coverage_alpha()
    hex_df = load_population_hexes()
    if not alpha_data.get("alpha") or hex_df.empty or not candidate_ids:
        return {"type": "FeatureCollection", "features": []}

    alpha = alpha_data["alpha"]
    weight_col = "weight_sports" if facility_type == "sports" else "weight_health"

    covered_hex_ids: set[int] = set()
    for cid in candidate_ids:
        key = str(cid)
        if key in alpha:
            covered_hex_ids.update(int(h) for h in alpha[key])

    hex_df = hex_df.set_index("hex_id")
    features = []
    for hid in covered_hex_ids:
        if hid not in hex_df.index:
            continue
        row = hex_df.loc[hid]
        weight = float(row.get(weight_col, 0) or 0)
        if weight <= 0:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [float(row["centroid_lon"]), float(row["centroid_lat"])],
                },
                "properties": {
                    "hex_id": int(hid),
                    "population": float(row["population"]),
                    "weight": weight,
                    "newly_covered": True,
                    "facility_type": facility_type,
                },
            }
        )
    return {"type": "FeatureCollection", "features": features}


def coverage_summary() -> dict:
    hex_df = load_population_hexes()
    cand = load_candidates_facilities()
    alpha = load_coverage_alpha()
    valenbisi = load_candidates_valenbisi()

    sports_need = int(hex_df["weight_sports"].gt(0).sum()) if not hex_df.empty else 0
    health_need = int(hex_df["weight_health"].gt(0).sum()) if not hex_df.empty else 0
    sports_pop = float(hex_df["weight_sports"].sum()) if not hex_df.empty else 0.0
    health_pop = float(hex_df["weight_health"].sum()) if not hex_df.empty else 0.0

    return {
        "n_candidates": len(cand),
        "n_valenbisi_candidates": len(valenbisi),
        "n_hexes": len(hex_df),
        "hexes_need_sports": sports_need,
        "hexes_need_health": health_need,
        "population_need_sports": round(sports_pop, 0),
        "population_need_health": round(health_pop, 0),
        "n_alpha_candidates": alpha.get("n_candidates", 0),
    }
