"""Monitorización de fiabilidad del modelo."""

from __future__ import annotations

from datetime import date

from .config import get_settings
from .data_loader import load_metrics_by_hour
from .evaluation import errors_by_zone
from .metrics import metrics_for_hour
from .predict_batch import predict_heatmap
from .zone_labels import zone_label


def alerts() -> dict:
    s = get_settings()
    m = load_metrics_by_hour()
    labels = zone_label
    out = {
        "model_active": s.model_name,
        "data_date": s.data_date,
        "validation": s.validation,
        "mae_threshold": s.mae_alert_threshold,
        "alerts": [],
        "mae_by_hour": [],
        "top_error_zones": errors_by_zone(top=10),
    }
    for z in out["top_error_zones"]:
        if "descripcion" not in z:
            z["descripcion"] = labels(int(z["Zona"]))
            z["calle"] = z["descripcion"]
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


def zones_to_review(
    hora: int,
    fecha: date | None = None,
    top: int = 15,
    apply_events: bool = True,
) -> dict:
    """Zonas a revisar: predicción alta ahora + histórico de error elevado en esa hora."""
    d = fecha or date.today()
    dow = d.weekday()
    hm = predict_heatmap(d, hora, dow, use_live_weather=True, apply_events=apply_events)
    points = hm.get("points") or []

    predicted_high = [
        p for p in points if p.get("nivel") == "alta"
    ]
    predicted_high.sort(key=lambda p: float(p.get("intensidad", 0)), reverse=True)

    high_pressure = []
    for p in predicted_high[:top]:
        z = int(p["zona"])
        desc = str(p.get("descripcion") or zone_label(z))
        high_pressure.append(
            {
                "zona": z,
                "descripcion": desc,
                "calle": desc,
                "intensidad": p.get("intensidad"),
                "nivel": "alta",
                "motivo": "Predicción CatBoost por encima del umbral de presión alta",
            }
        )

    hour_errors = errors_by_zone(top=top, hora=hora)
    low_confidence = []
    s = get_settings()
    for row in hour_errors:
        mae = float(row["mae"])
        if mae >= s.mae_alert_threshold * 0.75:
            z = int(row["Zona"])
            low_confidence.append(
                {
                    "zona": z,
                    "descripcion": row.get("descripcion") or zone_label(z),
                    "calle": row.get("calle") or zone_label(z),
                    "mae": mae,
                    "motivo": f"Error histórico elevado (MAE={mae:.1f}) a las {hora:02d}:00 en validación",
                }
            )

    hour_metrics = metrics_for_hour(hora)
    return {
        "fecha": d.isoformat(),
        "hora": hora,
        "n_predicted_high": len(predicted_high),
        "mae_threshold": s.mae_alert_threshold,
        "hour_metrics": hour_metrics,
        "zones_high_pressure": high_pressure,
        "zones_low_confidence": low_confidence,
        "events_active": hm.get("events_active", 0),
    }
