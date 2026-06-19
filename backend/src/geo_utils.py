"""Utilidades geográficas ligeras (sin dependencias GIS)."""

from __future__ import annotations

import math
from typing import Any


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def line_centroid(coords: list[list[float]]) -> tuple[float, float]:
    if not coords:
        return 0.0, 0.0
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return sum(lats) / len(lats), sum(lons) / len(lons)


def point_to_linestring_m(lat: float, lon: float, coords: list[list[float]]) -> float:
    """Distancia mínima aproximada (m) de un punto a una LineString."""
    if len(coords) < 2:
        if coords:
            return haversine_m(lat, lon, coords[0][1], coords[0][0])
        return float("inf")
    best = float("inf")
    for i in range(len(coords) - 1):
        lon1, lat1 = coords[i][0], coords[i][1]
        lon2, lat2 = coords[i + 1][0], coords[i + 1][1]
        for t in (0.0, 0.25, 0.5, 0.75, 1.0):
            plat = lat1 + t * (lat2 - lat1)
            plon = lon1 + t * (lon2 - lon1)
            best = min(best, haversine_m(lat, lon, plat, plon))
    return best


def geometry_coords(geometry: dict[str, Any] | None) -> list[list[float]]:
    if not geometry:
        return []
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if gtype == "LineString" and isinstance(coords, list):
        return coords
    return []
