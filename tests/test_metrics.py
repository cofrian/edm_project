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
