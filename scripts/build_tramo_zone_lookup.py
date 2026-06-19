"""Spatial join tramo Ayuntamiento (capa 192) → zona más cercana."""

from __future__ import annotations

import json
import os
import sys
import urllib.request

import numpy as np
import pandas as pd

from common import OUT_DATA, ZONAS_COORD, ensure_dirs

ARCGIS_ESTADO_URL = (
    "https://geoportal.valencia.es/server/rest/services/OPENDATA/Trafico/MapServer/192/query"
    "?where=1%3D1&outFields=Idtramo,Denominacion,Estado&returnGeometry=true&outSR=4326&f=geojson"
)


def _fetch_estado_geojson() -> dict:
    with urllib.request.urlopen(ARCGIS_ESTADO_URL, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _zonas() -> pd.DataFrame:
    z = pd.read_csv(ZONAS_COORD)
    z = z.rename(columns={c: c.strip() for c in z.columns})
    key_col = "KEY" if "KEY" in z.columns else list(z.columns)[3]
    return pd.DataFrame({
        "Zona": z[key_col].astype(int),
        "lat": z["Lat"].astype(float),
        "lon": z["Lon"].astype(float),
    }).dropna()


def _tramo_centroids_from_geojson(gj: dict) -> pd.DataFrame:
    rows = []
    for feat in gj.get("features") or []:
        if not feat:
            continue
        geom = feat.get("geometry") or {}
        props = feat.get("properties") or {}
        coords = geom.get("coordinates")
        if geom.get("type") != "LineString" or not coords:
            continue
        pts = np.array(coords)
        lon, lat = float(pts[:, 0].mean()), float(pts[:, 1].mean())
        idtramo = props.get("Idtramo", props.get("idtramo", ""))
        if idtramo is None or idtramo == "":
            continue
        rows.append({
            "Idtramo": str(int(idtramo) if isinstance(idtramo, (int, float)) else idtramo),
            "lat": lat,
            "lon": lon,
        })
    return pd.DataFrame(rows)


def _nearest_zone(lat: float, lon: float, zonas: pd.DataFrame) -> int:
    d = (zonas["lat"] - lat) ** 2 + (zonas["lon"] - lon) ** 2
    return int(zonas.loc[d.idxmin(), "Zona"])


def main() -> int:
    ensure_dirs()
    zonas = _zonas()

    try:
        gj = _fetch_estado_geojson()
        tramos = _tramo_centroids_from_geojson(gj)
        print(f"[INFO] Tramos capa 192 Ayuntamiento: {len(tramos)}")
    except Exception as exc:
        print(f"[WARN] No se pudo fetch capa 192: {exc}")
        sample = os.path.join(OUT_DATA, "traffic_segments_sample.geojson")
        tramos = _tramo_centroids_from_geojson(
            json.load(open(sample, encoding="utf-8")) if os.path.exists(sample) else {"features": []},
        )

    if tramos.empty:
        print("[WARN] Sin tramos; lookup vacío")
        pd.DataFrame(columns=["Idtramo", "Zona", "lat", "lon"]).to_csv(
            os.path.join(OUT_DATA, "tramo_zone_lookup.csv"), index=False,
        )
        return 0

    tramos["Zona"] = tramos.apply(
        lambda r: _nearest_zone(r["lat"], r["lon"], zonas), axis=1,
    )
    out = os.path.join(OUT_DATA, "tramo_zone_lookup.csv")
    tramos[["Idtramo", "Zona", "lat", "lon"]].to_csv(out, index=False)
    print(f"[OK] tramo_zone_lookup.csv ({len(tramos)} filas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
