"""UrbanFlow Valencia — API FastAPI.

Sirve predicción de tráfico (CatBoost), evaluación del modelo, optimización urbana
(PuLP) y monitorización. No entrena modelos: solo carga artefactos derivados.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from src import __version__
from src.config import get_settings
from src.coverage_data import coverage_data_available
from src.data_loader import models_available
from src.evaluation import errors_by_zone, scatter_sample
from src.events import list_events
from src.integrations.aemet import current_weather, forecast_day
from src.integrations.valencia_traffic import live_traffic
from src.maps import (
    candidates_facilities_geojson,
    candidates_valenbisi,
    coverage_summary,
    covered_hexes_geojson,
    current_valenbisi,
    existing_health,
    existing_sports,
    population_hexes_geojson,
    traffic_segments,
    zones_points,
)
from src.metrics import global_metrics, metrics_by_hour, metrics_for_hour
from src.monitoring import alerts, zones_to_review
from src.optimize_coverage import optimize as optimize_coverage
from src.optimize_facility import optimize_facility, optimize_multi
from src.optimize_valenbisi import optimize as optimize_valenbisi
from src.predict import predict as run_predict
from src.predict_batch import predict_heatmap, predict_hour_batch
from src.schemas import (
    CityEvent,
    CoverageRequest,
    CoveredHexesRequest,
    EventsListResponse,
    FacilityRequest,
    MultiFacilityRequest,
    OptimizeResponse,
    PredictHourRequest,
    PredictRequest,
    PredictResponse,
    ValenbisiRequest,
)
from src.system_metrics import system_metrics

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
def metrics_errors_zone(
    top: int = 15,
    hora: int | None = Query(None, ge=0, le=23),
) -> list[dict]:
    return errors_by_zone(top=top, hora=hora)


@app.get("/metrics/hour/{hora}")
def metrics_single_hour(hora: int) -> dict:
    row = metrics_for_hour(hora)
    g = global_metrics()
    return {
        "hora": hora,
        "hour": row,
        "global": g,
    }


@app.get("/evaluation/scatter")
def evaluation_scatter(n: int = 500) -> list[dict]:
    return scatter_sample(n=n)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    return run_predict(req)


@app.post("/predict/hour")
def predict_hour(req: PredictHourRequest) -> dict:
    return predict_hour_batch(req)


@app.get("/predict/heatmap")
def predict_heatmap_get(
    fecha: date | None = None,
    hora: int = Query(8, ge=0, le=23),
    dia_semana: int | None = Query(None, ge=0, le=6),
    use_live_weather: bool = True,
    apply_events: bool = True,
) -> dict:
    d = fecha or date.today()
    dow = dia_semana if dia_semana is not None else d.weekday()
    return predict_heatmap(d, hora, dow, use_live_weather=use_live_weather, apply_events=apply_events)


@app.get("/weather/current")
def weather_current() -> dict:
    return current_weather()


@app.get("/weather/forecast")
def weather_forecast(fecha: date | None = None) -> dict:
    d = fecha or date.today()
    return {"fecha": d.isoformat(), "hours": forecast_day(d)}


@app.get("/traffic/live")
def traffic_live() -> dict:
    return live_traffic()


@app.get("/events", response_model=EventsListResponse)
def get_events(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
) -> EventsListResponse:
    evs = list_events(from_date=from_date, to_date=to_date)
    return EventsListResponse(count=len(evs), events=[CityEvent(**e) for e in evs])


@app.get("/map/zones")
def map_zones() -> dict:
    return zones_points()


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
    return existing_sports()


@app.get("/map/existing-health")
def map_existing_health() -> dict:
    return existing_health()


@app.get("/map/population-hexes")
def map_population_hexes(facility_type: Literal["sports", "health"] = "sports") -> dict:
    return population_hexes_geojson(facility_type)


@app.get("/map/candidates-facilities")
def map_candidates_facilities() -> dict:
    return candidates_facilities_geojson()


@app.post("/map/covered-hexes")
def map_covered_hexes(req: CoveredHexesRequest) -> dict:
    return covered_hexes_geojson(req.candidate_ids, req.facility_type)


@app.get("/coverage/summary")
def get_coverage_summary() -> dict:
    return coverage_summary()


@app.get("/map/traffic-segments")
def map_traffic_segments() -> dict:
    return traffic_segments()


@app.get("/map/current-valenbisi")
def map_current_valenbisi() -> dict:
    return current_valenbisi()


@app.get("/candidates/valenbisi")
def candidates() -> list[dict]:
    return candidates_valenbisi()


@app.get("/monitoring/alerts")
def monitoring_alerts() -> dict:
    return alerts()


@app.get("/monitoring/zones-to-review")
def monitoring_zones_to_review(
    hora: int = Query(..., ge=0, le=23),
    fecha: date | None = None,
    top: int = Query(15, ge=1, le=50),
    apply_events: bool = True,
) -> dict:
    d = fecha or date.today()
    return zones_to_review(hora, d, top=top, apply_events=apply_events)


@app.get("/monitoring/system")
def monitoring_system() -> dict:
    return system_metrics()
