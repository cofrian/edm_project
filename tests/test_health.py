def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_metadata(client):
    r = client.get("/metadata")
    assert r.status_code == 200
    body = r.json()
    assert "model" in body
    assert "data_date" in body
