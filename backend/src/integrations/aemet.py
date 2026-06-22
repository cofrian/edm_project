"""Cliente AEMET OpenData para meteorología en Valencia."""

from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

from ..http_client import get_json
from ..ttl_cache import get_cached, set_cached

TZ = ZoneInfo("Europe/Madrid")
# Estación Valencia-Universitat (observación horaria)
STATION_ID = os.getenv("AEMET_STATION_ID", "8416X")
AEMET_BASE = "https://opendata.aemet.es/opendata/api"
# Fallback gratuito (Valencia centro) cuando no hay AEMET_API_KEY
OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=39.4699&longitude=-0.3763"
    "&current=temperature_2m,relative_humidity_2m,precipitation,"
    "wind_speed_10m,wind_direction_10m,surface_pressure"
    "&timezone=Europe%2FMadrid"
)
OPEN_METEO_FORECAST_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=39.4699&longitude=-0.3763"
    "&hourly=temperature_2m,relative_humidity_2m,precipitation,"
    "wind_speed_10m,wind_direction_10m,surface_pressure"
    "&timezone=Europe%2FMadrid&forecast_days=2"
)

# Valores por defecto razonables para verano en Valencia
DEFAULT_WEATHER = {
    "temp_c": 26.0,
    "hum_rel": 55.0,
    "pres_mb": 1013.0,
    "vel_viento_ms": 2.5,
    "vel_viento_max_ms": 6.0,
    "dir_viento_grados": 90.0,
    "precip_lm2": 0.0,
    "source": "default",
}


def _api_key() -> str | None:
    key = os.getenv("AEMET_API_KEY", "").strip()
    return key or None


def _aemet_datos(endpoint: str) -> Any:
    key = _api_key()
    if not key:
        return None
    cache_key = f"aemet:{endpoint}"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached
    try:
        meta = get_json(f"{AEMET_BASE}/{endpoint}?api_key={key}")
        if meta.get("estado") != 200:
            return None
        datos_url = meta.get("datos")
        if not datos_url:
            return None
        payload = get_json(datos_url)
        set_cached(cache_key, payload, ttl_seconds=600)
        return payload
    except Exception:
        return None


def _open_meteo_current() -> dict[str, float] | None:
    try:
        payload = get_json(OPEN_METEO_URL, timeout=20)
        current = payload.get("current") or {}
        if not current:
            return None
        return {
            "temp_c": _f(current.get("temperature_2m"), default=DEFAULT_WEATHER["temp_c"]),
            "hum_rel": _f(current.get("relative_humidity_2m"), default=DEFAULT_WEATHER["hum_rel"]),
            "pres_mb": _f(current.get("surface_pressure"), default=DEFAULT_WEATHER["pres_mb"]),
            "vel_viento_ms": _f(current.get("wind_speed_10m"), default=DEFAULT_WEATHER["vel_viento_ms"]),
            "vel_viento_max_ms": _f(
                current.get("wind_speed_10m"),
                default=DEFAULT_WEATHER["vel_viento_max_ms"],
            ),
            "dir_viento_grados": _f(
                current.get("wind_direction_10m"),
                default=DEFAULT_WEATHER["dir_viento_grados"],
            ),
            "precip_lm2": _f(current.get("precipitation"), default=0.0),
            "source": "open-meteo",
        }
    except Exception:
        return None


def _parse_observation(payload: list[dict] | None) -> dict[str, float]:
    if not payload:
        return dict(DEFAULT_WEATHER)
    # Estructura típica: lista de estaciones con lista de observaciones
    station = None
    for item in payload:
        if str(item.get("idema", "")).startswith("8416") or item.get("indicativo") == STATION_ID:
            station = item
            break
    if station is None and payload:
        station = payload[0]
    if station is None:
        return dict(DEFAULT_WEATHER)

    obs_list = station.get("observacion") or station.get("datos") or []
    if isinstance(obs_list, dict):
        obs_list = [obs_list]
    if not obs_list:
        return dict(DEFAULT_WEATHER)

    obs = obs_list[-1] if obs_list else {}
    temp = _f(obs.get("ta") or obs.get("temperatura"))
    hum = _f(obs.get("hr") or obs.get("humedad"))
    pres = _f(obs.get("pres") or obs.get("presion"))
    wind = _f(obs.get("vv") or obs.get("viento"))
    gust = _f(obs.get("racha") or obs.get("viento_max"), default=wind * 2 if wind else 5.0)
    direction = _f(obs.get("dv") or obs.get("dir_viento"))
    precip = _f(obs.get("prec") or obs.get("precipitacion"), default=0.0)

    return {
        "temp_c": temp if temp is not None else DEFAULT_WEATHER["temp_c"],
        "hum_rel": hum if hum is not None else DEFAULT_WEATHER["hum_rel"],
        "pres_mb": pres if pres is not None else DEFAULT_WEATHER["pres_mb"],
        "vel_viento_ms": wind if wind is not None else DEFAULT_WEATHER["vel_viento_ms"],
        "vel_viento_max_ms": gust if gust is not None else DEFAULT_WEATHER["vel_viento_max_ms"],
        "dir_viento_grados": direction if direction is not None else DEFAULT_WEATHER["dir_viento_grados"],
        "precip_lm2": precip if precip is not None else 0.0,
        "source": "aemet" if _api_key() else "default",
    }


def _f(val: Any, default: float | None = None) -> float | None:
    if val is None or val == "":
        return default
    try:
        return float(str(val).replace(",", "."))
    except (TypeError, ValueError):
        return default


def current_weather() -> dict:
    """Meteo actual para el dashboard (AEMET o defaults)."""
    cache_key = "weather:current"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    weather: dict[str, float | str]
    if _api_key():
        payload = _aemet_datos(f"observacion/convencional/ultimaestacion/{STATION_ID}")
        if payload is None:
            payload = _aemet_datos("observacion/convencional/todas")
        weather = _parse_observation(payload if isinstance(payload, list) else None)
        if weather.get("source") != "aemet":
            fallback = _open_meteo_current()
            if fallback:
                weather = fallback
    else:
        fallback = _open_meteo_current()
        weather = fallback if fallback else dict(DEFAULT_WEATHER)
        if weather.get("source") != "open-meteo":
            weather["note"] = "Sin conexión a servicios meteorológicos"

    now = datetime.now(TZ)
    weather["timestamp"] = now.isoformat()
    weather["station_id"] = STATION_ID
    set_cached(cache_key, weather, ttl_seconds=600)
    return weather


def weather_for_model(target_date: date | None = None) -> dict:
    """Dict compatible con TrafficModel.predict_point (incluye dia_mes_norm)."""
    w = current_weather()
    d = target_date or date.today()
    return {
        "temp_c": w["temp_c"],
        "hum_rel": w["hum_rel"],
        "pres_mb": w["pres_mb"],
        "vel_viento_ms": w["vel_viento_ms"],
        "vel_viento_max_ms": w["vel_viento_max_ms"],
        "dir_viento_grados": w["dir_viento_grados"],
        "precip_lm2": w["precip_lm2"],
        "dia_mes_norm": d.day / 31.0,
    }


def _open_meteo_hourly_forecast() -> list[dict] | None:
    """Forecast horario real de Open-Meteo para hoy y mañana (48h)."""
    cache_key = "weather:forecast:hourly"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached
    try:
        payload = get_json(OPEN_METEO_FORECAST_URL, timeout=20)
        hourly = payload.get("hourly") or {}
        times = hourly.get("time") or []
        temps = hourly.get("temperature_2m") or []
        hums = hourly.get("relative_humidity_2m") or []
        precips = hourly.get("precipitation") or []
        winds = hourly.get("wind_speed_10m") or []
        wind_dirs = hourly.get("wind_direction_10m") or []
        pressures = hourly.get("surface_pressure") or []
        result = []
        for i, time_str in enumerate(times):
            try:
                dt = datetime.fromisoformat(time_str)
            except ValueError:
                continue
            result.append({
                "fecha": dt.date().isoformat(),
                "hora": dt.hour,
                "temp_c": _f(temps[i] if i < len(temps) else None, DEFAULT_WEATHER["temp_c"]),
                "hum_rel": _f(hums[i] if i < len(hums) else None, DEFAULT_WEATHER["hum_rel"]),
                "pres_mb": _f(pressures[i] if i < len(pressures) else None, DEFAULT_WEATHER["pres_mb"]),
                "vel_viento_ms": _f(winds[i] if i < len(winds) else None, DEFAULT_WEATHER["vel_viento_ms"]),
                "dir_viento_grados": _f(wind_dirs[i] if i < len(wind_dirs) else None, DEFAULT_WEATHER["dir_viento_grados"]),
                "precip_lm2": _f(precips[i] if i < len(precips) else None, 0.0),
                "source": "open-meteo-forecast",
            })
        set_cached(cache_key, result, ttl_seconds=3600)
        return result
    except Exception:
        return None


def forecast_day(target: date | None = None) -> list[dict]:
    """Pronóstico horario real (Open-Meteo) para la fecha indicada."""
    d = target or date.today()
    date_str = d.isoformat()
    hourly = _open_meteo_hourly_forecast()
    if hourly:
        day_hours = [h for h in hourly if h["fecha"] == date_str]
        if day_hours:
            return sorted(day_hours, key=lambda h: h["hora"])
    # Fallback: estimación sinusoidal sobre tiempo actual
    base = current_weather()
    return [
        {
            "hora": h,
            "fecha": date_str,
            "temp_c": round(base["temp_c"] + 4 * max(0, (h - 6) / 12) - 2 * max(0, (h - 18) / 6), 1),
            "hum_rel": base["hum_rel"],
            "pres_mb": base["pres_mb"],
            "vel_viento_ms": base["vel_viento_ms"],
            "precip_lm2": base["precip_lm2"],
            "source": base.get("source", "default"),
        }
        for h in range(24)
    ]
