from __future__ import annotations

import io
import zipfile
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from src.integrations import mobility
from src.ttl_cache import clear_cache, set_cached

TZ = ZoneInfo("Europe/Madrid")


def _gtfs_zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        for filename, content in files.items():
            zf.writestr(filename, content)
    return buffer.getvalue()


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


def test_parse_emt_gtfs_routes_uses_shapes_and_stops():
    content = _gtfs_zip({
        "routes.txt": (
            "route_id,route_short_name,route_long_name,route_color\n"
            "R32,32,Sants Just i Pastor - Passeig Maritim,FF6600\n"
        ),
        "trips.txt": (
            "route_id,service_id,trip_id,trip_headsign,direction_id,shape_id\n"
            "R32,WK,T32A,Maritim,0,SH32\n"
        ),
        "shapes.txt": (
            "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n"
            "SH32,39.4740,-0.3600,1\n"
            "SH32,39.4750,-0.3580,2\n"
            "SH32,39.4760,-0.3560,3\n"
        ),
        "stops.txt": (
            "stop_id,stop_name,stop_lat,stop_lon\n"
            "136,Sants Just i Pastor - Lleons,39.4740,-0.3600\n"
            "137,Lleons - Doctor Manuel Candela,39.4750,-0.3580\n"
        ),
        "stop_times.txt": (
            "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
            "T32A,08:00:00,08:00:00,136,1\n"
            "T32A,08:04:00,08:04:00,137,2\n"
        ),
    })

    routes = mobility.parse_emt_gtfs_routes(content)

    assert len(routes) == 1
    route = routes[0]
    assert route["source"] == "gtfs"
    assert route["line"] == "32"
    assert route["color"] == "#FF6600"
    assert route["metadata"]["shapeId"] == "SH32"
    assert len(route["shape"]) == 3
    assert route["shape"][-1]["distanceFromStartMeters"] > 0
    assert route["stops"][0]["stopId"] == 136
    assert route["stops"][1]["plannedArrivalOffsetMinutes"] == 4


def test_get_route_for_line_prefers_route_containing_target_stop(monkeypatch):
    route_without_stop = {"id": "a", "line": "32", "stops": [{"stopId": 999}], "shape": []}
    route_with_stop = {"id": "b", "line": "32", "stops": [{"stopId": 136}], "shape": []}

    monkeypatch.setattr(
        mobility,
        "fetch_emt_routes",
        lambda line=None, direction=None: {"routes": [route_without_stop, route_with_stop]},
    )

    assert mobility.get_route_for_line("32", target_stop_id=136)["id"] == "b"


def test_fetch_emt_routes_prefers_gtfs_before_derived(monkeypatch):
    clear_cache()
    gtfs_route = {"id": "gtfs-32", "line": "32", "source": "gtfs", "stops": [], "shape": []}

    monkeypatch.setattr(mobility, "_fetch_official_routes", lambda: [])
    monkeypatch.setattr(mobility, "_fetch_gtfs_routes", lambda: ([gtfs_route], "https://example.test/gtfs.zip"))

    response = mobility.fetch_emt_routes()

    assert response["source"] == "gtfs"
    assert response["sourceUrl"] == "https://example.test/gtfs.zip"
    assert response["routes"] == [gtfs_route]


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


def test_estimate_bus_position_uses_target_coordinates_when_stop_not_in_gtfs():
    route = {
        "id": "line-32",
        "line": "32",
        "source": "gtfs",
        "stops": [],
        "shape": [
            {"lat": 0.0, "lon": 0.0, "sequence": 0},
            {"lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
    }

    estimate = mobility.estimate_bus_position_on_route({
        "route": route,
        "targetStopId": 136,
        "targetLat": 0.0,
        "targetLon": 0.02,
        "minutesToTargetStop": 1,
        "now": datetime(2026, 6, 22, 12, tzinfo=TZ),
        "averageSpeedKmh": 60,
    })

    assert estimate is not None
    assert estimate["confidence"] == "high"
    assert estimate["method"] == "route_shape_interpolation"
    assert 0.009 < estimate["estimatedLon"] < 0.013


def test_fetch_emt_arrivals_uses_last_good_on_timeout(monkeypatch):
    clear_cache()
    at = datetime(2026, 6, 22, 12, 0, tzinfo=TZ)
    stale_at = at + timedelta(minutes=2)
    stop = {
        "id": "739",
        "stopId": 739,
        "name": "Parada 739",
        "lines": ["10"],
        "lat": 0.0,
        "lon": 0.02,
    }
    route = {
        "id": "line-10",
        "line": "10",
        "source": "gtfs",
        "stops": [
            {"stopId": 1, "name": "A", "lat": 0.0, "lon": 0.0, "sequence": 0},
            {"stopId": 739, "name": "B", "lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
        "shape": [
            {"lat": 0.0, "lon": 0.0, "sequence": 0},
            {"lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
    }
    last_good = {
        "stopId": 739,
        "stopName": "Parada 739",
        "arrivals": [{
            "stopId": 739,
            "line": "10",
            "destination": "Centro",
            "minutes": 5,
            "expectedArrivalTime": (at + timedelta(minutes=5)).isoformat(),
        }],
        "snapshots": [],
        "alerts": [],
        "estimatedPositions": [],
        "routes": [],
        "source": "emt_sae",
        "sourceLabel": "EMT Valencia SAE",
        "sourceUrl": "",
        "fetchedAt": at.isoformat(),
        "updatedTtlSeconds": 45,
        "stale": False,
    }
    set_cached("mobility:emt:arrivals:739:all:last_good", last_good, 900)

    monkeypatch.setattr(mobility, "now_madrid", lambda: stale_at)
    monkeypatch.setattr(mobility, "fetch_emt_stops", lambda: {"stops": [stop]})
    monkeypatch.setattr(mobility, "_fetch_text", lambda *args, **kwargs: (_ for _ in ()).throw(TimeoutError("timed out")))
    monkeypatch.setattr(mobility, "get_route_for_line", lambda *args, **kwargs: route)

    response = mobility.fetch_emt_arrivals(739)

    assert response["source"] == "emt_sae_stale"
    assert response["stale"] is True
    assert response["arrivals"][0]["minutes"] == 3
    assert response["estimatedPositions"][0]["confidence"] == "low"
    assert response["routes"][0]["id"] == "line-10"
    assert "SAE EMT no responde" in response["error"]


def test_fetch_emt_arrivals_estimates_from_route_when_sae_has_no_history(monkeypatch):
    clear_cache()
    at = datetime(2026, 6, 22, 12, 9, tzinfo=TZ)
    stop = {
        "id": "739",
        "stopId": 739,
        "name": "Parada 739",
        "lines": ["10"],
        "lat": 0.0,
        "lon": 0.02,
    }
    route = {
        "id": "line-10",
        "line": "10",
        "name": "Linea 10",
        "source": "gtfs",
        "stops": [
            {"stopId": 1, "name": "A", "lat": 0.0, "lon": 0.0, "sequence": 0},
            {"stopId": 739, "name": "B", "lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
        "shape": [
            {"lat": 0.0, "lon": 0.0, "sequence": 0},
            {"lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
    }

    monkeypatch.setattr(mobility, "now_madrid", lambda: at)
    monkeypatch.setattr(mobility, "fetch_emt_stops", lambda: {"stops": [stop]})
    monkeypatch.setattr(mobility, "_fetch_text", lambda *args, **kwargs: (_ for _ in ()).throw(TimeoutError("timed out")))
    monkeypatch.setattr(mobility, "get_route_for_line", lambda *args, **kwargs: route)

    response = mobility.fetch_emt_arrivals(739)

    assert response["source"] == "estimated_route"
    assert response["stale"] is True
    assert response["arrivals"][0]["line"] == "10"
    assert response["arrivals"][0]["raw"]["fallback"] == "route_headway_estimate"
    assert response["estimatedPositions"][0]["method"] == "average_speed_backtracking"
    assert response["estimatedPositions"][0]["confidence"] == "low"


def test_fetch_emt_arrivals_estimates_from_route_when_sae_returns_empty(monkeypatch):
    clear_cache()
    at = datetime(2026, 6, 22, 12, 9, tzinfo=TZ)
    stop = {
        "id": "1951",
        "stopId": 1951,
        "name": "Pere II El Cerimonios",
        "lines": ["35"],
        "lat": 0.0,
        "lon": 0.02,
    }
    route = {
        "id": "line-35",
        "line": "35",
        "name": "Linea 35",
        "source": "gtfs",
        "stops": [
            {"stopId": 1, "name": "A", "lat": 0.0, "lon": 0.0, "sequence": 0},
            {"stopId": 1951, "name": "B", "lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
        "shape": [
            {"lat": 0.0, "lon": 0.0, "sequence": 0},
            {"lat": 0.0, "lon": 0.02, "sequence": 1},
        ],
    }

    monkeypatch.setattr(mobility, "now_madrid", lambda: at)
    monkeypatch.setattr(mobility, "fetch_emt_stops", lambda: {"stops": [stop]})
    monkeypatch.setattr(mobility, "_fetch_text", lambda *args, **kwargs: "")
    monkeypatch.setattr(mobility, "get_route_for_line", lambda *args, **kwargs: route)

    response = mobility.fetch_emt_arrivals(1951)

    assert response["source"] == "estimated_route"
    assert response["stale"] is True
    assert response["arrivals"][0]["line"] == "35"
    assert response["routes"][0]["id"] == "line-35"
    assert "no ha devuelto llegadas" in response["error"]
