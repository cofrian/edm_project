"""Esquemas Pydantic para validación de entradas/salidas de la API."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


# ----------------------------- Predicción ---------------------------------- #
class PredictRequest(BaseModel):
    zona: int = Field(..., ge=0, description="Identificador de zona")
    hora: int = Field(..., ge=0, le=23, description="Hora del día (0-23)")
    dia_semana: int = Field(..., ge=0, le=6, description="0=lunes ... 6=domingo")
    temp_c: float = Field(20.0, description="Temperatura (ºC)")
    hum_rel: float = Field(60.0, ge=0, le=100, description="Humedad relativa (%)")
    pres_mb: float = Field(1015.0, description="Presión (mb)")
    vel_viento_ms: float = Field(2.0, ge=0, description="Velocidad viento (m/s)")
    vel_viento_max_ms: float = Field(5.0, ge=0, description="Racha máx. viento (m/s)")
    dir_viento_grados: float = Field(0.0, ge=0, le=360, description="Dirección viento (º)")
    precip_lm2: float = Field(0.0, ge=0, description="Precipitación (l/m2)")


class PredictResponse(BaseModel):
    zona: int
    hora: int
    dia_semana: int
    intensidad: float
    baseline: float
    nivel: Literal["baja", "media", "alta"]
    fiabilidad: str
    mae_hora: float | None = None


class PredictHourRequest(BaseModel):
    fecha: date = Field(default_factory=date.today, description="Fecha de predicción")
    hora: int = Field(..., ge=0, le=23)
    dia_semana: int = Field(..., ge=0, le=6, description="0=lunes ... 6=domingo")
    use_live_weather: bool = Field(True, description="Usar AEMET si está configurada")
    apply_events: bool = Field(True, description="Aplicar impacto de eventos urbanos")
    temp_c: float = Field(20.0)
    hum_rel: float = Field(60.0, ge=0, le=100)
    pres_mb: float = Field(1015.0)
    vel_viento_ms: float = Field(2.0, ge=0)
    vel_viento_max_ms: float = Field(5.0, ge=0)
    dir_viento_grados: float = Field(0.0, ge=0, le=360)
    precip_lm2: float = Field(0.0, ge=0)


class CityEvent(BaseModel):
    id: str
    nombre: str
    tipo: str
    inicio: str
    fin: str
    lat: float
    lon: float
    direccion: str | None = None
    radio_metros: float = 300
    factor_max: float = 1.3
    fuente: str = "manual"
    enlace: str | None = None


class EventsListResponse(BaseModel):
    count: int
    events: list[CityEvent]


class CoveredHexesRequest(BaseModel):
    candidate_ids: list[int] = Field(..., min_length=1)
    facility_type: Literal["sports", "health"] = "sports"


# --------------------------- Optimización ---------------------------------- #
class ValenbisiRequest(BaseModel):
    n: int = Field(10, ge=1, le=100, description="Número de ubicaciones a seleccionar")
    alpha_trafico: float = Field(1.0, ge=0, description="Peso del tráfico")
    beta_poblacion: float = Field(1.0, ge=0, description="Peso de la población")
    gamma_deficit: float = Field(1.0, ge=0, description="Peso del déficit Valenbisi")


class CoverageRequest(BaseModel):
    presupuesto: float = Field(100.0, gt=0, description="Presupuesto total disponible")
    alpha_poblacion: float = Field(1.0, ge=0)
    beta_trafico: float = Field(1.0, ge=0)
    gamma_deficit: float = Field(1.0, ge=0)


class FacilityRequest(BaseModel):
    presupuesto: float = Field(100.0, gt=0, description="Presupuesto total disponible")
    facility_type: Literal["sports", "health"] = Field(
        "sports", description="sports=polideportivo, health=centro de salud"
    )


class MultiFacilityRequest(BaseModel):
    presupuesto: float = Field(150.0, gt=0)
    lambda_sports: float = Field(
        0.5, ge=0, le=1, description="Peso polideportivo en objetivo multi (0-1)"
    )


class SelectedCandidate(BaseModel):
    candidate_id: int
    lat: float
    lon: float
    zona: int | None = None
    score: float
    cost: float
    facility_type: str | None = None


class OptimizeResponse(BaseModel):
    mode: str
    selected: list[SelectedCandidate]
    total_score: float
    total_cost: float
    n_selected: int
    constraint: str
    population_covered: float | None = None
