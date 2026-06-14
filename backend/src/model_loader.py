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
        return TrafficModel(get_settings().model_dir)
    except Exception:  # pragma: no cover - entorno sin catboost/artefactos
        return None


@lru_cache
def get_level_thresholds() -> tuple[float, float]:
    model = get_model()
    if model is None:
        return (50.0, 150.0)  # umbrales demo razonables
    return levels_from_baseline(model.baseline)
