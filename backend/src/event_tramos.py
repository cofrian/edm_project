"""Tramos de vía afectados por eventos urbanos (distancia a LineString)."""

from __future__ import annotations

from typing import Any

from .geo_utils import geometry_coords, point_to_linestring_m


def tramos_affected_by_event(
    tramo_features: list[dict[str, Any]],
    lat: float,
    lon: float,
    radio_metros: float,
) -> list[str]:
    """IDs de tramos cuya geometría está dentro del radio del evento."""
    affected: list[str] = []
    for feat in tramo_features:
        props = feat.get("properties") or {}
        tid = str(props.get("idtramo", ""))
        coords = geometry_coords(feat.get("geometry"))
        if not coords or not tid:
            continue
        if point_to_linestring_m(lat, lon, coords) <= radio_metros:
            affected.append(tid)
    return affected


def tramos_affected_by_events(
    tramo_features: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> list[str]:
    """Unión de tramos afectados por varios eventos."""
    seen: set[str] = set()
    out: list[str] = []
    for ev in events:
        try:
            lat = float(ev["lat"])
            lon = float(ev["lon"])
            radio = float(ev.get("radio_metros", 300))
        except (KeyError, TypeError, ValueError):
            continue
        for tid in tramos_affected_by_event(tramo_features, lat, lon, radio):
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
    return out
