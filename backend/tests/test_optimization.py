def test_valenbisi_selects(client):
    r = client.post("/optimize/valenbisi", json={"n": 5})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "valenbisi"
    # Si hay candidatos, debe respetar la restricción sum(x)=N
    if body["n_selected"] > 0:
        assert body["n_selected"] <= 5


def test_coverage_budget(client):
    budget = 50.0
    r = client.post("/optimize/coverage", json={"presupuesto": budget})
    assert r.status_code == 200
    body = r.json()
    assert body["mode"] == "coverage"
    # El coste total no puede superar el presupuesto
    assert body["total_cost"] <= budget + 1e-6


def test_monitoring_alerts(client):
    r = client.get("/monitoring/alerts")
    assert r.status_code == 200
    assert "alerts" in r.json()
