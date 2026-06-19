"""Impacto espacio-temporal de eventos sobre la intensidad predicha."""

from __future__ import annotations

import math
from datetime import datetime
from typing import Any

from zoneinfo import ZoneInfo

TZ = ZoneInfo("Europe/Madrid")


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(TZ)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def temporal_factor(
    event_start: datetime,
    event_end: datetime,
    at: datetime,
    factor_max: float,
    ramp_hours: float = 2.0,
    decay_hours: float = 1.0,
) -> float:
    """Curva: rampa antes del evento, pico durante, decaimiento después."""
    if at < event_start:
        ramp_start = event_start.timestamp() - ramp_hours * 3600
        if at.timestamp() <= ramp_start:
            return 1.0
        t = (at.timestamp() - ramp_start) / (event_start.timestamp() - ramp_start)
        return 1.0 + t * (factor_max - 1.0)
    if at <= event_end:
        return factor_max
    decay_end = event_end.timestamp() + decay_hours * 3600
    if at.timestamp() >= decay_end:
        return 1.0
    t = (at.timestamp() - event_end.timestamp()) / (decay_end - event_end.timestamp())
    return factor_max - t * (factor_max - 1.0)


def spatial_factor(dist_m: float, radio_m: float) -> float:
    if radio_m <= 0:
        return 0.0
    if dist_m >= radio_m:
        return 0.0
    return 1.0 - (dist_m / radio_m) ** 2


def event_multiplier(
    event: dict[str, Any],
    lat: float,
    lon: float,
    at: datetime,
) -> float:
    """Multiplicador >= 1.0 para un punto (lat, lon) en el instante `at`."""
    try:
        start = _parse_dt(event["inicio"])
        end = _parse_dt(event.get("fin", event["inicio"]))
    except (KeyError, ValueError):
        return 1.0

    factor_max = float(event.get("factor_max", 1.2))
    radio = float(event.get("radio_metros", 300))
    elat = float(event["lat"])
    elon = float(event["lon"])

    t_factor = temporal_factor(start, end, at, factor_max)
    if t_factor <= 1.0:
        return 1.0

    dist = haversine_m(lat, lon, elat, elon)
    s_factor = spatial_factor(dist, radio)
    if s_factor <= 0:
        return 1.0

    return 1.0 + (t_factor - 1.0) * s_factor


def apply_events_to_intensity(
    intensidad: float,
    lat: float,
    lon: float,
    at: datetime,
    events: list[dict[str, Any]],
) -> float:
    """Combina multiplicadores de todos los eventos activos (producto)."""
    mult = 1.0
    for ev in events:
        mult *= event_multiplier(ev, lat, lon, at)
    return intensidad * mult
