def test_metrics_global(client):
    r = client.get("/metrics/global")
    assert r.status_code == 200
    body = r.json()
    # Si hay artefactos, deben contener las 4 métricas clave
    if body:
        for k in ["MAE", "RMSE", "R2", "sMAPE"]:
            assert k in body


def test_metrics_by_hour(client):
    r = client.get("/metrics/by-hour")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_metrics_hour_detail(client):
    r = client.get("/metrics/hour/8")
    assert r.status_code == 200
    body = r.json()
    assert body["hora"] == 8
    assert "global" in body


def test_errors_by_zone_with_street(client):
    r = client.get("/metrics/errors-by-zone", params={"top": 3, "hora": 8})
    assert r.status_code == 200
    rows = r.json()
    if rows:
        assert "descripcion" in rows[0]


def test_monitoring_zones_to_review(client):
    r = client.get("/monitoring/zones-to-review", params={"hora": 8})
    assert r.status_code == 200
    body = r.json()
    assert body["hora"] == 8
    assert "zones_high_pressure" in body


def test_monitoring_system(client):
    r = client.get("/monitoring/system")
    assert r.status_code == 200
    assert "available" in r.json()
