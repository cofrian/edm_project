"""Spatial join tramo tráfico → zona más cercana."""

from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

from common import OUT_DATA, ZONAS_COORD, ensure_dirs


def _zonas() -> pd.DataFrame:
    z = pd.read_csv(ZONAS_COORD)
    z = z.rename(columns={c: c.strip() for c in z.columns})
    key_col = "KEY" if "KEY" in z.columns else list(z.columns)[3]
    return pd.DataFrame({
        "Zona": z[key_col].astype(int),
        "lat": z["Lat"].astype(float),
        "lon": z["Lon"].astype(float),
    }).dropna()


def _tramo_centroids(geojson_path: str) -> pd.DataFrame:
    if not os.path.exists(geojson_path):
        return pd.DataFrame()
    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)
    rows = []
    for feat in gj.get("features", []):
        geom = feat.get("geometry", {})
        props = feat.get("properties", {})
        coords = geom.get("coordinates")
        if not coords:
            continue
        # LineString: promedio de puntos; Point: directo
        if geom.get("type") == "LineString":
            pts = np.array(coords)
            lon, lat = float(pts[:, 0].mean()), float(pts[:, 1].mean())
        elif geom.get("type") == "Point":
            lon, lat = float(coords[0]), float(coords[1])
        else:
            continue
        rows.append({
            "Idtramo": str(props.get("Idtramo", props.get("OBJECTID", ""))),
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
    # Usar muestra local si no hay fetch en vivo
    sample = os.path.join(OUT_DATA, "traffic_segments_sample.geojson")
    tramos = _tramo_centroids(sample)
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
