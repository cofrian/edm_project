"""Tráfico en tiempo real — ArcGIS Ayuntamiento de Valencia."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ..data_loader import load_tramo_zone_lookup
from ..geo_utils import haversine_m, line_centroid
from ..http_client import get_json
from ..ttl_cache import get_cached, set_cached

MAP_SERVER = os.getenv(
    "VALENCIA_MAP_SERVER",
    "https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer",
)
ARCGIS_ESTADO_URL = os.getenv(
    "VALENCIA_TRAFFIC_URL",
    f"{MAP_SERVER}/192/query",
)
ARCGIS_INTENSITY_URL = f"{MAP_SERVER}/188/query"

JOIN_THRESHOLD_M = float(os.getenv("VALENCIA_TRAMO_JOIN_M", "80"))

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


def _fetch_estado_geojson() -> dict:
    params = (
        "?where=1%3D1"
        "&outFields=Idtramo,Denominacion,Estado"
        "&returnGeometry=true"
        "&outSR=4326"
        "&f=geojson"
    )
    return get_json(f"{ARCGIS_ESTADO_URL}{params}", timeout=45)


def _fetch_intensity_geojson() -> dict:
    params = (
        "?where=1%3D1"
        "&outFields=idtramo,lectura,des_tramo,estado"
        "&returnGeometry=true"
        "&outSR=4326"
        "&f=geojson"
    )
    return get_json(f"{ARCGIS_INTENSITY_URL}{params}", timeout=45)


def _intensity_index(gj: dict) -> list[dict[str, Any]]:
    """Centroides de capa 188 con lectura veh/h válida."""
    rows: list[dict[str, Any]] = []
    for feat in gj.get("features", []):
        props = feat.get("properties") or {}
        lectura_raw = _prop(props, "lectura", "Lectura")
        try:
            lectura = int(float(lectura_raw)) if lectura_raw is not None else -1
        except (TypeError, ValueError):
            lectura = -1
        if lectura < 0:
            continue
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        if geom.get("type") != "LineString" or not coords:
            continue
        lat, lon = line_centroid(coords)
        rows.append({
            "idtramo_188": str(_prop(props, "idtramo", "Idtramo") or ""),
            "lectura": lectura,
            "lat": lat,
            "lon": lon,
        })
    return rows


def _nearest_intensity(
    lat: float,
    lon: float,
    intensity_rows: list[dict[str, Any]],
) -> tuple[int | None, str | None]:
    best_d = JOIN_THRESHOLD_M + 1
    best_lectura: int | None = None
    best_id: str | None = None
    for row in intensity_rows:
        d = haversine_m(lat, lon, row["lat"], row["lon"])
        if d < best_d:
            best_d = d
            best_lectura = row["lectura"]
            best_id = row["idtramo_188"]
    if best_d > JOIN_THRESHOLD_M:
        return None, None
    return best_lectura, best_id


def live_traffic() -> dict:
    """GeoJSON de tramos: estado (192) + lectura veh/h (188) por join espacial."""
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

    fetch_ok = True
    try:
        gj_estado = _fetch_estado_geojson()
    except Exception:
        gj_estado = {"type": "FeatureCollection", "features": []}
        fetch_ok = False

    intensity_rows: list[dict[str, Any]] = []
    try:
        gj_intensity = _fetch_intensity_geojson()
        intensity_rows = _intensity_index(gj_intensity)
    except Exception:
        intensity_rows = []

    stats = {label: 0 for label in ESTADO_LABELS.values()}
    n_with_vh = 0
    features = []
    for feat in gj_estado.get("features", []):
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

        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or []
        intensidad_vh = None
        lectura_source = None
        idtramo_188 = None
        if coords and geom.get("type") == "LineString":
            clat, clon = line_centroid(coords)
            lectura, id188 = _nearest_intensity(clat, clon, intensity_rows)
            if lectura is not None:
                intensidad_vh = lectura
                lectura_source = "ayuntamiento_capa_188"
                idtramo_188 = id188
                n_with_vh += 1

        props_out = {
            "idtramo": idtramo,
            "denominacion": denominacion,
            "estado": estado_int,
            "estado_label": label,
            "color": ESTADO_COLORS.get(estado_int, "#94a3b8"),
            "zona_nearest": lookup_map.get(idtramo),
            "intensidad_vh": intensidad_vh,
            "lectura_source": lectura_source,
            "idtramo_188": idtramo_188,
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
        "source_url": ARCGIS_ESTADO_URL,
        "fetched_at": now.isoformat(),
        "updated_ttl_seconds": 180,
        "stats": stats,
        "n_tramos": len(features),
        "n_with_intensidad_vh": n_with_vh,
    }
    set_cached(cache_key, out, ttl_seconds=180)
    return out
