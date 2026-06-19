"""Tráfico en tiempo real — ArcGIS Ayuntamiento de Valencia."""

from __future__ import annotations

import os

from ..data_loader import load_tramo_zone_lookup
from ..http_client import get_json
from ..ttl_cache import get_cached, set_cached

ARCGIS_URL = os.getenv(
    "VALENCIA_TRAFFIC_URL",
    "https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/192/query",
)

ESTADO_LABELS = {
    0: "fluido",
    1: "denso",
    2: "congestionado",
    3: "cortado",
}

ESTADO_COLORS = {
    0: "#16a34a",
    1: "#d97706",
    2: "#ea580c",
    3: "#dc2626",
}


def _fetch_geojson() -> dict:
    params = (
        "?where=1%3D1"
        "&outFields=Idtramo,Denominacion,Estado"
        "&returnGeometry=true"
        "&outSR=4326"
        "&f=geojson"
    )
    return get_json(f"{ARCGIS_URL}{params}", timeout=45)


def live_traffic() -> dict:
    """GeoJSON de tramos con estado y zona más cercana (si lookup disponible)."""
    cache_key = "traffic:live"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    lookup = load_tramo_zone_lookup()
    lookup_map = {}
    if not lookup.empty and "Idtramo" in lookup.columns:
        lookup_map = dict(zip(lookup["Idtramo"].astype(str), lookup["Zona"]))

    try:
        gj = _fetch_geojson()
    except Exception:
        gj = {"type": "FeatureCollection", "features": [], "source": "unavailable"}

    features = []
    for feat in gj.get("features", []):
        props = feat.get("properties", {})
        estado = props.get("Estado")
        try:
            estado_int = int(estado) if estado is not None else 0
        except (TypeError, ValueError):
            estado_int = 0
        idtramo = str(props.get("Idtramo", ""))
        props_out = {
            **props,
            "estado": estado_int,
            "estado_label": ESTADO_LABELS.get(estado_int, "desconocido"),
            "color": ESTADO_COLORS.get(estado_int, "#94a3b8"),
            "zona_nearest": lookup_map.get(idtramo),
        }
        features.append({
            "type": "Feature",
            "geometry": feat.get("geometry"),
            "properties": props_out,
        })

    out = {
        "type": "FeatureCollection",
        "features": features,
        "source": "valencia_opendata",
        "updated_ttl_seconds": 180,
    }
    set_cached(cache_key, out, ttl_seconds=180)
    return out
