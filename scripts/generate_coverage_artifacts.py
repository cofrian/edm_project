"""Genera artefactos de cobertura poblacional (notebook optimizacion (1).ipynb).

Implementa la lógica del curso SMARTCITIES:
- Población REAL desde population_spain.gpkg (hexágonos censales)
- Candidatos desde localizaciones2.csv (cost1=polideportivo, cost2=centro salud)
- Instalaciones existentes: centros-deportivo-valencia.csv, hospitales-valencia.csv
- Matriz αᵢⱼ: centroide del hexágono j dentro de la isócrona del candidato i
- Pesos pⱼ: población en hexágonos sin cobertura existente del tipo elegido

Salidas en backend/data/processed/:
  population_hexes.csv, coverage_alpha.json, candidates_facilities.csv,
  existing_sports.geojson, existing_health.geojson
"""

from __future__ import annotations

import json
import os
import sys

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely import wkt
from shapely.geometry import mapping
from shapely.ops import unary_union

from common import (
    CSV_IMPUTADO,
    OUT_DATA,
    OUT_MODELS,
    SRC_BASES,
    SRC_CONTENT,
    SRC_MODELS,
    ZONAS_COORD,
    ensure_dirs,
)

# Aproximación del municipio de Valencia (sin osmnx en CI)
VALENCIA_BBOX = (-0.42, 39.42, -0.30, 39.52)  # min_lon, min_lat, max_lon, max_lat


def _read_facilities_csv(path: str, name_col: str) -> gpd.GeoDataFrame:
    df = pd.read_csv(path, sep=";")
    df["geometry"] = df["geometry"].apply(wkt.loads)
    df["isochrone"] = df["isochrone"].apply(wkt.loads)
    gdf = gpd.GeoDataFrame(df, geometry="geometry", crs="EPSG:4326")
    gdf["name"] = df[name_col]
    return gdf


def _load_population_hexes(gpkg_path: str) -> gpd.GeoDataFrame:
    pop = gpd.read_file(gpkg_path).set_geometry("geometry")
    if pop.crs is None:
        pop = pop.set_crs("EPSG:4326")
    pop = pop.to_crs("EPSG:4326")
    min_lon, min_lat, max_lon, max_lat = VALENCIA_BBOX
    centroids = pop.geometry.centroid
    mask = (
        (centroids.x >= min_lon)
        & (centroids.x <= max_lon)
        & (centroids.y >= min_lat)
        & (centroids.y <= max_lat)
    )
    pop = pop.loc[mask].copy().reset_index(drop=True)
    pop["hex_id"] = pop.index.astype(int)
    pop["centroid_lon"] = pop.geometry.centroid.x
    pop["centroid_lat"] = pop.geometry.centroid.y
    return pop


def _need_access(pop: gpd.GeoDataFrame, existing_isochrones: list) -> list[bool]:
    if not existing_isochrones:
        return [True] * len(pop)
    union = unary_union(existing_isochrones)
    return [not union.contains(row.geometry.centroid) for _, row in pop.iterrows()]


def _baseline_by_zone() -> dict[int, float]:
    src = os.path.join(OUT_MODELS, "baseline_oct2023_SMOO.csv")
    if not os.path.exists(src):
        src = os.path.join(SRC_MODELS, "baseline_oct2023_SMOO.csv")
    b = pd.read_csv(src)
    b["Zona"] = b["Zona"].astype(int)
    g = b.groupby("Zona")["baseline"].mean()
    return {int(k): float(v) for k, v in g.items()}


def _nearest_zone(lat: float, lon: float, zonas: pd.DataFrame) -> int:
    d = (zonas["lat"] - lat) ** 2 + (zonas["lon"] - lon) ** 2
    return int(zonas.loc[d.idxmin(), "Zona"])


def build_coverage_artifacts() -> None:
    gpkg = os.path.join(SRC_CONTENT, "population_spain.gpkg")
    loc_path = os.path.join(SRC_CONTENT, "localizaciones2.csv")
    sports_path = os.path.join(SRC_CONTENT, "centros-deportivo-valencia.csv")
    health_path = os.path.join(SRC_CONTENT, "hospitales-valencia.csv")

    pop = _load_population_hexes(gpkg)
    locations = pd.read_csv(loc_path, sep=";")
    locations["geometry"] = locations["geometry"].apply(wkt.loads)
    locations["isochrone"] = locations["isochrone"].apply(wkt.loads)

    sports = _read_facilities_csv(sports_path, "name")
    health = _read_facilities_csv(health_path, "Nombre")

    need_sports = _need_access(pop, list(sports["isochrone"]))
    need_health = _need_access(pop, list(health["isochrone"]))

    pop_out = pd.DataFrame({
        "hex_id": pop["hex_id"],
        "population": pop["population"].astype(float),
        "centroid_lon": pop["centroid_lon"],
        "centroid_lat": pop["centroid_lat"],
        "need_sports": need_sports,
        "need_health": need_health,
        "weight_sports": [
            float(row.population) if ns else 0.0
            for row, ns in zip(pop.itertuples(), need_sports)
        ],
        "weight_health": [
            float(row.population) if nh else 0.0
            for row, nh in zip(pop.itertuples(), need_health)
        ],
    })
    pop_out.to_csv(os.path.join(OUT_DATA, "population_hexes.csv"), index=False)
    print(f"[OK] population_hexes.csv ({len(pop_out)} hexágonos, pop total {pop_out['population'].sum():,.0f})")

    # Matriz α sparse: candidate_id -> [hex_id, ...]
    alpha: dict[str, list[int]] = {}
    n = len(locations)
    m = len(pop)
    centroids = pop.geometry.centroid
    for i, row in locations.iterrows():
        iso = row["isochrone"]
        covered = [
            int(pop.iloc[j]["hex_id"])
            for j in range(m)
            if iso.contains(centroids.iloc[j])
        ]
        alpha[str(int(i))] = covered
    with open(os.path.join(OUT_DATA, "coverage_alpha.json"), "w", encoding="utf-8") as f:
        json.dump({"n_candidates": n, "n_hexes": m, "alpha": alpha}, f)
    print(f"[OK] coverage_alpha.json ({n} candidatos, {m} hexágonos)")

    # Candidatos con costes y tráfico
    zonas = pd.read_csv(ZONAS_COORD)
    zonas = zonas.rename(columns={c: c.strip() for c in zonas.columns})
    key_col = "KEY" if "KEY" in zonas.columns else list(zonas.columns)[3]
    zonas_df = pd.DataFrame({
        "Zona": zonas[key_col].astype(int),
        "lat": zonas["Lat"].astype(float),
        "lon": zonas["Lon"].astype(float),
    })
    traffic_map = _baseline_by_zone()

    cand_rows = []
    for i, row in locations.iterrows():
        pt = row["geometry"]
        lon, lat = pt.x, pt.y
        zona = _nearest_zone(lat, lon, zonas_df)
        cand_rows.append({
            "candidate_id": int(i),
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "zona": zona,
            "cost_sports": float(row["cost1"]),
            "cost_health": float(row["cost2"]),
            "traffic_score": round(traffic_map.get(zona, np.nan), 2),
            "population_in_isochrone": int(
                pop_out.loc[
                    pop_out["hex_id"].isin(alpha[str(int(i))]), "population"
                ].sum()
            ),
        })
    cand_df = pd.DataFrame(cand_rows)
    cand_df["traffic_score"] = cand_df["traffic_score"].fillna(cand_df["traffic_score"].median())
    cand_df.to_csv(os.path.join(OUT_DATA, "candidates_facilities.csv"), index=False)
    print(f"[OK] candidates_facilities.csv ({len(cand_df)} filas)")

    # GeoJSON instalaciones existentes
    def _to_geojson(gdf: gpd.GeoDataFrame, name_col: str, facility_type: str) -> dict:
        feats = []
        for _, row in gdf.iterrows():
            feats.append({
                "type": "Feature",
                "geometry": mapping(row["isochrone"]),
                "properties": {"name": row[name_col], "type": facility_type},
            })
            feats.append({
                "type": "Feature",
                "geometry": mapping(row["geometry"]),
                "properties": {"name": row[name_col], "type": facility_type, "point": True},
            })
        return {"type": "FeatureCollection", "features": feats}

    sports_geo = _to_geojson(sports, "name", "polideportivo")
    health_geo = _to_geojson(health, "name", "centro_salud")
    with open(os.path.join(OUT_DATA, "existing_sports.geojson"), "w", encoding="utf-8") as f:
        json.dump(sports_geo, f, ensure_ascii=False)
    with open(os.path.join(OUT_DATA, "existing_health.geojson"), "w", encoding="utf-8") as f:
        json.dump(health_geo, f, ensure_ascii=False)
    print(f"[OK] existing_sports.geojson ({len(sports)} instalaciones)")
    print(f"[OK] existing_health.geojson ({len(health)} instalaciones)")

    # Actualizar CSV legacy para compatibilidad (población REAL en isócrona)
    val = pd.DataFrame({
        "candidate_id": cand_df["candidate_id"],
        "lat": cand_df["lat"],
        "lon": cand_df["lon"],
        "zona": cand_df["zona"],
        "traffic_score": cand_df["traffic_score"],
        "population_score": cand_df["population_in_isochrone"],
        "valenbisi_deficit_score": 1.0,  # legacy column name
        "cost": cand_df["cost_sports"],
    })
    val.to_csv(os.path.join(OUT_DATA, "candidate_points_valenbisi.csv"), index=False)

    cov = pd.DataFrame({
        "candidate_id": cand_df["candidate_id"],
        "lat": cand_df["lat"],
        "lon": cand_df["lon"],
        "zona": cand_df["zona"],
        "population_covered": cand_df["population_in_isochrone"],
        "traffic_pressure": cand_df["traffic_score"],
        "coverage_deficit": 1.0,
        "cost": cand_df["cost_sports"],
    })
    cov.to_csv(os.path.join(OUT_DATA, "coverage_candidates.csv"), index=False)
    print("[OK] candidate_points_valenbisi.csv y coverage_candidates.csv actualizados (población real)")


def main() -> int:
    ensure_dirs()
    try:
        build_coverage_artifacts()
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        raise
    return 0


if __name__ == "__main__":
    sys.exit(main())
