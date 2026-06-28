"""Carga perezosa del modelo de tráfico (singleton)."""

from __future__ import annotations

from functools import lru_cache

from .config import get_settings
from .data_loader import models_available
from .pipeline import TrafficModel, levels_from_baseline


@lru_cache
def get_model() -> TrafficModel | None:
    """Devuelve el modelo cargado, o None si los artefactos no están disponibles."""
    if not models_available():
        return None
    try:
        model = TrafficModel(get_settings().model_dir)
        # Valida que los .cbm sean modelos reales y no punteros LFS sin resolver
        # (p. ej. checkout de CI sin LFS): fuerza la carga perezosa de un modelo.
        # Si falla, se degrada a None y la app usa el fallback demo de forma uniforme.
        model._model(0)
        return model
    except Exception:  # pragma: no cover - entorno sin catboost/artefactos válidos
        return None


@lru_cache
def get_level_thresholds() -> tuple[float, float]:
    model = get_model()
    if model is None:
        return (50.0, 150.0)  # umbrales demo razonables
    return levels_from_baseline(model.baseline)
