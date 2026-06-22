"""Movilidad urbana en tiempo real: Valenbisi, EMT, alertas y estimacion."""

from __future__ import annotations

import csv
import io
import json
import math
import os
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timedelta
from html import unescape
from typing import Any
from zoneinfo import ZoneInfo

from ..events import list_events
from ..geo_utils import haversine_m
from ..http_client import get_json
from ..ttl_cache import get_cached, set_cached

TZ = ZoneInfo("Europe/Madrid")

MAP_SERVER = os.getenv(
    "VALENCIA_MAP_SERVER",
    "https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer",
)

VALENBISI_URL = os.getenv(
    "VALENCIA_VALENBISI_URL",
    f"{MAP_SERVER}/228/query?f=json&outFields=*&where=1%3D1&outSR=4326",
)
EMT_STOPS_URL = os.getenv(
    "VALENCIA_EMT_STOPS_URL",
    f"{MAP_SERVER}/226/query?where=1%3D1&outFields=*&f=json&outSR=4326",
)
EMT_ARRIVALS_URL = os.getenv(
    "VALENCIA_EMT_ARRIVALS_URL",
    "https://www.emtvalencia.es/EMT/mapfunctions/MapUtilsPetitions.php",
)
EMT_ROUTES_URL = os.getenv("VALENCIA_EMT_ROUTES_URL", "")
EMT_GTFS_RESOURCE_ID = os.getenv(
    "VALENCIA_EMT_GTFS_RESOURCE_ID",
    "c81b69e6-c082-44dc-acc6-66fc417b4e66",
)
EMT_GTFS_RESOURCE_API_URL = os.getenv(
    "VALENCIA_EMT_GTFS_RESOURCE_API_URL",
    "https://opendata.vlci.valencia.es/api/3/action/resource_show",
)
EMT_GTFS_URL = os.getenv("VALENCIA_EMT_GTFS_URL", "").strip()
EMT_GTFS_NAP_FILE_ID = os.getenv("VALENCIA_EMT_GTFS_NAP_FILE_ID", "").strip()
EMT_GTFS_API_KEY = os.getenv("VALENCIA_EMT_GTFS_API_KEY", "").strip()

VALENBISI_TTL_SECONDS = int(os.getenv("VALENCIA_VALENBISI_TTL_SECONDS", "180"))
EMT_STOPS_TTL_SECONDS = int(os.getenv("VALENCIA_EMT_STOPS_TTL_SECONDS", str(6 * 3600)))
EMT_ARRIVALS_TTL_SECONDS = int(os.getenv("VALENCIA_EMT_ARRIVALS_TTL_SECONDS", "45"))
EMT_ARRIVALS_TIMEOUT_SECONDS = float(os.getenv("VALENCIA_EMT_ARRIVALS_TIMEOUT_SECONDS", "12"))
EMT_ARRIVALS_LAST_GOOD_TTL_SECONDS = int(
    os.getenv("VALENCIA_EMT_ARRIVALS_LAST_GOOD_TTL_SECONDS", "900")
)
EMT_FALLBACK_HEADWAY_MINUTES = int(os.getenv("VALENCIA_EMT_FALLBACK_HEADWAY_MINUTES", "12"))
EMT_FALLBACK_MAX_LINES = int(os.getenv("VALENCIA_EMT_FALLBACK_MAX_LINES", "3"))
EMT_ROUTES_TTL_SECONDS = int(os.getenv("VALENCIA_EMT_ROUTES_TTL_SECONDS", str(6 * 3600)))
EVENT_RADIUS_METERS = int(os.getenv("VALENCIA_EVENT_VALENBISI_RADIUS_METERS", "1000"))
DELAY_THRESHOLD_MINUTES = int(os.getenv("VALENCIA_EMT_DELAY_THRESHOLD_MINUTES", "3"))
DEFAULT_BUS_SPEED_KMH = float(os.getenv("VALENCIA_EMT_AVG_SPEED_KMH", "14"))

SOURCE_LABEL = "Ayuntamiento de Valencia · geoportal.valencia.es"
SAE_SOURCE_LABEL = "EMT Valencia SAE · servicio operativo no documentado"

GTFS_SOURCE_LABEL = "Ajuntament de Valencia Open Data - Google Transit EMT"

_arrival_snapshots: dict[str, dict[str, Any]] = {}
_delay_alerts: dict[str, dict[str, Any]] = {}


def now_madrid() -> datetime:
    return datetime.now(TZ)


def _attr(attrs: dict[str, Any], *names: str) -> Any:
    lowered = {str(k).lower(): v for k, v in attrs.items()}
    for name in names:
        if name in attrs and attrs[name] not in (None, ""):
            return attrs[name]
        val = lowered.get(name.lower())
        if val not in (None, ""):
            return val
    return None


def _feature_attrs(feature: dict[str, Any]) -> dict[str, Any]:
    return feature.get("attributes") or feature.get("properties") or {}


def _feature_geometry(feature: dict[str, Any]) -> dict[str, Any]:
    return feature.get("geometry") or {}


def _to_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(float(str(value).replace(",", ".")))
    except (TypeError, ValueError):
        return default


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return default


def _to_bool(value: Any, default: bool = True) -> bool:
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    normalized = str(value).strip().lower()
    if normalized in {"true", "t", "1", "si", "sí", "s", "open", "abierta", "abierto"}:
        return True
    if normalized in {"false", "f", "0", "no", "closed", "cerrada", "cerrado"}:
        return False
    return default


def _created_at(now: datetime | None = None) -> str:
    return (now or now_madrid()).isoformat()


def _alert(
    *,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    entity_type: str,
    entity_id: str,
    now: datetime | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "id": f"{alert_type}:{entity_id}:{metadata.get('eventId') if metadata else ''}",
        "type": alert_type,
        "severity": severity,
        "title": title,
        "message": message,
        "entityType": entity_type,
        "entityId": entity_id,
        "createdAt": _created_at(now),
        "metadata": metadata or {},
    }


def normalize_city_event(ev: dict[str, Any]) -> dict[str, Any] | None:
    try:
        return {
            "id": str(ev["id"]),
            "name": str(ev.get("name") or ev.get("nombre") or ev["id"]),
            "lat": float(ev["lat"]),
            "lon": float(ev["lon"]),
            "startTime": ev.get("startTime") or ev.get("inicio"),
            "endTime": ev.get("endTime") or ev.get("fin"),
            "expectedAttendance": ev.get("expectedAttendance"),
            "category": ev.get("category") or ev.get("tipo"),
        }
    except (KeyError, TypeError, ValueError):
        return None


def _event_is_active_or_upcoming(ev: dict[str, Any], at: datetime, ahead_hours: int = 24) -> bool:
    start_raw = ev.get("startTime") or ev.get("inicio")
    end_raw = ev.get("endTime") or ev.get("fin") or start_raw
    if not start_raw:
        return True
    try:
        start = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00")).astimezone(TZ)
        end = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00")).astimezone(TZ)
    except ValueError:
        return True
    return at - timedelta(hours=2) <= end and start <= at + timedelta(hours=ahead_hours)


def active_or_upcoming_events(at: datetime | None = None) -> list[dict[str, Any]]:
    at = at or now_madrid()
    from_date = at.date()
    to_date = (at + timedelta(days=1)).date()
    events = []
    for ev in list_events(from_date=from_date, to_date=to_date):
        normalized = normalize_city_event(ev)
        if normalized and _event_is_active_or_upcoming(normalized, at):
            events.append(normalized)
    return events


def normalize_valenbisi_station(
    feature: dict[str, Any],
    *,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    attrs = _feature_attrs(feature)
    geom = _feature_geometry(feature)
    lon = _attr(geom, "x", "lon", "longitude")
    lat = _attr(geom, "y", "lat", "latitude")
    if lon is None or lat is None:
        coords = geom.get("coordinates")
        if isinstance(coords, list) and len(coords) >= 2:
            lon, lat = coords[0], coords[1]
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (TypeError, ValueError):
        return None

    number = _to_int(_attr(attrs, "number", "numero", "id", "objectid"), 0)
    name = str(_attr(attrs, "name", "nombre", "denominacion") or f"Valenbisi {number}")
    station_id = str(_attr(attrs, "id", "number", "objectid") or number or name)
    is_open = _to_bool(_attr(attrs, "open", "abierta", "estado"), True)
    bikes = _to_int(_attr(attrs, "available", "bicis_disponibles", "bikes_available"), 0)
    docks_free = _to_int(_attr(attrs, "free", "huecos_libres", "docks_free"), 0)
    total = _to_int(_attr(attrs, "total", "capacidad", "docks_total"), bikes + docks_free)

    alerts = []
    if not is_open:
        status = "closed"
        alerts.append(
            _alert(
                alert_type="VALENBISI_CLOSED",
                severity="warning",
                title="Estacion cerrada",
                message=f"La estacion {name} aparece como cerrada o fuera de servicio.",
                entity_type="valenbisi_station",
                entity_id=station_id,
                now=now,
            )
        )
    elif bikes == 0:
        status = "empty"
        alerts.append(
            _alert(
                alert_type="VALENBISI_EMPTY",
                severity="critical",
                title="Sin bicis disponibles",
                message=f"La estacion {name} no tiene bicicletas disponibles.",
                entity_type="valenbisi_station",
                entity_id=station_id,
                now=now,
            )
        )
    elif docks_free == 0:
        status = "full"
        alerts.append(
            _alert(
                alert_type="VALENBISI_FULL",
                severity="critical",
                title="Estacion llena",
                message=f"La estacion {name} no tiene huecos libres para dejar bicicletas.",
                entity_type="valenbisi_station",
                entity_id=station_id,
                now=now,
            )
        )
    else:
        status = "ok"

    return {
        "id": station_id,
        "number": number,
        "name": name,
        "address": _attr(attrs, "address", "direccion"),
        "isOpen": is_open,
        "bikesAvailable": bikes,
        "docksFree": docks_free,
        "docksTotal": total,
        "updatedAt": _attr(attrs, "updated_at", "updated", "last_update", "fecha_actualizacion"),
        "lat": lat_f,
        "lon": lon_f,
        "status": status,
        "alerts": alerts,
    }


def get_stations_near_events(
    stations: list[dict[str, Any]],
    events: list[dict[str, Any]],
    radius_meters: int = EVENT_RADIUS_METERS,
) -> list[dict[str, Any]]:
    matched = []
    for station in stations:
        for ev in events:
            distance = haversine_m(station["lat"], station["lon"], ev["lat"], ev["lon"])
            if distance <= radius_meters:
                matched.append(station)
                break
    return matched


def add_event_alerts_to_stations(
    stations: list[dict[str, Any]],
    events: list[dict[str, Any]],
    *,
    radius_meters: int = EVENT_RADIUS_METERS,
    now: datetime | None = None,
) -> list[dict[str, Any]]:
    out = []
    for station in stations:
        enriched = dict(station)
        alerts = list(enriched.get("alerts") or [])
        near_event = False
        for ev in events:
            distance = haversine_m(enriched["lat"], enriched["lon"], ev["lat"], ev["lon"])
            if distance > radius_meters:
                continue
            near_event = True
            distance_m = int(round(distance))
            alerts.append(
                _alert(
                    alert_type="VALENBISI_NEAR_EVENT",
                    severity="warning",
                    title="Estacion cerca de evento",
                    message=(
                        f"La estacion {enriched['name']} esta a {distance_m} m del evento "
                        f"{ev['name']}. Conviene vigilar disponibilidad."
                    ),
                    entity_type="valenbisi_station",
                    entity_id=str(enriched["id"]),
                    now=now,
                    metadata={
                        "eventId": ev["id"],
                        "eventName": ev["name"],
                        "distanceMeters": distance_m,
                    },
                )
            )
        enriched["alerts"] = _dedupe_alerts(alerts)
        if near_event and enriched["status"] == "ok":
            enriched["status"] = "watch_event_area"
        out.append(enriched)
    return out


def _dedupe_alerts(alerts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out = []
    for alert in alerts:
        key = str(alert.get("id") or f"{alert.get('type')}:{alert.get('entityId')}")
        if key in seen:
            continue
        seen.add(key)
        out.append(alert)
    return out


def _severity_order(alert: dict[str, Any]) -> tuple[int, str]:
    order = {"critical": 0, "warning": 1, "info": 2}
    return order.get(str(alert.get("severity")), 3), str(alert.get("createdAt", ""))


def fetch_valenbisi_stations() -> dict[str, Any]:
    cache_key = "mobility:valenbisi:stations"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    at = now_madrid()
    try:
        data = get_json(VALENBISI_URL, timeout=45)
        stations = [
            station
            for station in (
                normalize_valenbisi_station(feature, now=at)
                for feature in data.get("features", [])
            )
            if station is not None
        ]
        stations = add_event_alerts_to_stations(stations, active_or_upcoming_events(at), now=at)
        alerts = sorted(
            [alert for station in stations for alert in station.get("alerts", [])],
            key=_severity_order,
        )
        out = {
            "stations": stations,
            "alerts": alerts,
            "source": "valencia_opendata",
            "sourceLabel": SOURCE_LABEL,
            "sourceUrl": VALENBISI_URL,
            "fetchedAt": at.isoformat(),
            "updatedTtlSeconds": VALENBISI_TTL_SECONDS,
            "stale": False,
        }
        set_cached(cache_key, out, VALENBISI_TTL_SECONDS)
        set_cached("mobility:valenbisi:last_good", out, 24 * 3600)
        return out
    except Exception as exc:
        last_good = get_cached("mobility:valenbisi:last_good")
        if last_good is not None:
            stale = dict(last_good)
            stale["stale"] = True
            stale["error"] = str(exc)
            return stale
        return {
            "stations": [],
            "alerts": [],
            "source": "unavailable",
            "sourceLabel": SOURCE_LABEL,
            "sourceUrl": VALENBISI_URL,
            "fetchedAt": at.isoformat(),
            "updatedTtlSeconds": VALENBISI_TTL_SECONDS,
            "stale": True,
            "error": str(exc),
        }


def _split_lines(value: Any) -> list[str]:
    if value is None:
        return []
    text = unescape(str(value)).strip()
    if not text:
        return []
    parts = re.findall(r"\b[Nn]?\d{1,3}[A-Za-z]?\b|\bC\d\b|\b[A-Z]{1,2}\d{1,2}\b", text)
    if not parts:
        parts = re.split(r"[,;/| ]+", text)
    clean = []
    for part in parts:
        line = part.strip().upper()
        if line and line not in clean:
            clean.append(line)
    return clean


def normalize_emt_stop(feature: dict[str, Any]) -> dict[str, Any] | None:
    attrs = _feature_attrs(feature)
    geom = _feature_geometry(feature)
    lon = _attr(geom, "x", "lon", "longitude")
    lat = _attr(geom, "y", "lat", "latitude")
    if lon is None or lat is None:
        coords = geom.get("coordinates")
        if isinstance(coords, list) and len(coords) >= 2:
            lon, lat = coords[0], coords[1]
    try:
        lat_f = float(lat)
        lon_f = float(lon)
    except (TypeError, ValueError):
        return None
    stop_id = _to_int(_attr(attrs, "id_parada", "idparada", "parada", "stop_id", "id"), 0)
    if stop_id <= 0:
        return None
    return {
        "id": str(stop_id),
        "stopId": stop_id,
        "name": str(_attr(attrs, "denominacion", "nombre", "name") or f"Parada {stop_id}"),
        "lines": _split_lines(_attr(attrs, "lineas", "lines", "linea")),
        "nextArrivalsUrl": _attr(attrs, "proximas_llegadas", "next_arrivals", "url"),
        "lat": lat_f,
        "lon": lon_f,
    }


def fetch_emt_stops() -> dict[str, Any]:
    cache_key = "mobility:emt:stops"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    at = now_madrid()
    try:
        data = get_json(EMT_STOPS_URL, timeout=45)
        stops = [
            stop
            for stop in (normalize_emt_stop(feature) for feature in data.get("features", []))
            if stop is not None
        ]
        out = {
            "stops": stops,
            "source": "valencia_opendata",
            "sourceLabel": SOURCE_LABEL,
            "sourceUrl": EMT_STOPS_URL,
            "fetchedAt": at.isoformat(),
            "updatedTtlSeconds": EMT_STOPS_TTL_SECONDS,
            "stale": False,
        }
        set_cached(cache_key, out, EMT_STOPS_TTL_SECONDS)
        set_cached("mobility:emt:stops:last_good", out, 24 * 3600)
        return out
    except Exception as exc:
        last_good = get_cached("mobility:emt:stops:last_good")
        if last_good is not None:
            stale = dict(last_good)
            stale["stale"] = True
            stale["error"] = str(exc)
            return stale
        return {
            "stops": [],
            "source": "unavailable",
            "sourceLabel": SOURCE_LABEL,
            "sourceUrl": EMT_STOPS_URL,
            "fetchedAt": at.isoformat(),
            "updatedTtlSeconds": EMT_STOPS_TTL_SECONDS,
            "stale": True,
            "error": str(exc),
        }


def _browser_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/125.0 Safari/537.36"
        ),
        "Accept": "application/json,text/xml,text/html,text/plain,*/*",
        "Accept-Language": "es-ES,es;q=0.9,ca;q=0.8",
    }
    if extra:
        headers.update(extra)
    return headers


def _fetch_text(url: str, timeout: float = 30, headers: dict[str, str] | None = None) -> str:
    req = urllib.request.Request(
        url,
        headers=_browser_headers(headers),
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        content_type = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(content_type, errors="replace")


def _fetch_binary(url: str, timeout: float = 60, headers: dict[str, str] | None = None) -> bytes:
    req = urllib.request.Request(url, headers=_browser_headers(headers))
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _arrival_from_mapping(data: dict[str, Any], stop_id: int) -> dict[str, Any] | None:
    line = _attr(data, "line", "linea", "linia", "route", "route_short_name")
    minutes = _attr(data, "minutes", "minutos", "min", "tiempo", "time", "remaining")
    if line is None or minutes is None:
        return None
    minutes_int = _parse_minutes(minutes)
    if minutes_int is None:
        return None
    return {
        "stopId": stop_id,
        "line": str(line).strip().upper(),
        "destination": _attr(data, "destination", "destino", "headsign", "direction"),
        "minutes": minutes_int,
        "expectedArrivalTime": None,
        "raw": data,
    }


def _flatten_json_arrivals(data: Any, stop_id: int) -> list[dict[str, Any]]:
    arrivals = []
    if isinstance(data, dict):
        parsed = _arrival_from_mapping(data, stop_id)
        if parsed:
            arrivals.append(parsed)
        for value in data.values():
            arrivals.extend(_flatten_json_arrivals(value, stop_id))
    elif isinstance(data, list):
        for item in data:
            arrivals.extend(_flatten_json_arrivals(item, stop_id))
    return arrivals


def _parse_minutes(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        return max(0, int(value))
    text = unescape(str(value)).strip().lower()
    if not text:
        return None
    if any(token in text for token in ("llegando", "en parada", "arriving")):
        return 0
    match = re.search(r"-?\d+", text)
    if not match:
        return None
    return max(0, int(match.group(0)))


def _parse_xml_arrivals(text: str, stop_id: int) -> list[dict[str, Any]]:
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    arrivals = []
    for elem in root.iter():
        row = {child.tag.lower().split("}")[-1]: (child.text or "") for child in list(elem)}
        row.update({k.lower(): v for k, v in elem.attrib.items()})
        parsed = _arrival_from_mapping(row, stop_id)
        if parsed:
            arrivals.append(parsed)
    return arrivals


def _parse_text_arrivals(text: str, stop_id: int) -> list[dict[str, Any]]:
    cleaned = re.sub(r"<(script|style).*?</\1>", " ", text, flags=re.I | re.S)
    cleaned = re.sub(r"<[^>]+>", " ", cleaned)
    cleaned = unescape(re.sub(r"\s+", " ", cleaned))
    pattern = re.compile(
        r"(?:linea|line|linia|l\.)\s*([A-Za-z0-9]+).*?"
        r"(?:(?:destino|destination)\s*[:\-]?\s*([^0-9]{2,60}))?.*?"
        r"(\d+|llegando|en parada)\s*(?:min|m\b|minutos)?",
        re.I,
    )
    arrivals = []
    for match in pattern.finditer(cleaned):
        minutes = _parse_minutes(match.group(3))
        if minutes is None:
            continue
        destination = match.group(2).strip(" -:") if match.group(2) else None
        arrivals.append({
            "stopId": stop_id,
            "line": match.group(1).upper(),
            "destination": destination or None,
            "minutes": minutes,
            "expectedArrivalTime": None,
            "raw": match.group(0),
        })
    return arrivals


def parse_emt_arrivals_text(text: str, stop_id: int) -> list[dict[str, Any]]:
    raw = text.strip()
    if not raw:
        return []
    try:
        parsed_json = json.loads(raw)
    except json.JSONDecodeError:
        parsed_json = None
    if parsed_json is not None:
        arrivals = _flatten_json_arrivals(parsed_json, stop_id)
        if arrivals:
            return _dedupe_arrivals(arrivals)
    if raw.startswith("<"):
        arrivals = _parse_xml_arrivals(raw, stop_id)
        if arrivals:
            return _dedupe_arrivals(arrivals)
    return _dedupe_arrivals(_parse_text_arrivals(raw, stop_id))


def _dedupe_arrivals(arrivals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    out = []
    for arrival in arrivals:
        key = (
            arrival.get("stopId"),
            arrival.get("line"),
            arrival.get("destination"),
            arrival.get("minutes"),
        )
        if key in seen:
            continue
        seen.add(key)
        out.append(arrival)
    return out


def _arrival_match_key(arrival: dict[str, Any]) -> str:
    return (
        f"{arrival['stopId']}-{arrival['line']}-"
        f"{arrival.get('destination') or 'unknown'}"
    )


def _find_existing_snapshot(match_key: str, predicted_at: datetime) -> dict[str, Any] | None:
    best = None
    best_delta = 181.0
    for snap in _arrival_snapshots.values():
        if snap.get("matchKey") != match_key or snap.get("status") == "arrived":
            continue
        try:
            snap_pred = datetime.fromisoformat(snap["predictedArrivalAt"])
        except (KeyError, ValueError):
            continue
        delta = abs((snap_pred - predicted_at).total_seconds())
        if delta < best_delta:
            best_delta = delta
            best = snap
    return best


def update_arrival_snapshots(
    stop_id: int,
    stop_name: str,
    arrivals: list[dict[str, Any]],
    *,
    now: datetime | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    at = now or now_madrid()
    seen_snapshot_ids: set[str] = set()
    for arrival in arrivals:
        predicted_at = at + timedelta(minutes=int(arrival["minutes"]))
        match_key = _arrival_match_key(arrival)
        snap = _find_existing_snapshot(match_key, predicted_at)
        if snap is None:
            snap_id = f"{match_key}-{predicted_at.isoformat()}"
            snap = {
                "id": snap_id,
                "matchKey": match_key,
                "stopId": stop_id,
                "line": arrival["line"],
                "destination": arrival.get("destination"),
                "firstSeenAt": at.isoformat(),
                "predictedArrivalAt": predicted_at.isoformat(),
                "predictedMinutesAtFirstSeen": int(arrival["minutes"]),
                "lastSeenAt": at.isoformat(),
                "currentMinutes": int(arrival["minutes"]),
                "status": "pending",
            }
            _arrival_snapshots[snap_id] = snap
        else:
            snap["lastSeenAt"] = at.isoformat()
            snap["currentMinutes"] = int(arrival["minutes"])
        seen_snapshot_ids.add(snap["id"])

    snapshots_for_stop = [
        snap
        for snap in _arrival_snapshots.values()
        if int(snap.get("stopId", -1)) == stop_id and snap.get("status") in {"pending", "delayed"}
    ]

    alerts = []
    for snap in snapshots_for_stop:
        predicted_at = datetime.fromisoformat(snap["predictedArrivalAt"])
        threshold_at = predicted_at + timedelta(minutes=DELAY_THRESHOLD_MINUTES)
        if snap["id"] not in seen_snapshot_ids and at <= threshold_at:
            snap["status"] = "arrived"
            continue
        if at > threshold_at and snap.get("status") != "arrived":
            snap["status"] = "delayed"
            alert_id = f"EMT_DELAY:{snap['id']}"
            alert = {
                "id": alert_id,
                "type": "EMT_DELAY",
                "severity": "warning",
                "title": "Posible retraso EMT",
                "message": (
                    f"La linea {snap['line']} en la parada {stop_name} supera en mas de "
                    f"{DELAY_THRESHOLD_MINUTES} minutos la llegada estimada."
                ),
                "entityType": "emt_line",
                "entityId": f"{stop_id}-{snap['line']}",
                "createdAt": _delay_alerts.get(alert_id, {}).get("createdAt", at.isoformat()),
                "metadata": {
                    "stopId": stop_id,
                    "stopName": stop_name,
                    "line": snap["line"],
                    "destination": snap.get("destination"),
                    "predictedArrivalAt": snap["predictedArrivalAt"],
                    "minutesToTargetStopAtFirstSeen": snap["predictedMinutesAtFirstSeen"],
                    "delayThresholdMinutes": DELAY_THRESHOLD_MINUTES,
                },
            }
            _delay_alerts[alert_id] = alert
            alerts.append(alert)
    return snapshots_for_stop, _dedupe_alerts(alerts)


def reset_arrival_tracking() -> None:
    _arrival_snapshots.clear()
    _delay_alerts.clear()


def _order_stops_heuristic(stops: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if len(stops) < 3:
        return sorted(stops, key=lambda s: (s["lat"], s["lon"]))
    mean_lat = sum(s["lat"] for s in stops) / len(stops)
    mean_lon = sum(s["lon"] for s in stops) / len(stops)
    var_lat = sum((s["lat"] - mean_lat) ** 2 for s in stops)
    var_lon = sum((s["lon"] - mean_lon) ** 2 for s in stops)
    axis = "lat" if var_lat >= var_lon else "lon"
    return sorted(stops, key=lambda s: (s[axis], s["lon" if axis == "lat" else "lat"]))


def calculate_polyline_distances(points: list[dict[str, Any]]) -> list[dict[str, Any]]:
    total = 0.0
    out = []
    prev = None
    for idx, point in enumerate(points):
        enriched = dict(point)
        if prev is not None:
            total += haversine_m(prev["lat"], prev["lon"], enriched["lat"], enriched["lon"])
        enriched["sequence"] = int(enriched.get("sequence", idx))
        enriched["distanceFromStartMeters"] = total
        out.append(enriched)
        prev = enriched
    return out


def interpolate_point_at_distance(
    points: list[dict[str, Any]],
    target_distance_meters: float,
) -> dict[str, float] | None:
    if not points:
        return None
    measured = calculate_polyline_distances(points)
    if target_distance_meters <= 0:
        return {"lat": measured[0]["lat"], "lon": measured[0]["lon"]}
    total = float(measured[-1].get("distanceFromStartMeters") or 0)
    if target_distance_meters >= total:
        return {"lat": measured[-1]["lat"], "lon": measured[-1]["lon"]}
    for prev, cur in zip(measured, measured[1:]):
        d0 = float(prev["distanceFromStartMeters"])
        d1 = float(cur["distanceFromStartMeters"])
        if d0 <= target_distance_meters <= d1:
            span = max(d1 - d0, 0.0001)
            t = (target_distance_meters - d0) / span
            return {
                "lat": float(prev["lat"]) + t * (float(cur["lat"]) - float(prev["lat"])),
                "lon": float(prev["lon"]) + t * (float(cur["lon"]) - float(prev["lon"])),
            }
    return None


def find_nearest_point_on_route(lat: float, lon: float, route: dict[str, Any]) -> dict[str, Any] | None:
    points = route.get("shape") or [
        {"lat": stop["lat"], "lon": stop["lon"], "sequence": stop["sequence"]}
        for stop in route.get("stops", [])
    ]
    measured = calculate_polyline_distances(points)
    best = None
    best_d = float("inf")
    for point in measured:
        d = haversine_m(lat, lon, point["lat"], point["lon"])
        if d < best_d:
            best_d = d
            best = point
    return best


def _gtfs_headers() -> dict[str, str]:
    return {"ApiKey": EMT_GTFS_API_KEY} if EMT_GTFS_API_KEY else {}


def _read_gtfs_table(zf: zipfile.ZipFile, filename: str) -> list[dict[str, str]]:
    try:
        with zf.open(filename) as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            return [dict(row) for row in csv.DictReader(text)]
    except KeyError:
        return []


def _first_text(row: dict[str, Any], *fields: str) -> str:
    for field in fields:
        value = row.get(field)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def _gtfs_stop_id_to_int(stop_id: Any) -> int | None:
    if stop_id in (None, ""):
        return None
    match = re.search(r"\d+", str(stop_id))
    return int(match.group(0)) if match else None


def _parse_gtfs_time_to_seconds(value: Any) -> int | None:
    if value in (None, ""):
        return None
    parts = str(value).strip().split(":")
    if len(parts) != 3:
        return None
    try:
        hours, minutes, seconds = (int(part) for part in parts)
    except ValueError:
        return None
    return hours * 3600 + minutes * 60 + seconds


def _normalize_gtfs_line(route: dict[str, Any]) -> str:
    line = _first_text(route, "route_short_name", "route_id", "route_long_name")
    return line.upper()


def _gtfs_route_color(route: dict[str, Any]) -> str:
    raw = _first_text(route, "route_color").lstrip("#")
    if re.fullmatch(r"[0-9a-fA-F]{6}", raw):
        return f"#{raw.upper()}"
    return "#2563eb"


def _route_id_fragment(value: str) -> str:
    fragment = re.sub(r"[^0-9a-zA-Z_-]+", "-", value.strip())
    return fragment.strip("-") or "route"


def parse_emt_gtfs_routes(content: bytes) -> list[dict[str, Any]]:
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        routes_txt = _read_gtfs_table(zf, "routes.txt")
        trips_txt = _read_gtfs_table(zf, "trips.txt")
        shapes_txt = _read_gtfs_table(zf, "shapes.txt")
        stops_txt = _read_gtfs_table(zf, "stops.txt")
        stop_times_txt = _read_gtfs_table(zf, "stop_times.txt")

    routes_by_id = {_first_text(route, "route_id"): route for route in routes_txt if route.get("route_id")}
    stops_by_id = {_first_text(stop, "stop_id"): stop for stop in stops_txt if stop.get("stop_id")}

    shape_points: dict[str, list[dict[str, Any]]] = {}
    for row in shapes_txt:
        shape_id = _first_text(row, "shape_id")
        if not shape_id:
            continue
        lat = _to_float(row.get("shape_pt_lat"), None)
        lon = _to_float(row.get("shape_pt_lon"), None)
        if lat is None or lon is None:
            continue
        shape_points.setdefault(shape_id, []).append({
            "lat": lat,
            "lon": lon,
            "sequence": _to_int(row.get("shape_pt_sequence"), 0),
        })
    for points in shape_points.values():
        points.sort(key=lambda point: int(point.get("sequence", 0)))

    stop_times_by_trip: dict[str, list[dict[str, str]]] = {}
    for row in stop_times_txt:
        trip_id = _first_text(row, "trip_id")
        if trip_id:
            stop_times_by_trip.setdefault(trip_id, []).append(row)
    for rows in stop_times_by_trip.values():
        rows.sort(key=lambda row: _to_int(row.get("stop_sequence"), 0))

    candidates: dict[tuple[str, str, str], dict[str, Any]] = {}
    for trip in trips_txt:
        route_id = _first_text(trip, "route_id")
        shape_id = _first_text(trip, "shape_id")
        trip_id = _first_text(trip, "trip_id")
        route_meta = routes_by_id.get(route_id)
        shape = shape_points.get(shape_id)
        if not route_meta or not shape or len(shape) < 2:
            continue

        stop_times = stop_times_by_trip.get(trip_id, [])
        first_seconds = next(
            (
                parsed
                for parsed in (_parse_gtfs_time_to_seconds(row.get("arrival_time")) for row in stop_times)
                if parsed is not None
            ),
            None,
        )
        route_stops = []
        for idx, row in enumerate(stop_times):
            stop_id_raw = _first_text(row, "stop_id")
            stop = stops_by_id.get(stop_id_raw)
            stop_id = _gtfs_stop_id_to_int(stop_id_raw)
            if not stop or stop_id is None:
                continue
            seconds = _parse_gtfs_time_to_seconds(row.get("arrival_time"))
            offset = idx * 3
            if first_seconds is not None and seconds is not None:
                offset = max(0, int(round((seconds - first_seconds) / 60)))
            route_stops.append({
                "stopId": stop_id,
                "name": _first_text(stop, "stop_name", "stop_desc") or f"Parada {stop_id}",
                "lat": _to_float(stop.get("stop_lat"), 0.0),
                "lon": _to_float(stop.get("stop_lon"), 0.0),
                "sequence": _to_int(row.get("stop_sequence"), idx),
                "plannedArrivalOffsetMinutes": offset,
            })

        measured_shape = calculate_polyline_distances(shape)
        line = _normalize_gtfs_line(route_meta)
        direction = _first_text(trip, "direction_id") or None
        headsign = _first_text(trip, "trip_headsign")
        long_name = _first_text(route_meta, "route_long_name", "route_desc")
        name = long_name or f"Linea {line}"
        if headsign and headsign.lower() not in name.lower():
            name = f"{name} - {headsign}"

        candidate = {
            "id": (
                f"emt-{_route_id_fragment(line)}-gtfs-"
                f"{_route_id_fragment(direction or 'all')}-{_route_id_fragment(shape_id)}"
            ),
            "line": line,
            "name": name,
            "direction": direction,
            "color": _gtfs_route_color(route_meta),
            "stops": route_stops,
            "shape": measured_shape,
            "source": "gtfs",
            "metadata": {
                "routeId": route_id,
                "tripId": trip_id,
                "shapeId": shape_id,
                "headsign": headsign or None,
            },
        }
        key = (route_id, direction or "", shape_id)
        score = (
            len(route_stops),
            len(measured_shape),
            float(measured_shape[-1].get("distanceFromStartMeters") or 0),
        )
        previous = candidates.get(key)
        if previous is None or score > previous["_score"]:
            candidates[key] = {**candidate, "_score": score}

    routes = []
    for candidate in candidates.values():
        candidate.pop("_score", None)
        routes.append(candidate)
    return sorted(routes, key=lambda route: (str(route.get("line")), str(route.get("direction")), route["id"]))


def _download_url_from_payload(payload: Any) -> str:
    if isinstance(payload, str):
        return payload
    if not isinstance(payload, dict):
        return ""
    containers = [payload]
    result = payload.get("result")
    if isinstance(result, dict):
        containers.append(result)
    elif isinstance(result, str):
        return result
    for container in containers:
        for key in ("url", "downloadUrl", "download_url", "href", "link"):
            value = container.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value
    return ""


def _resolve_gtfs_download_url() -> str:
    if EMT_GTFS_NAP_FILE_ID and EMT_GTFS_API_KEY:
        payload = get_json(
            f"https://nap.transportes.gob.es/api/Fichero/downloadLink/{EMT_GTFS_NAP_FILE_ID}",
            headers=_browser_headers({"Accept": "application/json,*/*", **_gtfs_headers()}),
            timeout=30,
        )
        url = _download_url_from_payload(payload)
        if url:
            return url
    if EMT_GTFS_URL:
        return EMT_GTFS_URL

    payload = get_json(
        f"{EMT_GTFS_RESOURCE_API_URL}?{urllib.parse.urlencode({'id': EMT_GTFS_RESOURCE_ID})}",
        headers=_browser_headers({"Accept": "application/json,*/*"}),
        timeout=20,
    )
    url = _download_url_from_payload(payload)
    if not url:
        raise RuntimeError("No se ha podido resolver el ZIP GTFS de EMT Valencia")
    return url


def _fetch_gtfs_routes() -> tuple[list[dict[str, Any]], str]:
    url = _resolve_gtfs_download_url()
    content = _fetch_binary(url, timeout=60, headers=_gtfs_headers())
    return parse_emt_gtfs_routes(content), url


def _derive_routes_from_stops(stops: list[dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for stop in stops:
        for line in stop.get("lines", []):
            grouped.setdefault(line, []).append(stop)
    routes = []
    for line, line_stops in grouped.items():
        unique = {int(stop["stopId"]): stop for stop in line_stops}
        ordered = _order_stops_heuristic(list(unique.values()))
        if len(ordered) < 2:
            continue
        route_stops = [
            {
                "stopId": int(stop["stopId"]),
                "name": stop["name"],
                "lat": stop["lat"],
                "lon": stop["lon"],
                "sequence": idx,
                "plannedArrivalOffsetMinutes": idx * 3,
            }
            for idx, stop in enumerate(ordered)
        ]
        shape = calculate_polyline_distances([
            {"lat": stop["lat"], "lon": stop["lon"], "sequence": stop["sequence"]}
            for stop in route_stops
        ])
        routes.append({
            "id": f"emt-{line}-derived",
            "line": line,
            "name": f"Linea {line} (aprox.)",
            "direction": None,
            "color": "#2563eb",
            "stops": route_stops,
            "shape": shape,
            "source": "derived_from_stops",
        })
    return routes


def _fetch_official_routes() -> list[dict[str, Any]]:
    if not EMT_ROUTES_URL:
        return []
    data = get_json(EMT_ROUTES_URL, timeout=45)
    features = data.get("features", [])
    routes = []
    for feature in features:
        attrs = _feature_attrs(feature)
        line = _attr(attrs, "linea", "line", "route", "nombre")
        geom = _feature_geometry(feature)
        coords = geom.get("coordinates") or []
        if not line or geom.get("type") != "LineString" or len(coords) < 2:
            continue
        points = calculate_polyline_distances([
            {"lat": float(lat), "lon": float(lon), "sequence": idx}
            for idx, (lon, lat, *_) in enumerate(coords)
        ])
        routes.append({
            "id": str(_attr(attrs, "id", "objectid") or f"emt-{line}"),
            "line": str(line).upper(),
            "name": str(_attr(attrs, "name", "nombre", "denominacion") or f"Linea {line}"),
            "direction": _attr(attrs, "direction", "sentido"),
            "color": _attr(attrs, "color") or "#2563eb",
            "stops": [],
            "shape": points,
            "source": "geoportal",
        })
    return routes


def fetch_emt_routes(line: str | None = None, direction: str | None = None) -> dict[str, Any]:
    cache_key = "mobility:emt:routes"
    cached = get_cached(cache_key)
    if cached is None:
        at = now_madrid()
        source = "geoportal"
        source_label = SOURCE_LABEL
        source_url = EMT_ROUTES_URL
        try:
            routes = _fetch_official_routes()
        except Exception:
            routes = []
        if not routes:
            try:
                routes, source_url = _fetch_gtfs_routes()
                source = "gtfs"
                source_label = GTFS_SOURCE_LABEL
            except Exception:
                routes = []
        if not routes:
            stops_response = fetch_emt_stops()
            routes = _derive_routes_from_stops(stops_response.get("stops", []))
            source = "derived_from_stops"
            source_label = "Paradas EMT Geoportal - rutas aproximadas"
            source_url = EMT_STOPS_URL
        cached = {
            "routes": routes,
            "source": source,
            "sourceLabel": source_label,
            "sourceUrl": source_url,
            "fetchedAt": at.isoformat(),
            "updatedTtlSeconds": EMT_ROUTES_TTL_SECONDS,
            "stale": False,
        }
        set_cached(cache_key, cached, EMT_ROUTES_TTL_SECONDS)

    routes = cached["routes"]
    if line:
        normalized_line = line.upper()
        routes = [route for route in routes if str(route.get("line", "")).upper() == normalized_line]
    if direction:
        routes = [route for route in routes if str(route.get("direction")) == direction]
    return {**cached, "routes": routes}


def _route_contains_stop(route: dict[str, Any], stop_id: int) -> bool:
    return any(int(stop.get("stopId", -1)) == stop_id for stop in route.get("stops", []))


def get_route_for_line(
    line: str,
    direction: str | None = None,
    target_stop_id: int | None = None,
) -> dict[str, Any] | None:
    routes = fetch_emt_routes(line=line, direction=direction).get("routes", [])
    if target_stop_id is not None:
        matching = [route for route in routes if _route_contains_stop(route, target_stop_id)]
        if matching:
            return matching[0]
    return routes[0] if routes else None


def get_stops_for_line(line: str, direction: str | None = None) -> list[dict[str, Any]]:
    route = get_route_for_line(line, direction)
    return route.get("stops", []) if route else []


def estimate_bus_position_on_route(params: dict[str, Any]) -> dict[str, Any] | None:
    route = params["route"]
    target_stop_id = int(params["targetStopId"])
    minutes_to_target = max(0, int(params["minutesToTargetStop"]))
    at = params.get("now") or now_madrid()
    speed_kmh = float(params.get("averageSpeedKmh") or DEFAULT_BUS_SPEED_KMH)
    speed_m_per_min = speed_kmh * 1000 / 60

    stops = route.get("stops", [])
    target_stop = next((stop for stop in stops if int(stop["stopId"]) == target_stop_id), None)
    if target_stop is None and not route.get("shape"):
        return None

    shape = route.get("shape") or [
        {"lat": stop["lat"], "lon": stop["lon"], "sequence": stop["sequence"]}
        for stop in stops
    ]
    if len(shape) < 2:
        return None

    measured = calculate_polyline_distances(shape)
    if target_stop is not None:
        nearest = find_nearest_point_on_route(target_stop["lat"], target_stop["lon"], {**route, "shape": measured})
        target_distance = float(nearest.get("distanceFromStartMeters", 0)) if nearest else 0.0
    elif params.get("targetLat") is not None and params.get("targetLon") is not None:
        nearest = find_nearest_point_on_route(
            float(params["targetLat"]),
            float(params["targetLon"]),
            {**route, "shape": measured},
        )
        target_distance = float(nearest.get("distanceFromStartMeters", 0)) if nearest else 0.0
    else:
        target_distance = float(measured[-1].get("distanceFromStartMeters", 0))

    distance_back = speed_m_per_min * minutes_to_target
    estimated_distance = max(0.0, target_distance - distance_back)
    point = interpolate_point_at_distance(measured, estimated_distance)
    if point is None:
        return None

    prev_stop = None
    next_stop = None
    if stops:
        ordered = sorted(stops, key=lambda s: int(s.get("sequence", 0)))
        target_index = next(
            (idx for idx, stop in enumerate(ordered) if int(stop["stopId"]) == target_stop_id),
            -1,
        )
        if target_index > 0:
            prev_stop = ordered[target_index - 1]
        if target_index >= 0:
            next_stop = ordered[target_index]

    if route.get("source") in {"geoportal", "gtfs"} and route.get("shape"):
        confidence = "high"
        method = "route_shape_interpolation"
        message = "Ubicacion estimada sobre la ruta oficial de la linea."
    elif route.get("source") == "derived_from_stops":
        confidence = "low"
        method = "average_speed_backtracking"
        message = "Estimacion de baja precision basada en tiempo restante y velocidad media."
    else:
        confidence = "medium"
        method = "previous_stop_interpolation"
        message = "Ubicacion aproximada interpolada entre paradas."

    return {
        "id": f"estimated-{route['line']}-{target_stop_id}-{minutes_to_target}",
        "line": route["line"],
        "targetStopId": target_stop_id,
        "estimatedLat": point["lat"],
        "estimatedLon": point["lon"],
        "confidence": confidence,
        "method": method,
        "minutesToTargetStop": minutes_to_target,
        "estimatedDistanceToTargetMeters": int(round(max(0.0, target_distance - estimated_distance))),
        "previousStopId": int(prev_stop["stopId"]) if prev_stop else None,
        "nextStopId": int(next_stop["stopId"]) if next_stop else None,
        "message": message,
        "updatedAt": at.isoformat(),
    }


def _parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ)
    return parsed.astimezone(TZ)


def _freshen_last_good_arrivals(
    last_good: dict[str, Any],
    *,
    now: datetime,
) -> list[dict[str, Any]]:
    arrivals = []
    fetched_at = _parse_datetime(last_good.get("fetchedAt"))
    for arrival in last_good.get("arrivals", []):
        expected_at = _parse_datetime(arrival.get("expectedArrivalTime"))
        if expected_at is not None:
            remaining_seconds = (expected_at - now).total_seconds()
            if remaining_seconds < -(DELAY_THRESHOLD_MINUTES * 60):
                continue
            minutes = max(0, int(math.ceil(remaining_seconds / 60)))
        elif fetched_at is not None:
            age_minutes = max(0, int(math.floor((now - fetched_at).total_seconds() / 60)))
            minutes = max(0, int(arrival.get("minutes", 0)) - age_minutes)
        else:
            minutes = max(0, int(arrival.get("minutes", 0)))

        refreshed = dict(arrival)
        refreshed["minutes"] = minutes
        refreshed["expectedArrivalTime"] = (now + timedelta(minutes=minutes)).isoformat()
        arrivals.append(refreshed)
    return arrivals


def _route_target_offset_minutes(
    route: dict[str, Any],
    *,
    target_stop_id: int,
    target_lat: Any = None,
    target_lon: Any = None,
    speed_kmh: float = DEFAULT_BUS_SPEED_KMH,
) -> float | None:
    speed_m_per_min = max(1.0, speed_kmh * 1000 / 60)
    stops = route.get("stops", [])
    target_stop = next((stop for stop in stops if int(stop["stopId"]) == target_stop_id), None)
    if target_stop and target_stop.get("plannedArrivalOffsetMinutes") is not None:
        return float(target_stop["plannedArrivalOffsetMinutes"])

    shape = route.get("shape") or [
        {"lat": stop["lat"], "lon": stop["lon"], "sequence": stop["sequence"]}
        for stop in stops
    ]
    if len(shape) < 2:
        return None
    measured = calculate_polyline_distances(shape)

    nearest = None
    if target_stop is not None:
        nearest = find_nearest_point_on_route(target_stop["lat"], target_stop["lon"], {**route, "shape": measured})
    elif target_lat is not None and target_lon is not None:
        nearest = find_nearest_point_on_route(float(target_lat), float(target_lon), {**route, "shape": measured})
    if nearest is None:
        nearest = measured[-1]

    target_distance = float(nearest.get("distanceFromStartMeters", 0))
    return target_distance / speed_m_per_min


def _fallback_lines_for_stop(
    selected_stop: dict[str, Any],
    line_id: str | None,
) -> list[str]:
    if line_id:
        return [line_id.upper()]
    lines = []
    for line in selected_stop.get("lines", []):
        normalized = str(line).strip().upper()
        if normalized and normalized not in lines:
            lines.append(normalized)
    return lines[:EMT_FALLBACK_MAX_LINES]


def _parse_gtfs_active_services(zf: zipfile.ZipFile, today_str: str) -> set[str]:
    today = datetime.strptime(today_str, "%Y-%m-%d")
    today_int = int(today.strftime("%Y%m%d"))
    day_name = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")[
        today.weekday()
    ]
    active: set[str] = set()
    for row in _read_gtfs_table(zf, "calendar.txt"):
        try:
            start = int(_first_text(row, "start_date") or "0")
            end = int(_first_text(row, "end_date") or "0")
        except ValueError:
            continue
        if start <= today_int <= end and _first_text(row, day_name) == "1":
            svc = _first_text(row, "service_id")
            if svc:
                active.add(svc)
    today_date_str = today.strftime("%Y%m%d")
    for row in _read_gtfs_table(zf, "calendar_dates.txt"):
        if _first_text(row, "date") != today_date_str:
            continue
        svc = _first_text(row, "service_id")
        exc = _first_text(row, "exception_type")
        if exc == "1":
            active.add(svc)
        elif exc == "2":
            active.discard(svc)
    return active


def _build_gtfs_stop_arrivals(content: bytes, today_str: str) -> dict[int, list[dict[str, Any]]]:
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        active_services = _parse_gtfs_active_services(zf, today_str)
        routes_txt = _read_gtfs_table(zf, "routes.txt")
        trips_txt = _read_gtfs_table(zf, "trips.txt")
        stop_times_txt = _read_gtfs_table(zf, "stop_times.txt")

    line_by_route: dict[str, str] = {
        _first_text(r, "route_id"): _normalize_gtfs_line(r)
        for r in routes_txt
        if _first_text(r, "route_id")
    }
    trip_meta: dict[str, dict[str, str]] = {}
    for trip in trips_txt:
        svc = _first_text(trip, "service_id")
        if svc not in active_services:
            continue
        tid = _first_text(trip, "trip_id")
        if tid:
            trip_meta[tid] = {
                "line": line_by_route.get(_first_text(trip, "route_id"), "?"),
                "destination": _first_text(trip, "trip_headsign"),
            }
    index: dict[int, list[dict[str, Any]]] = {}
    for row in stop_times_txt:
        tid = _first_text(row, "trip_id")
        meta = trip_meta.get(tid)
        if meta is None:
            continue
        stop_id = _gtfs_stop_id_to_int(_first_text(row, "stop_id"))
        if stop_id is None:
            continue
        secs = _parse_gtfs_time_to_seconds(row.get("arrival_time"))
        if secs is None:
            continue
        index.setdefault(stop_id, []).append({
            "line": meta["line"],
            "destination": meta["destination"] or None,
            "arrival_seconds": secs,
        })
    for entries in index.values():
        entries.sort(key=lambda e: e["arrival_seconds"])
    return index


_gtfs_arrivals_cache: dict[str, dict[int, list[dict[str, Any]]]] = {}


def _get_gtfs_arrivals_index(today_str: str) -> dict[int, list[dict[str, Any]]]:
    if today_str in _gtfs_arrivals_cache:
        return _gtfs_arrivals_cache[today_str]
    try:
        url = _resolve_gtfs_download_url()
        content = _fetch_binary(url, timeout=60, headers=_gtfs_headers())
        index = _build_gtfs_stop_arrivals(content, today_str)
        _gtfs_arrivals_cache.clear()
        _gtfs_arrivals_cache[today_str] = index
        return index
    except Exception:
        return {}


def _gtfs_next_arrivals(
    stop_id: int,
    now: datetime,
    line_id: str | None = None,
    max_results: int = 6,
    max_minutes_ahead: int = 90,
) -> list[dict[str, Any]]:
    today_str = now.strftime("%Y-%m-%d")
    index = _get_gtfs_arrivals_index(today_str)
    entries = index.get(stop_id, [])
    now_secs = now.hour * 3600 + now.minute * 60 + now.second

    def _collect(cutoff_secs: int, max_per_line: int) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        seen_lines: dict[str, int] = {}
        for entry in entries:
            arr_secs = entry["arrival_seconds"]
            if arr_secs <= now_secs:
                continue
            if arr_secs > cutoff_secs:
                break
            line = str(entry["line"])
            if line_id and line.upper() != str(line_id).upper():
                continue
            if seen_lines.get(line, 0) >= max_per_line:
                continue
            minutes = max(0, int(round((arr_secs - now_secs) / 60)))
            results.append({
                "stopId": stop_id,
                "line": line,
                "destination": entry.get("destination"),
                "minutes": minutes,
                "expectedArrivalTime": (now + timedelta(minutes=minutes)).isoformat(),
            })
            seen_lines[line] = seen_lines.get(line, 0) + 1
            if len(results) >= max_results:
                break
        return results

    results = _collect(now_secs + max_minutes_ahead * 60, 2)
    if not results:
        # Fuera de servicio o horario nocturno: mostrar próximo bus aunque esté lejos
        results = _collect(now_secs + 8 * 3600, 1)
    return results


def _fallback_arrivals_from_routes(
    *,
    stop_id: int,
    selected_stop: dict[str, Any],
    line_id: str | None,
    now: datetime,
) -> list[dict[str, Any]]:
    arrivals = []
    headway = max(5, EMT_FALLBACK_HEADWAY_MINUTES)
    minutes_since_midnight = now.hour * 60 + now.minute + (now.second / 60)
    for line in _fallback_lines_for_stop(selected_stop, line_id):
        try:
            route = get_route_for_line(line, target_stop_id=stop_id)
        except Exception:
            route = None
        if not route:
            continue

        offset = _route_target_offset_minutes(
            route,
            target_stop_id=stop_id,
            target_lat=selected_stop.get("lat"),
            target_lon=selected_stop.get("lon"),
        )
        if offset is None:
            continue
        remaining = (offset - minutes_since_midnight) % headway
        minutes = int(round(remaining))
        if minutes >= headway:
            minutes = 0
        metadata = route.get("metadata") or {}
        destination = metadata.get("headsign") or route.get("name")
        arrivals.append({
            "stopId": stop_id,
            "line": line,
            "destination": destination,
            "minutes": max(0, minutes),
            "expectedArrivalTime": (now + timedelta(minutes=max(0, minutes))).isoformat(),
            "raw": {
                "fallback": "route_headway_estimate",
                "headwayMinutes": headway,
                "routeSource": route.get("source"),
            },
        })
    return arrivals


def _build_estimated_positions(
    *,
    stop_id: int,
    selected_stop: dict[str, Any],
    arrivals: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    now: datetime,
    fallback_note: str | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    estimated_positions = []
    routes_used = []
    route_ids_used: set[str] = set()
    for arrival in arrivals[:6]:
        try:
            route = get_route_for_line(arrival["line"], target_stop_id=stop_id)
        except Exception:
            route = None
        if not route:
            continue
        estimate = estimate_bus_position_on_route({
            "route": route,
            "targetStopId": stop_id,
            "targetLat": selected_stop.get("lat"),
            "targetLon": selected_stop.get("lon"),
            "minutesToTargetStop": arrival["minutes"],
            "now": now,
        })
        if estimate is None:
            continue
        if fallback_note:
            estimate["confidence"] = "low"
            estimate["method"] = "average_speed_backtracking"
            estimate["message"] = fallback_note
        matching_alert = next(
            (
                alert
                for alert in alerts
                if (alert.get("metadata") or {}).get("line") == arrival["line"]
                and (alert.get("metadata") or {}).get("destination") == arrival.get("destination")
            ),
            None,
        )
        if matching_alert:
            estimate["delayed"] = True
            matching_alert.setdefault("metadata", {})["estimatedPosition"] = estimate
        estimated_positions.append({
            **estimate,
            "destination": arrival.get("destination"),
            "sourceNote": fallback_note or "Posicion estimada, no GPS real.",
        })
        route_id = str(route.get("id"))
        if route_id not in route_ids_used:
            routes_used.append(route)
            route_ids_used.add(route_id)
    return estimated_positions, routes_used


def _emt_arrivals_response(
    *,
    stop_id: int,
    stop_name: str,
    selected_stop: dict[str, Any],
    arrivals: list[dict[str, Any]],
    snapshots: list[dict[str, Any]],
    alerts: list[dict[str, Any]],
    source: str,
    source_label: str,
    source_url: str,
    fetched_at: datetime,
    stale: bool,
    error: str | None = None,
    fallback_note: str | None = None,
) -> dict[str, Any]:
    estimated_positions, routes_used = _build_estimated_positions(
        stop_id=stop_id,
        selected_stop=selected_stop,
        arrivals=arrivals,
        alerts=alerts,
        now=fetched_at,
        fallback_note=fallback_note,
    )
    out = {
        "stopId": stop_id,
        "stopName": stop_name,
        "arrivals": arrivals,
        "snapshots": snapshots,
        "alerts": _dedupe_alerts(alerts),
        "estimatedPositions": estimated_positions,
        "routes": routes_used,
        "source": source,
        "sourceLabel": source_label,
        "sourceUrl": source_url,
        "fetchedAt": fetched_at.isoformat(),
        "updatedTtlSeconds": EMT_ARRIVALS_TTL_SECONDS,
        "stale": stale,
    }
    if error:
        out["error"] = error
    return out


def fetch_emt_arrivals(stop_id: int, line_id: str | None = None) -> dict[str, Any]:
    cache_key = f"mobility:emt:arrivals:{stop_id}:{line_id or 'all'}"
    last_good_cache_key = f"{cache_key}:last_good"
    cached = get_cached(cache_key)
    if cached is not None:
        return cached

    at = now_madrid()
    stop_lookup = {int(stop["stopId"]): stop for stop in fetch_emt_stops().get("stops", [])}
    selected_stop = stop_lookup.get(stop_id, {})
    stop_name = selected_stop.get("name", f"Parada {stop_id}")
    params = {"sec": "getSAE", "parada": str(stop_id), "adaptados": "false"}
    if line_id:
        params["linea"] = line_id
    url = f"{EMT_ARRIVALS_URL}?{urllib.parse.urlencode(params)}"

    try:
        text = _fetch_text(url, timeout=EMT_ARRIVALS_TIMEOUT_SECONDS)
        arrivals = parse_emt_arrivals_text(text, stop_id)
        if line_id:
            arrivals = [a for a in arrivals if str(a["line"]).upper() == line_id.upper()]
        for arrival in arrivals:
            arrival["expectedArrivalTime"] = (at + timedelta(minutes=arrival["minutes"])).isoformat()
        snapshots, alerts = update_arrival_snapshots(stop_id, stop_name, arrivals, now=at)
        if not arrivals:
            gtfs_arrivals = _gtfs_next_arrivals(stop_id, at, line_id=line_id)
            if gtfs_arrivals:
                out = _emt_arrivals_response(
                    stop_id=stop_id,
                    stop_name=stop_name,
                    selected_stop=selected_stop,
                    arrivals=gtfs_arrivals,
                    snapshots=snapshots,
                    alerts=alerts,
                    source="gtfs_schedule",
                    source_label="Horario GTFS EMT Valencia",
                    source_url=url,
                    fetched_at=at,
                    stale=True,
                    error="SAE EMT no ha devuelto llegadas. Mostrando horario programado GTFS.",
                    fallback_note="Horario programado GTFS Valencia. Sin GPS real; puede no reflejar incidencias.",
                )
                set_cached(cache_key, out, min(30, EMT_ARRIVALS_TTL_SECONDS))
                return out
            fallback_arrivals = _fallback_arrivals_from_routes(
                stop_id=stop_id,
                selected_stop=selected_stop,
                line_id=line_id,
                now=at,
            )
            if fallback_arrivals:
                out = _emt_arrivals_response(
                    stop_id=stop_id,
                    stop_name=stop_name,
                    selected_stop=selected_stop,
                    arrivals=fallback_arrivals,
                    snapshots=snapshots,
                    alerts=alerts,
                    source="estimated_route",
                    source_label="Estimacion local por ruta EMT",
                    source_url=url,
                    fetched_at=at,
                    stale=True,
                    error="SAE EMT no ha devuelto llegadas. Mostrando estimacion por ruta.",
                    fallback_note=(
                        "Estimacion sin llegadas SAE: ETA aproximada por ruta, velocidad media "
                        "y frecuencia media."
                    ),
                )
                set_cached(cache_key, out, min(15, EMT_ARRIVALS_TTL_SECONDS))
                return out
        out = _emt_arrivals_response(
            stop_id=stop_id,
            stop_name=stop_name,
            selected_stop=selected_stop,
            arrivals=arrivals,
            snapshots=snapshots,
            alerts=alerts,
            source="emt_sae",
            source_label=SAE_SOURCE_LABEL,
            source_url=url,
            fetched_at=at,
            stale=False,
        )
        set_cached(cache_key, out, EMT_ARRIVALS_TTL_SECONDS)
        set_cached(last_good_cache_key, out, EMT_ARRIVALS_LAST_GOOD_TTL_SECONDS)
        return out
    except Exception as exc:
        error = f"SAE EMT no responde ({exc}). Mostrando estimacion disponible."
        last_good = get_cached(last_good_cache_key)
        if last_good is not None:
            stale_arrivals = _freshen_last_good_arrivals(last_good, now=at)
            if stale_arrivals:
                out = _emt_arrivals_response(
                    stop_id=stop_id,
                    stop_name=stop_name,
                    selected_stop=selected_stop,
                    arrivals=stale_arrivals,
                    snapshots=last_good.get("snapshots", []),
                    alerts=last_good.get("alerts", []),
                    source="emt_sae_stale",
                    source_label=SAE_SOURCE_LABEL,
                    source_url=url,
                    fetched_at=at,
                    stale=True,
                    error=error,
                    fallback_note=(
                        "Estimacion recalculada desde la ultima respuesta SAE disponible; "
                        "no es GPS real."
                    ),
                )
                set_cached(cache_key, out, min(15, EMT_ARRIVALS_TTL_SECONDS))
                return out

        gtfs_arrivals = _gtfs_next_arrivals(stop_id, at, line_id=line_id)
        if gtfs_arrivals:
            out = _emt_arrivals_response(
                stop_id=stop_id,
                stop_name=stop_name,
                selected_stop=selected_stop,
                arrivals=gtfs_arrivals,
                snapshots=[],
                alerts=[],
                source="gtfs_schedule",
                source_label="Horario GTFS EMT Valencia",
                source_url=url,
                fetched_at=at,
                stale=True,
                error=error,
                fallback_note="Horario programado GTFS Valencia. Sin GPS real; puede no reflejar incidencias.",
            )
            set_cached(cache_key, out, min(30, EMT_ARRIVALS_TTL_SECONDS))
            return out
        fallback_arrivals = _fallback_arrivals_from_routes(
            stop_id=stop_id,
            selected_stop=selected_stop,
            line_id=line_id,
            now=at,
        )
        if fallback_arrivals:
            out = _emt_arrivals_response(
                stop_id=stop_id,
                stop_name=stop_name,
                selected_stop=selected_stop,
                arrivals=fallback_arrivals,
                snapshots=[],
                alerts=[],
                source="estimated_route",
                source_label="Estimacion local por ruta EMT",
                source_url=url,
                fetched_at=at,
                stale=True,
                error=error,
                fallback_note=(
                    "Estimacion sin SAE: ETA aproximada por ruta, velocidad media y frecuencia media."
                ),
            )
            set_cached(cache_key, out, min(15, EMT_ARRIVALS_TTL_SECONDS))
            return out

        return {
            "stopId": stop_id,
            "stopName": stop_name,
            "arrivals": [],
            "snapshots": [],
            "alerts": [],
            "estimatedPositions": [],
            "routes": [],
            "source": "unavailable",
            "sourceLabel": SAE_SOURCE_LABEL,
            "sourceUrl": url,
            "fetchedAt": at.isoformat(),
            "updatedTtlSeconds": EMT_ARRIVALS_TTL_SECONDS,
            "stale": True,
            "error": error,
        }


def mobility_alerts() -> dict[str, Any]:
    valenbisi = fetch_valenbisi_stations()
    alerts = list(valenbisi.get("alerts", [])) + list(_delay_alerts.values())
    alerts = sorted(_dedupe_alerts(alerts), key=_severity_order)
    return {
        "alerts": alerts,
        "counts": {
            "critical": sum(1 for alert in alerts if alert.get("severity") == "critical"),
            "warning": sum(1 for alert in alerts if alert.get("severity") == "warning"),
            "info": sum(1 for alert in alerts if alert.get("severity") == "info"),
        },
        "fetchedAt": now_madrid().isoformat(),
    }


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return haversine_m(lat1, lon1, lat2, lon2)
