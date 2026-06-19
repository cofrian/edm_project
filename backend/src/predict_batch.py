"""Predicción batch por hora para todas las zonas (mapa heatmap)."""

from __future__ import annotations

import hashlib
import json
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from .data_loader import load_zones_points
from .event_impact import apply_events_to_intensity
from .events import events_at
from .integrations.aemet import weather_for_model
from .model_loader import get_level_thresholds, get_model
from .pipeline import classify_level
from .schemas import PredictHourRequest
from .ttl_cache import get_cached, set_cached

TZ = ZoneInfo("Europe/Madrid")


def _weather_from_request(req: PredictHourRequest) -> dict:
    if req.use_live_weather:
        w = weather_for_model(req.fecha)
    else:
        w = {
            "temp_c": req.temp_c,
            "hum_rel": req.hum_rel,
            "pres_mb": req.pres_mb,
            "vel_viento_ms": req.vel_viento_ms,
            "vel_viento_max_ms": req.vel_viento_max_ms,
            "dir_viento_grados": req.dir_viento_grados,
            "precip_lm2": req.precip_lm2,
            "dia_mes_norm": req.fecha.day / 31.0,
        }
    return w


def _cache_key(req: PredictHourRequest, weather: dict) -> str:
    payload = {
        "fecha": req.fecha.isoformat(),
        "hora": req.hora,
        "dia_semana": req.dia_semana,
        "apply_events": req.apply_events,
        "weather": {k: weather.get(k) for k in sorted(weather) if k != "source"},
    }
    return "heatmap:" + hashlib.md5(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def predict_hour_batch(req: PredictHourRequest) -> dict[str, Any]:
    cached_key = _cache_key(req, _weather_from_request(req))
    cached = get_cached(cached_key)
    if cached is not None:
        return cached

    model = get_model()
    q33, q66 = get_level_thresholds()
    weather = _weather_from_request(req)
    zones_gj = load_zones_points()
    features_in = zones_gj.get("features", [])

    active_events: list[dict] = []
    if req.apply_events:
        active_events = events_at(req.fecha, req.hora)

    at = datetime(
        req.fecha.year, req.fecha.month, req.fecha.day, req.hora, 0, tzinfo=TZ,
    )

    points: list[dict] = []
    geo_features: list[dict] = []

    for feat in features_in:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})
        coords = geom.get("coordinates", [0, 0])
        lon, lat = float(coords[0]), float(coords[1])
        zona = int(props.get("zona", 0))

        if model is not None:
            out = model.predict_point(zona, req.hora, req.dia_semana, weather)
            intensidad = out["intensidad"]
            baseline = out["baseline"]
        else:
            baseline = (q33 + q66) / 2
            intensidad = baseline

        if req.apply_events and active_events:
            intensidad = apply_events_to_intensity(
                intensidad, lat, lon, at, active_events,
            )

        nivel = classify_level(intensidad, q33, q66)
        row = {
            "zona": zona,
            "lat": lat,
            "lon": lon,
            "intensidad": round(intensidad, 2),
            "baseline": round(baseline, 2),
            "nivel": nivel,
            "descripcion": props.get("descripcion", ""),
        }
        points.append(row)
        geo_features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": row,
        })

    result = {
        "fecha": req.fecha.isoformat(),
        "hora": req.hora,
        "dia_semana": req.dia_semana,
        "n_points": len(points),
        "points": points,
        "geojson": {"type": "FeatureCollection", "features": geo_features},
        "events_active": len(active_events),
        "weather": {k: v for k, v in weather.items() if k != "source"},
        "model_loaded": model is not None,
    }
    set_cached(cached_key, result, ttl_seconds=300)
    return result


def predict_heatmap(
    fecha: date,
    hora: int,
    dia_semana: int | None = None,
    *,
    use_live_weather: bool = True,
    apply_events: bool = True,
) -> dict[str, Any]:
    dow = dia_semana if dia_semana is not None else fecha.weekday()
    req = PredictHourRequest(
        fecha=fecha,
        hora=hora,
        dia_semana=dow,
        use_live_weather=use_live_weather,
        apply_events=apply_events,
    )
    return predict_hour_batch(req)
