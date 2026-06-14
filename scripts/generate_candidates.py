"""Genera artefactos de optimización y geo a partir de datos REALES locales.

Señales por candidato:
- traffic_score / traffic_pressure: REAL, a partir del baseline CatBoost agregado por zona.
- coverage_deficit / valenbisi_deficit_score: REAL geométrico (candidato NO cubierto por
  isócronas de instalaciones existentes).
- population_score / population_covered: PROXY de demanda basado en el ÁREA alcanzable de la
  isócrona del candidato (no es censo real; documentado como proxy). El notebook
  `04_prepare_optimization_data.ipynb` muestra la versión con población descargada.
- cost: REAL (`cost1` de localizaciones2.csv).

Salidas: candidate_points_valenbisi.csv, coverage_candidates.csv,
traffic_segments_sample.geojson, current_valenbisi.geojson, traffic_hourly_oct2023.parquet,
fallback_demo_results.json.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

from common import (
    CSV_IMPUTADO, OUT_DATA, OUT_MODELS, SRC_BASES, SRC_CONTENT, SRC_MODELS, ZONAS_COORD,
    ensure_dirs,
)
from geo_utils import (
    haversine_km, parse_wkt_point, parse_wkt_polygon, point_in_polygon, polygon_area_km2,
)


def _baseline_by_zone() -> pd.DataFrame:
    src = os.path.join(OUT_MODELS, "baseline_oct2023_SMOO.csv")
    if not os.path.exists(src):
        src = os.path.join(SRC_MODELS, "baseline_oct2023_SMOO.csv")
    b = pd.read_csv(src)
    b["Zona"] = b["Zona"].astype(int)
    return b.groupby("Zona")["baseline"].mean().rename("traffic").reset_index()


def _zonas() -> pd.DataFrame:
    z = pd.read_csv(ZONAS_COORD)
    # columnas: Descripcion,Lat,Lon,KEY,Descripcion(dup) -> KEY es la zona
    z = z.rename(columns={c: c.strip() for c in z.columns})
    cols = list(z.columns)
    key_col = "KEY" if "KEY" in cols else cols[3]
    return pd.DataFrame({
        "Zona": z[key_col].astype(int),
        "lat": z["Lat"].astype(float),
        "lon": z["Lon"].astype(float),
    }).dropna()


def _nearest_zone(lat: float, lon: float, zonas: pd.DataFrame) -> int:
    d = ((zonas["lat"] - lat) ** 2 + (zonas["lon"] - lon) ** 2)
    return int(zonas.loc[d.idxmin(), "Zona"])


def build_candidates() -> pd.DataFrame:
    loc = pd.read_csv(os.path.join(SRC_CONTENT, "localizaciones2.csv"), sep=";")
    centros = pd.read_csv(os.path.join(SRC_CONTENT, "centros-deportivo-valencia.csv"), sep=";")
    zonas = _zonas()
    traffic = _baseline_by_zone()
    traffic_map = dict(zip(traffic["Zona"], traffic["traffic"]))

    # isócronas de instalaciones existentes (para déficit de cobertura)
    existing_rings = [parse_wkt_polygon(w) for w in centros["isochrone"]]
    existing_rings = [r for r in existing_rings if r]

    rows = []
    for i, r in loc.iterrows():
        pt = parse_wkt_point(r["geometry"])
        if pt is None:
            continue
        lon, lat = pt
        zona = _nearest_zone(lat, lon, zonas)
        traffic_score = float(traffic_map.get(zona, np.nan))

        ring = parse_wkt_polygon(r.get("isochrone", ""))
        area = polygon_area_km2(ring)  # proxy de demanda alcanzable

        covered = any(point_in_polygon((lon, lat), er) for er in existing_rings)
        deficit = 0.0 if covered else 1.0

        cost = float(r.get("cost1", np.nan))
        rows.append({
            "candidate_id": int(i),
            "lat": round(lat, 6), "lon": round(lon, 6), "zona": zona,
            "traffic": traffic_score,
            "area_km2": round(area, 4),
            "coverage_deficit": deficit,
            "cost": cost,
        })

    df = pd.DataFrame(rows)
    # rellena tráfico ausente con la mediana (zonas sin baseline)
    df["traffic"] = df["traffic"].fillna(df["traffic"].median())
    df["cost"] = df["cost"].fillna(df["cost"].median())
    return df


def write_optimization_artifacts(df: pd.DataFrame) -> None:
    # Valenbisi: traffic + population(proxy=area) + deficit
    val = pd.DataFrame({
        "candidate_id": df["candidate_id"],
        "lat": df["lat"], "lon": df["lon"], "zona": df["zona"],
        "traffic_score": df["traffic"].round(2),
        "population_score": df["area_km2"].round(4),   # PROXY documentado
        "valenbisi_deficit_score": df["coverage_deficit"],
        "cost": df["cost"].round(2),
    })
    val.to_csv(os.path.join(OUT_DATA, "candidate_points_valenbisi.csv"), index=False)
    print(f"[OK] candidate_points_valenbisi.csv ({len(val)} filas)")

    cov = pd.DataFrame({
        "candidate_id": df["candidate_id"],
        "lat": df["lat"], "lon": df["lon"], "zona": df["zona"],
        "population_covered": df["area_km2"].round(4),  # PROXY documentado
        "traffic_pressure": df["traffic"].round(2),
        "coverage_deficit": df["coverage_deficit"],
        "cost": df["cost"].round(2),
    })
    cov.to_csv(os.path.join(OUT_DATA, "coverage_candidates.csv"), index=False)
    print(f"[OK] coverage_candidates.csv ({len(cov)} filas)")


def write_geojson_and_parquet() -> None:
    # traffic_segments_sample.geojson: muestra ligera de calles + zona
    geo_src = os.path.join(SRC_BASES, "calles_valencia.geojson")
    out_geo = os.path.join(OUT_DATA, "traffic_segments_sample.geojson")
    if os.path.exists(geo_src):
        with open(geo_src, "r", encoding="utf-8") as f:
            gj = json.load(f)
        feats = gj.get("features", [])
        sample = feats[:: max(1, len(feats) // 400)][:400]  # ~400 features
        with open(out_geo, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": sample}, f)
        print(f"[OK] traffic_segments_sample.geojson ({len(sample)} features)")
    else:
        with open(out_geo, "w", encoding="utf-8") as f:
            json.dump({"type": "FeatureCollection", "features": []}, f)
        print("[WARN] calles_valencia.geojson no encontrado; geojson vacío")

    # current_valenbisi.geojson: estaciones existentes desde zonas_coordenadas (puntos reales)
    z = pd.read_csv(ZONAS_COORD)
    feats = []
    for _, r in z.head(300).iterrows():
        try:
            feats.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [float(r["Lon"]), float(r["Lat"])]},
                "properties": {"zona": int(r[z.columns[3]])},
            })
        except Exception:
            continue
    with open(os.path.join(OUT_DATA, "current_valenbisi.geojson"), "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": feats}, f)
    print(f"[OK] current_valenbisi.geojson ({len(feats)} puntos)")

    # traffic_hourly_oct2023.parquet: agregado ligero por (Zona, Hora)
    if os.path.exists(CSV_IMPUTADO):
        usecols = ["Zona", "Hora", "Dia_Semana", "Intensidad", "Velocidad", "Ocupacion"]
        df = pd.read_csv(CSV_IMPUTADO, sep=";", decimal=".", low_memory=False)
        df["Zona"] = df["Zona"].astype(str).str.extract(r"(\d+)")[0].astype("int32")
        agg = (df.groupby(["Zona", "Hora"])[["Intensidad", "Velocidad", "Ocupacion"]]
               .mean().reset_index())
        try:
            agg.to_parquet(os.path.join(OUT_DATA, "traffic_hourly_oct2023.parquet"), index=False)
            print(f"[OK] traffic_hourly_oct2023.parquet ({len(agg)} filas)")
        except Exception as e:
            agg.to_csv(os.path.join(OUT_DATA, "traffic_hourly_oct2023.csv"), index=False)
            print(f"[WARN] parquet no disponible ({e}); guardado CSV")


def write_fallback_demo() -> None:
    """Resultados de DEMOSTRACIÓN (no reales) para que el frontend no se rompa."""
    demo = {
        "_meta": "DATOS DE DEMOSTRACIÓN, no reales. Solo para fallback de UI si la API no responde.",
        "global_metrics": {
            "MAE": 44.38, "RMSE": 87.80, "R2": 0.92, "sMAPE": 16.79,
            "validation": "holdout temporal días 25-31 oct 2023",
        },
        "metrics_by_hour": [
            {"Hora": h, "MAE": round(40 + 30 * np.sin(h / 4), 2), "RMSE": 80.0,
             "R2": 0.9, "sMAPE": 16.0} for h in range(24)
        ],
        "predict_example": {"zona": 1, "hora": 8, "intensidad": 122.8, "nivel": "alta"},
    }
    with open(os.path.join(OUT_DATA, "fallback_demo_results.json"), "w", encoding="utf-8") as f:
        json.dump(demo, f, ensure_ascii=False, indent=2)
    print("[OK] fallback_demo_results.json (DEMO)")


def main() -> int:
    ensure_dirs()
    try:
        df = build_candidates()
        write_optimization_artifacts(df)
    except Exception as e:  # pragma: no cover
        print(f"[WARN] candidatos: {e}")
    try:
        write_geojson_and_parquet()
    except Exception as e:  # pragma: no cover
        print(f"[WARN] geo/parquet: {e}")
    write_fallback_demo()
    return 0


if __name__ == "__main__":
    sys.exit(main())
