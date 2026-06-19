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
    assert "coverage_data" in body


def test_map_population_hexes(client):
    r = client.get("/map/population-hexes?facility_type=sports")
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert isinstance(body["features"], list)


def test_map_candidates_facilities(client):
    r = client.get("/map/candidates-facilities")
    assert r.status_code == 200
    body = r.json()
    assert body["type"] == "FeatureCollection"
    assert len(body["features"]) > 0


def test_map_covered_hexes(client):
    r = client.post(
        "/map/covered-hexes",
        json={"candidate_ids": [0, 1], "facility_type": "sports"},
    )
    assert r.status_code == 200
    assert r.json()["type"] == "FeatureCollection"


def test_coverage_summary(client):
    r = client.get("/coverage/summary")
    assert r.status_code == 200
    body = r.json()
    assert "n_candidates" in body
    assert "hexes_need_sports" in body
