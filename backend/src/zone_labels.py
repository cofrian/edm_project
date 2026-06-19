"""Etiquetas legibles de zonas (calles / sensores)."""

from __future__ import annotations

from functools import lru_cache

from .data_loader import load_zones_points


@lru_cache
def zone_label_map() -> dict[int, str]:
    gj = load_zones_points()
    out: dict[int, str] = {}
    for feat in gj.get("features", []):
        props = feat.get("properties") or {}
        try:
            zona = int(props.get("zona", 0))
        except (TypeError, ValueError):
            continue
        if zona <= 0:
            continue
        desc = str(props.get("descripcion") or "").strip()
        out[zona] = desc or f"Zona {zona}"
    return out


def zone_label(zona: int) -> str:
    return zone_label_map().get(int(zona), f"Zona {zona}")
