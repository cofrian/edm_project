"""Provisión de GeoJSON ligero para los mapas del frontend."""

from __future__ import annotations

from typing import Literal

from .coverage_data import (
    load_candidates_facilities,
    load_coverage_alpha,
    load_existing_health,
    load_existing_sports,
    load_population_hexes,
)
from .data_loader import (
    load_candidates_valenbisi,
    load_current_valenbisi,
    load_traffic_segments,
    load_zones_points,
)


def zones_points() -> dict:
    return load_zones_points()


def traffic_segments() -> dict:
    return load_traffic_segments()


def current_valenbisi() -> dict:
    return load_current_valenbisi()


def existing_sports() -> dict:
    return load_existing_sports()


def existing_health() -> dict:
    return load_existing_health()


def population_hexes_geojson(facility_type: Literal["sports", "health"] = "sports") -> dict:
    df = load_population_hexes()
    if df.empty:
        return {"type": "FeatureCollection", "features": []}
    need_col = "need_sports" if facility_type == "sports" else "need_health"
    weight_col = "weight_sports" if facility_type == "sports" else "weight_health"
    features = []
    for _, r in df.iterrows():
        if need_col in df.columns and not bool(r.get(need_col, True)):
            continue
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(r["centroid_lon"]), float(r["centroid_lat"])],
            },
            "properties": {
                "hex_id": int(r["hex_id"]),
                "population": float(r["population"]),
                "weight": float(r.get(weight_col, r["population"])),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def candidates_facilities_geojson() -> dict:
    df = load_candidates_facilities()
    if df.empty:
        return {"type": "FeatureCollection", "features": []}
    features = []
    for _, r in df.iterrows():
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [float(r["lon"]), float(r["lat"])]},
            "properties": {
                "candidate_id": int(r["candidate_id"]),
                "zona": int(r["zona"]),
                "cost_sports": float(r.get("cost_sports", 0)),
                "cost_health": float(r.get("cost_health", 0)),
                "traffic_score": float(r.get("traffic_score", 0)),
                "population_in_isochrone": float(r.get("population_in_isochrone", 0)),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def covered_hexes_geojson(candidate_ids: list[int], facility_type: Literal["sports", "health"]) -> dict:
    alpha = load_coverage_alpha()
    pop = load_population_hexes()
    if pop.empty:
        return {"type": "FeatureCollection", "features": []}
    hex_ids: set[int] = set()
    for cid in candidate_ids:
        for hid in alpha.get("alpha", {}).get(str(cid), []):
            hex_ids.add(int(hid))
    features = []
    for _, r in pop.iterrows():
        hid = int(r["hex_id"])
        if hid not in hex_ids:
            continue
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(r["centroid_lon"]), float(r["centroid_lat"])],
            },
            "properties": {
                "hex_id": hid,
                "population": float(r["population"]),
                "facility_type": facility_type,
            },
        })
    return {"type": "FeatureCollection", "features": features}


def coverage_summary() -> dict:
    alpha = load_coverage_alpha()
    pop = load_population_hexes()
    cand = load_candidates_facilities()
    return {
        "n_candidates": int(alpha.get("n_candidates", len(cand))),
        "n_hexes": int(alpha.get("n_hexes", len(pop))),
        "hexes_need_sports": int(pop["need_sports"].sum()) if not pop.empty and "need_sports" in pop.columns else 0,
        "hexes_need_health": int(pop["need_health"].sum()) if not pop.empty and "need_health" in pop.columns else 0,
    }


def candidates_valenbisi() -> list[dict]:
    df = load_candidates_valenbisi()
    if df.empty:
        return []
    cols = [c for c in ["candidate_id", "lat", "lon", "zona", "traffic_score",
                        "population_score", "valenbisi_deficit_score", "cost"]
            if c in df.columns]
    return df[cols].to_dict(orient="records")
