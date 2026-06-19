"""Tests de mapa en vivo, eventos, meteo y tráfico (con mocks HTTP)."""

from __future__ import annotations

from unittest.mock import patch


def test_map_zones(client):
    r = client.get("/map/zones")
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert len(body.get("features", [])) > 0


def test_predict_heatmap(client):
    r = client.get("/predict/heatmap", params={"hora": 8, "fecha": "2026-06-14"})
    assert r.status_code == 200
    body = r.json()
    assert body["hora"] == 8
    assert body["n_points"] > 0
    assert "geojson" in body
    assert len(body["points"]) == body["n_points"]


def test_predict_hour_post(client):
    payload = {
        "fecha": "2026-06-14",
        "hora": 18,
        "dia_semana": 6,
        "use_live_weather": False,
        "apply_events": True,
    }
    r = client.post("/predict/hour", json=payload)
    assert r.status_code == 200
    assert r.json()["hora"] == 18


def test_events_list(client):
    r = client.get("/events", params={"from": "2026-06-14", "to": "2026-07-15"})
    assert r.status_code == 200
    body = r.json()
    assert body["count"] > 0
    assert len(body["events"]) == body["count"]
    assert body["events"][0].get("imagen")


@patch("src.integrations.aemet._open_meteo_current")
def test_weather_open_meteo_fallback(mock_meteo, client):
    mock_meteo.return_value = {
        "temp_c": 22.0,
        "hum_rel": 48.0,
        "pres_mb": 1018.0,
        "vel_viento_ms": 4.0,
        "vel_viento_max_ms": 8.0,
        "dir_viento_grados": 180.0,
        "precip_lm2": 0.0,
        "source": "open-meteo",
    }
    from src.ttl_cache import clear_cache
    clear_cache()
    with patch.dict("os.environ", {}, clear=True):
        from src.integrations import aemet
        clear_cache()
        w = aemet.current_weather()
    assert w["source"] == "open-meteo"
    assert w["temp_c"] == 22.0


def test_weather_current(client):
    r = client.get("/weather/current")
    assert r.status_code == 200
    body = r.json()
    assert "temp_c" in body
    assert "hum_rel" in body


def test_weather_forecast(client):
    r = client.get("/weather/forecast", params={"fecha": "2026-07-01"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["hours"]) == 24


@patch("src.integrations.valencia_traffic._fetch_geojson")
def test_traffic_live_lowercase_estado(mock_fetch, client):
    mock_fetch.return_value = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[-0.37, 39.47], [-0.36, 39.48]],
            },
            "properties": {"idtramo": 99, "denominacion": "TEST VIA", "estado": 2},
        }],
    }
    from src.ttl_cache import clear_cache
    clear_cache()
    r = client.get("/traffic/live")
    assert r.status_code == 200
    body = r.json()
    props = body["features"][0]["properties"]
    assert props["estado"] == 2
    assert props["estado_label"] == "congestionado"
    assert props["color"] == "#ea580c"
    assert body["stats"]["congestionado"] == 1


@patch("src.integrations.valencia_traffic._fetch_geojson")
def test_traffic_live_mock(mock_fetch, client):
    mock_fetch.return_value = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[-0.37, 39.47], [-0.36, 39.48]],
            },
            "properties": {"Idtramo": "T1", "Denominacion": "Test", "Estado": 1},
        }],
    }
    from src.ttl_cache import clear_cache
    clear_cache()
    r = client.get("/traffic/live")
    assert r.status_code == 200
    body = r.json()
    assert len(body["features"]) == 1
    assert body["features"][0]["properties"]["estado_label"] == "denso"


@patch("src.integrations.aemet._aemet_datos")
def test_aemet_parse(mock_datos, client):
    mock_datos.return_value = [{
        "idema": "8416X",
        "observacion": [{
            "ta": "25.5",
            "hr": "60",
            "pres": "1015",
            "vv": "3.2",
            "racha": "7",
            "dv": "90",
            "prec": "0",
        }],
    }]
    from src.ttl_cache import clear_cache
    clear_cache()
    with patch.dict("os.environ", {"AEMET_API_KEY": "test-key"}):
        from src.integrations import aemet
        aemet._api_key.cache_clear() if hasattr(aemet._api_key, "cache_clear") else None
        clear_cache()
        w = aemet.current_weather()
    assert w["temp_c"] == 25.5
    assert w["source"] == "aemet"


def test_event_impact_multiplier():
    from datetime import datetime
    from zoneinfo import ZoneInfo

    from src.event_impact import apply_events_to_intensity

    TZ = ZoneInfo("Europe/Madrid")
    ev = {
        "inicio": "2026-07-11T22:00:00+02:00",
        "fin": "2026-07-11T23:30:00+02:00",
        "lat": 39.4945,
        "lon": -0.3638,
        "radio_metros": 600,
        "factor_max": 1.5,
    }
    at = datetime(2026, 7, 11, 22, 0, tzinfo=TZ)
    boosted = apply_events_to_intensity(100.0, 39.4945, -0.3638, at, [ev])
    assert boosted > 100.0
