"""Lógica de predicción de intensidad/presión de tráfico."""

from __future__ import annotations

from .data_loader import load_metrics_by_hour
from .model_loader import get_level_thresholds, get_model
from .pipeline import classify_level
from .schemas import PredictRequest, PredictResponse


def _mae_for_hour(hora: int) -> float | None:
    m = load_metrics_by_hour()
    if m.empty or "Hora" not in m.columns:
        return None
    row = m[m["Hora"] == hora]
    if row.empty:
        return None
    return float(row["MAE"].iloc[0])


def _reliability(mae_hora: float | None) -> str:
    if mae_hora is None:
        return "desconocida"
    m = load_metrics_by_hour()
    if m.empty:
        return "desconocida"
    avg = float(m["MAE"].mean())
    if mae_hora > 1.4 * avg:
        return "baja (error histórico elevado en esta hora)"
    if mae_hora > 1.1 * avg:
        return "media"
    return "alta"


def predict(req: PredictRequest) -> PredictResponse:
    model = get_model()
    q33, q66 = get_level_thresholds()
    weather = {
        "temp_c": req.temp_c,
        "hum_rel": req.hum_rel,
        "pres_mb": req.pres_mb,
        "vel_viento_ms": req.vel_viento_ms,
        "vel_viento_max_ms": req.vel_viento_max_ms,
        "dir_viento_grados": req.dir_viento_grados,
        "precip_lm2": req.precip_lm2,
    }

    if model is not None:
        out = model.predict_point(req.zona, req.hora, req.dia_semana, weather)
        intensidad = out["intensidad"]
        baseline = out["baseline"]
    else:
        # Sin modelo cargado: respuesta demo basada en umbrales (etiquetada en /metadata)
        baseline = (q33 + q66) / 2
        intensidad = baseline

    mae_hora = _mae_for_hour(req.hora)
    return PredictResponse(
        zona=req.zona,
        hora=req.hora,
        dia_semana=req.dia_semana,
        intensidad=round(intensidad, 2),
        baseline=round(baseline, 2),
        nivel=classify_level(intensidad, q33, q66),
        fiabilidad=_reliability(mae_hora),
        mae_hora=round(mae_hora, 2) if mae_hora is not None else None,
    )
