"""Exporta puntos de zona (sensores) a GeoJSON para el mapa de predicción.

Lee `zonas_coordenadas.csv` desde samsung (o `ZONAS_COORD` en common).
Salida: `backend/data/processed/zones_points.geojson`
"""

from __future__ import annotations

import json
import os
import sys

import pandas as pd

from common import OUT_DATA, ZONAS_COORD, ensure_dirs


def load_zonas_df() -> pd.DataFrame:
    if os.path.exists(ZONAS_COORD):
        z = pd.read_csv(ZONAS_COORD)
        z = z.rename(columns={c: c.strip() for c in z.columns})
        key_col = "KEY" if "KEY" in z.columns else list(z.columns)[3]
        desc_col = "Descripcion" if "Descripcion" in z.columns else z.columns[0]
        return pd.DataFrame({
            "Zona": z[key_col].astype(int),
            "lat": z["Lat"].astype(float),
            "lon": z["Lon"].astype(float),
            "descripcion": z[desc_col].astype(str),
        }).dropna(subset=["lat", "lon"])

    # Fallback: puntos ya exportados en valenbisi geojson
    fallback = os.path.join(OUT_DATA, "current_valenbisi.geojson")
    if os.path.exists(fallback):
        with open(fallback, encoding="utf-8") as f:
            gj = json.load(f)
        rows = []
        for feat in gj.get("features", []):
            coords = feat.get("geometry", {}).get("coordinates", [])
            props = feat.get("properties", {})
            if len(coords) >= 2:
                rows.append({
                    "Zona": int(props.get("zona", 0)),
                    "lat": float(coords[1]),
                    "lon": float(coords[0]),
                    "descripcion": str(props.get("zona", "")),
                })
        return pd.DataFrame(rows)

    raise FileNotFoundError(f"No se encontró {ZONAS_COORD} ni fallback geojson")


def to_geojson(df: pd.DataFrame) -> dict:
    features = []
    for _, r in df.iterrows():
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [float(r["lon"]), float(r["lat"])],
            },
            "properties": {
                "zona": int(r["Zona"]),
                "descripcion": str(r.get("descripcion", "")),
            },
        })
    return {"type": "FeatureCollection", "features": features}


def main() -> int:
    ensure_dirs()
    df = load_zonas_df()
    out_path = os.path.join(OUT_DATA, "zones_points.geojson")
    gj = to_geojson(df)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(gj, f, ensure_ascii=False)
    print(f"[OK] zones_points.geojson ({len(gj['features'])} zonas) -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
