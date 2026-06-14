"""Monitorización de fiabilidad del modelo."""

from __future__ import annotations

from .config import get_settings
from .data_loader import load_metrics_by_hour
from .evaluation import errors_by_zone


def alerts() -> dict:
    s = get_settings()
    m = load_metrics_by_hour()
    out = {
        "model_active": s.model_name,
        "data_date": s.data_date,
        "validation": s.validation,
        "mae_threshold": s.mae_alert_threshold,
        "alerts": [],
        "mae_by_hour": [],
        "top_error_zones": errors_by_zone(top=10),
    }
    if m.empty:
        return out

    avg = float(m["MAE"].mean())
    out["mae_global"] = round(avg, 2)
    out["mae_by_hour"] = [
        {"Hora": int(r.Hora), "MAE": round(float(r.MAE), 2)} for r in m.itertuples()
    ]

    for r in m.itertuples():
        mae_h = float(r.MAE)
        if mae_h > s.mae_alert_threshold:
            out["alerts"].append(
                {
                    "hora": int(r.Hora),
                    "mae": round(mae_h, 2),
                    "nivel": "alta" if mae_h > 1.5 * avg else "media",
                    "mensaje": (
                        f"La hora {int(r.Hora):02d} presenta un error (MAE={mae_h:.1f}) "
                        f"por encima del umbral ({s.mae_alert_threshold:.0f}). "
                        "Las predicciones en esta franja deben interpretarse con menor confianza."
                    ),
                }
            )
    if not out["alerts"]:
        out["alerts"].append(
            {"hora": None, "mae": None, "nivel": "ok",
             "mensaje": "Todas las horas dentro del umbral de error esperado."}
        )
    return out
