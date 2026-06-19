"""UrbanFlow Valencia — API FastAPI.

Sirve predicción de tráfico (CatBoost), evaluación del modelo, optimización urbana
(PuLP) y monitorización. No entrena modelos: solo carga artefactos derivados.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src import __version__
from src.config import get_settings
from src.coverage_data import coverage_data_available, load_existing_health, load_existing_sports
from src.data_loader import models_available
from src.evaluation import errors_by_zone, scatter_sample
from src.maps import (
    candidates_facilities_geojson,
    candidates_valenbisi,
    coverage_summary,
    covered_hexes_geojson,
    current_valenbisi,
    population_hexes_geojson,
    traffic_segments,
)
from src.metrics import global_metrics, metrics_by_hour
from src.monitoring import alerts
from src.optimize_coverage import optimize as optimize_coverage
from src.optimize_facility import optimize_facility, optimize_multi
from src.optimize_valenbisi import optimize as optimize_valenbisi
from src.predict import predict as run_predict
from src.schemas import (
    CoveredHexesRequest,
    CoverageRequest,
    FacilityRequest,
    MultiFacilityRequest,
    OptimizeResponse,
    PredictRequest,
    PredictResponse,
    ValenbisiRequest,
)

settings = get_settings()

app = FastAPI(
    title=settings.project_name,
    version=__version__,
    description="Predicción de presión de tráfico urbano en Valencia + optimización de "
    "movilidad sostenible (EDM).",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/metadata")
def metadata() -> dict:
    return {
        "project": settings.project_name,
        "version": __version__,
        "model": settings.model_name,
        "model_loaded": models_available(),
        "coverage_data": coverage_data_available(),
        "data_date": settings.data_date,
        "validation": settings.validation,
        "authors": [
            "Sergio Ortiz Montesinos",
            "Luis Trigueros Espada",
            "Fernando Martínez Gómez",
        ],
    }


@app.get("/metrics/global")
def metrics_global() -> dict:
    return global_metrics()


@app.get("/metrics/by-hour")
def metrics_hour() -> list[dict]:
    return metrics_by_hour()


@app.get("/metrics/errors-by-zone")
def metrics_errors_zone(top: int = 15) -> list[dict]:
    return errors_by_zone(top=top)


@app.get("/evaluation/scatter")
def evaluation_scatter(n: int = 500) -> list[dict]:
    return scatter_sample(n=n)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    return run_predict(req)


@app.post("/optimize/valenbisi", response_model=OptimizeResponse)
def opt_valenbisi(req: ValenbisiRequest) -> OptimizeResponse:
    return optimize_valenbisi(req)


@app.post("/optimize/coverage", response_model=OptimizeResponse)
def opt_coverage(req: CoverageRequest) -> OptimizeResponse:
    return optimize_coverage(req)


@app.post("/optimize/sports", response_model=OptimizeResponse)
def opt_sports(req: FacilityRequest) -> OptimizeResponse:
    return optimize_facility(req.model_copy(update={"facility_type": "sports"}))


@app.post("/optimize/health", response_model=OptimizeResponse)
def opt_health(req: FacilityRequest) -> OptimizeResponse:
    return optimize_facility(req.model_copy(update={"facility_type": "health"}))


@app.post("/optimize/multi", response_model=OptimizeResponse)
def opt_multi(req: MultiFacilityRequest) -> OptimizeResponse:
    return optimize_multi(req)


@app.get("/map/existing-sports")
def map_existing_sports() -> dict:
    return load_existing_sports()


@app.get("/map/existing-health")
def map_existing_health() -> dict:
    return load_existing_health()


@app.get("/map/traffic-segments")
def map_traffic_segments() -> dict:
    return traffic_segments()


@app.get("/map/current-valenbisi")
def map_current_valenbisi() -> dict:
    return current_valenbisi()


@app.get("/map/population-hexes")
def map_population_hexes(facility_type: str = "sports") -> dict:
    ft: str = facility_type if facility_type in ("sports", "health") else "sports"
    return population_hexes_geojson(facility_type=ft)  # type: ignore[arg-type]


@app.get("/map/candidates-facilities")
def map_candidates_facilities() -> dict:
    return candidates_facilities_geojson()


@app.post("/map/covered-hexes")
def map_covered_hexes(req: CoveredHexesRequest) -> dict:
    return covered_hexes_geojson(req.candidate_ids, req.facility_type)


@app.get("/coverage/summary")
def coverage_summary_route() -> dict:
    return coverage_summary()


@app.get("/candidates/valenbisi")
def candidates() -> list[dict]:
    return candidates_valenbisi()


@app.get("/monitoring/alerts")
def monitoring_alerts() -> dict:
    return alerts()
