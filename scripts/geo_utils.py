"""Utilidades geométricas ligeras (sin shapely): parseo WKT, área y point-in-polygon."""

from __future__ import annotations

import math
import re
from typing import List, Tuple

Point = Tuple[float, float]  # (lon, lat)


def parse_wkt_point(wkt: str) -> Point | None:
    m = re.search(r"POINT\s*\(([^)]+)\)", str(wkt))
    if not m:
        return None
    lon, lat = (float(v) for v in m.group(1).split())
    return (lon, lat)


def parse_wkt_polygon(wkt: str) -> List[Point]:
    """Devuelve el anillo exterior de un POLYGON WKT como lista de (lon, lat)."""
    m = re.search(r"POLYGON\s*\(\(([^)]+)\)\)", str(wkt))
    if not m:
        return []
    ring = []
    for pair in m.group(1).split(","):
        parts = pair.strip().split()
        if len(parts) >= 2:
            ring.append((float(parts[0]), float(parts[1])))
    return ring


def polygon_area_km2(ring: List[Point]) -> float:
    """Área aproximada del polígono (proyección equirectángular local)."""
    if len(ring) < 3:
        return 0.0
    lat0 = sum(p[1] for p in ring) / len(ring)
    kx = 111.320 * math.cos(math.radians(lat0))  # km por grado lon
    ky = 110.574  # km por grado lat
    pts = [(p[0] * kx, p[1] * ky) for p in ring]
    area = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        area += x1 * y2 - x2 * y1
    return abs(area) / 2.0


def point_in_polygon(pt: Point, ring: List[Point]) -> bool:
    """Ray casting."""
    if len(ring) < 3:
        return False
    x, y = pt
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
