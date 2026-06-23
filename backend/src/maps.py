"""Provisión de GeoJSON ligero para los mapas del frontend."""

from __future__ import annotations

import math
from typing import Literal

from .coverage_data import (
    load_candidates_facilities,
    load_coverage_alpha,
    load_existing_health,
    load_existing_sports,
    load_population_hexes,
    load_population_hexes_geojson,
)
from .data_loader import (
    load_candidates_valenbisi,
    load_current_valenbisi,
    load_traffic_segments,
    load_zones_points,
)


def _hex_polygon(lat: float, lon: float, edge_m: float = 380) -> list[list[float]]:
    """Hexágono pointy-top (orientación H3 res. par) desde centroide."""
    deg_lat = 1.0 / 111_320
    deg_lon = 1.0 / (111_320 * math.cos(math.radians(lat)))
    r_lat = edge_m * deg_lat
    r_lon = edge_m * deg_lon
    coords = [
        [lon + r_lon * math.cos(math.radians(90 + 60 * i)),
         lat + r_lat * math.sin(math.radians(90 + 60 * i))]
        for i in range(6)
    ]
    coords.append(coords[0])
    return coords


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


def _population_geometry_by_hex_id() -> dict[int, dict]:
    geo = load_population_hexes_geojson()
    geometries: dict[int, dict] = {}
    for feature in geo.get("features", []):
        props = feature.get("properties", {})
        try:
            hex_id = int(props.get("hex_id"))
        except (TypeError, ValueError):
            continue
        geometry = feature.get("geometry")
        if geometry:
            geometries[hex_id] = geometry
    return geometries


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value)
    return text if text else None


def population_hexes_geojson(
    facility_type: Literal["sports", "health"] = "sports",
    include_all: bool = False,
) -> dict:
    df = load_population_hexes()
    if df.empty:
        return {"type": "FeatureCollection", "features": []}
    need_col = "need_sports" if facility_type == "sports" else "need_health"
    weight_col = "weight_sports" if facility_type == "sports" else "weight_health"
    geometries = _population_geometry_by_hex_id()
    features = []
    for _, r in df.iterrows():
        needs_coverage = bool(r.get(need_col, True)) if need_col in df.columns else True
        if not include_all and not needs_coverage:
            continue
        hid = int(r["hex_id"])
        clat, clon = float(r["centroid_lat"]), float(r["centroid_lon"])
        features.append({
            "type": "Feature",
            "geometry": geometries.get(hid) or {
                "type": "Polygon",
                "coordinates": [_hex_polygon(clat, clon)],
            },
            "properties": {
                "hex_id": hid,
                "h3": _optional_str(r["h3"]) if "h3" in r else None,
                "population": float(r["population"]),
                "needs_coverage": needs_coverage,
                "facility_type": facility_type,
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
    geometries = _population_geometry_by_hex_id()
    hex_ids: set[int] = set()
    for cid in candidate_ids:
        for hid in alpha.get("alpha", {}).get(str(cid), []):
            hex_ids.add(int(hid))
    features = []
    for _, r in pop.iterrows():
        hid = int(r["hex_id"])
        if hid not in hex_ids:
            continue
        clat, clon = float(r["centroid_lat"]), float(r["centroid_lon"])
        features.append({
            "type": "Feature",
            "geometry": geometries.get(hid) or {
                "type": "Polygon",
                "coordinates": [_hex_polygon(clat, clon)],
            },
            "properties": {
                "hex_id": hid,
                "h3": _optional_str(r["h3"]) if "h3" in r else None,
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
