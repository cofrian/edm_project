"""Tráfico en tiempo real — ArcGIS Ayuntamiento de Valencia."""

from __future__ import annotations

import os
from datetime import datetime
from zoneinfo import ZoneInfo

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

SOURCE_LABEL = "Ayuntamiento de Valencia · geoportal.valencia.es"


def _prop(props: dict, *keys: str):
    for key in keys:
        val = props.get(key)
        if val is not None and val != "":
            return val
    return None


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
        lookup_map = {
            str(k): v
            for k, v in zip(lookup["Idtramo"].astype(str), lookup["Zona"])
            if str(k).strip()
        }

    try:
        gj = _fetch_geojson()
        fetch_ok = True
    except Exception:
        gj = {"type": "FeatureCollection", "features": []}
        fetch_ok = False

    stats = {label: 0 for label in ESTADO_LABELS.values()}
    features = []
    for feat in gj.get("features", []):
        props = feat.get("properties", {}) or {}
        estado_raw = _prop(props, "Estado", "estado")
        try:
            estado_int = int(estado_raw) if estado_raw is not None else 0
        except (TypeError, ValueError):
            estado_int = 0
        estado_int = max(0, min(3, estado_int))
        label = ESTADO_LABELS.get(estado_int, "desconocido")
        stats[label] = stats.get(label, 0) + 1

        idtramo = str(_prop(props, "Idtramo", "idtramo") or "")
        denominacion = _prop(props, "Denominacion", "denominacion") or "Tramo"
        props_out = {
            "idtramo": idtramo,
            "denominacion": denominacion,
            "estado": estado_int,
            "estado_label": label,
            "color": ESTADO_COLORS.get(estado_int, "#94a3b8"),
            "zona_nearest": lookup_map.get(idtramo),
        }
        features.append({
            "type": "Feature",
            "geometry": feat.get("geometry"),
            "properties": props_out,
        })

    now = datetime.now(ZoneInfo("Europe/Madrid"))
    out = {
        "type": "FeatureCollection",
        "features": features,
        "source": "valencia_opendata" if fetch_ok else "unavailable",
        "source_label": SOURCE_LABEL,
        "source_url": ARCGIS_URL,
        "fetched_at": now.isoformat(),
        "updated_ttl_seconds": 180,
        "stats": stats,
        "n_tramos": len(features),
    }
    set_cached(cache_key, out, ttl_seconds=180)
    return out
