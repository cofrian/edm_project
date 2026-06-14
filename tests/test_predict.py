def test_predict_shape(client):
    payload = {"zona": 1, "hora": 8, "dia_semana": 1, "temp_c": 20, "hum_rel": 60}
    r = client.post("/predict", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert "intensidad" in body
    assert body["nivel"] in ("baja", "media", "alta")


def test_predict_validation(client):
    # hora fuera de rango -> 422
    r = client.post("/predict", json={"zona": 1, "hora": 30, "dia_semana": 1})
    assert r.status_code == 422
