from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from src.integrations import mobility

TZ = ZoneInfo("Europe/Madrid")


def _valenbisi_feature(open_value=True, available=4, free=6):
    return {
        "attributes": {
            "number": 12,
            "name": "Mestalla",
            "address": "Av. Aragon",
            "open": open_value,
            "available": available,
            "free": free,
            "total": 10,
        },
        "geometry": {"x": -0.358, "y": 39.4745},
    }


def test_valenbisi_station_statuses_and_alerts():
    at = datetime(2026, 6, 22, 12, tzinfo=TZ)

    ok = mobility.normalize_valenbisi_station(_valenbisi_feature(), now=at)
    empty = mobility.normalize_valenbisi_station(_valenbisi_feature(available=0), now=at)
    full = mobility.normalize_valenbisi_station(_valenbisi_feature(free=0), now=at)
    closed = mobility.normalize_valenbisi_station(_valenbisi_feature(open_value=False), now=at)

    assert ok["status"] == "ok"
    assert empty["status"] == "empty"
    assert empty["alerts"][0]["type"] == "VALENBISI_EMPTY"
    assert full["status"] == "full"
    assert full["alerts"][0]["type"] == "VALENBISI_FULL"
    assert closed["status"] == "closed"
    assert closed["alerts"][0]["type"] == "VALENBISI_CLOSED"


def test_haversine_and_event_alerts():
    at = datetime(2026, 6, 22, 12, tzinfo=TZ)
    station = mobility.normalize_valenbisi_station(_valenbisi_feature(), now=at)
    near = {
        "id": "mestalla-event",
        "name": "Evento Mestalla",
        "lat": 39.4747,
        "lon": -0.3583,
    }
    far = {
        "id": "far-event",
        "name": "Evento lejano",
        "lat": 39.55,
        "lon": -0.25,
    }

    assert mobility.haversine_distance_meters(39.4745, -0.358, 39.4745, -0.358) == 0
    assert mobility.haversine_distance_meters(39.4745, -0.358, 39.4755, -0.358) < 120

    nearby = mobility.get_stations_near_events([station], [near], radius_meters=1000)
    outside = mobility.get_stations_near_events([station], [far], radius_meters=1000)
    enriched = mobility.add_event_alerts_to_stations([station], [near], now=at)

    assert nearby == [station]
    assert outside == []
    assert enriched[0]["status"] == "watch_event_area"
    assert enriched[0]["alerts"][0]["type"] == "VALENBISI_NEAR_EVENT"


def test_emt_arrivals_parser_xml_empty_and_json():
    xml = """
    <root>
      <bus><linea>10</linea><destino>Centro</destino><minutos>5</minutos></bus>
    </root>
    """
    parsed_xml = mobility.parse_emt_arrivals_text(xml, 739)
    parsed_empty = mobility.parse_emt_arrivals_text("", 739)
    parsed_json = mobility.parse_emt_arrivals_text(
        '{"arrivals":[{"linea":"4","destino":"Natzaret","minutos":"2"}]}',
        739,
    )

    assert parsed_xml[0]["line"] == "10"
    assert parsed_xml[0]["minutes"] == 5
    assert parsed_empty == []
    assert parsed_json[0]["line"] == "4"
    assert parsed_json[0]["destination"] == "Natzaret"


def test_emt_delay_detection_dedupes_alerts():
    mobility.reset_arrival_tracking()
    first_seen = datetime(2026, 6, 22, 12, 0, tzinfo=TZ)
    late = first_seen + timedelta(minutes=5)
    arrivals = [{"stopId": 739, "line": "10", "destination": "Centro", "minutes": 1}]

    snapshots, alerts = mobility.update_arrival_snapshots(739, "Parada 739", arrivals, now=first_seen)
    assert snapshots[0]["status"] == "pending"
    assert alerts == []

    delayed_snapshots, delayed_alerts = mobility.update_arrival_snapshots(739, "Parada 739", [], now=late)
    repeated_snapshots, repeated_alerts = mobility.update_arrival_snapshots(739, "Parada 739", [], now=late)

    assert delayed_snapshots[0]["status"] == "delayed"
    assert delayed_alerts[0]["type"] == "EMT_DELAY"
    assert repeated_snapshots[0]["status"] == "delayed"
    assert repeated_alerts[0]["id"] == delayed_alerts[0]["id"]


def test_estimate_bus_position_on_route_and_missing_route():
    route = {
        "id": "line-10",
        "line": "10",
        "source": "geoportal",
        "stops": [
            {"stopId": 1, "name": "A", "lat": 0.0, "lon": 0.0, "sequence": 0},
            {"stopId": 2, "name": "B", "lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
        "shape": [
            {"lat": 0.0, "lon": 0.0, "sequence": 0},
            {"lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
    }

    estimate = mobility.estimate_bus_position_on_route({
        "route": route,
        "targetStopId": 2,
        "minutesToTargetStop": 1,
        "now": datetime(2026, 6, 22, 12, tzinfo=TZ),
        "averageSpeedKmh": 60,
    })
    missing = mobility.estimate_bus_position_on_route({
        "route": {"id": "bad", "line": "0", "source": "mock", "stops": [], "shape": []},
        "targetStopId": 99,
        "minutesToTargetStop": 1,
        "now": datetime(2026, 6, 22, 12, tzinfo=TZ),
    })

    assert estimate is not None
    assert estimate["confidence"] == "high"
    assert estimate["method"] == "route_shape_interpolation"
    assert 0.009 < estimate["estimatedLon"] < 0.013
    assert missing is None
