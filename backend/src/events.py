"""Carga y filtrado de eventos urbanos."""

from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo

from .data_loader import load_city_events_raw

TZ = ZoneInfo("Europe/Madrid")

EVENT_IMAGES: dict[str, str] = {
    "deporte": "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=400&h=300&fit=crop",
    "espectaculo": "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop",
    "concierto": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=300&fit=crop",
    "mercadillo": "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&h=300&fit=crop",
    "fiesta": "https://images.unsplash.com/photo-1533174072545-7a4b6d7a03ca?w=400&h=300&fit=crop",
    "cultura": "https://images.unsplash.com/photo-1503099826907-0e4bd4a8d238?w=400&h=300&fit=crop",
    "ocio": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop",
}
DEFAULT_EVENT_IMAGE = (
    "https://images.unsplash.com/photo-1511578314322-379afb476865?w=400&h=300&fit=crop"
)


def _enrich_event(ev: dict[str, Any]) -> dict[str, Any]:
    out = dict(ev)
    if not out.get("imagen"):
        tipo = str(out.get("tipo", "")).lower()
        out["imagen"] = EVENT_IMAGES.get(tipo, DEFAULT_EVENT_IMAGE)
    return out


@lru_cache
def load_city_events() -> list[dict[str, Any]]:
    return load_city_events_raw()


def list_events(
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict[str, Any]]:
    events = load_city_events()
    if from_date is None and to_date is None:
        return [_enrich_event(ev) for ev in events]

    out = []
    for ev in events:
        try:
            start = datetime.fromisoformat(ev["inicio"].replace("Z", "+00:00")).date()
            end = datetime.fromisoformat(ev.get("fin", ev["inicio"]).replace("Z", "+00:00")).date()
        except (KeyError, ValueError):
            continue
        if from_date and end < from_date:
            continue
        if to_date and start > to_date:
            continue
        out.append(_enrich_event(ev))
    return out


def events_at(
    target_date: date,
    hora: int,
    events: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Eventos que pueden influir en la hora dada del día."""
    pool = events if events is not None else load_city_events()
    at = datetime(target_date.year, target_date.month, target_date.day, hora, 0, tzinfo=TZ)
    active = []
    for ev in pool:
        try:
            start = datetime.fromisoformat(ev["inicio"].replace("Z", "+00:00")).astimezone(TZ)
            end = datetime.fromisoformat(ev.get("fin", ev["inicio"]).replace("Z", "+00:00")).astimezone(TZ)
        except (KeyError, ValueError):
            continue
        ramp_start = start.timestamp() - 2 * 3600
        decay_end = end.timestamp() + 2 * 3600
        ts = at.timestamp()
        if ramp_start <= ts <= decay_end:
            active.append(ev)
    return active
