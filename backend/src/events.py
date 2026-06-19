"""Carga y filtrado de eventos urbanos."""

from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache
from typing import Any

from zoneinfo import ZoneInfo

from .data_loader import load_city_events_raw

TZ = ZoneInfo("Europe/Madrid")


@lru_cache
def load_city_events() -> list[dict[str, Any]]:
    return load_city_events_raw()


def list_events(
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[dict[str, Any]]:
    events = load_city_events()
    if from_date is None and to_date is None:
        return events

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
        out.append(ev)
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
