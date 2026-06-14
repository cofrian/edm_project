"""Configuración del backend (sin rutas absolutas; todo por entorno)."""

from __future__ import annotations

import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
        self.env: str = os.getenv("ENV", "development")
        self.data_dir: str = os.getenv("DATA_DIR", os.path.join(base, "data", "processed"))
        self.model_dir: str = os.getenv("MODEL_DIR", os.path.join(base, "models"))
        origins = os.getenv(
            "ALLOW_ORIGINS",
            "http://localhost:3000,https://urbanflow-valencia.vercel.app",
        )
        self.allow_origins: list[str] = [o.strip() for o in origins.split(",") if o.strip()]
        self.project_name: str = "UrbanFlow Valencia API"
        self.version: str = "1.0.0"
        self.data_date: str = "2023-10 (holdout 25-31)"
        self.model_name: str = "CatBoost por hora (baseline + log-ratio + shrink + embeddings)"
        self.validation: str = "holdout temporal: train 1-24 oct, test 25-31 oct"
        # Umbral de alerta de monitorización (MAE por hora)
        self.mae_alert_threshold: float = float(os.getenv("MAE_ALERT_THRESHOLD", "80"))

    def path(self, *parts: str) -> str:
        return os.path.join(self.data_dir, *parts)


@lru_cache
def get_settings() -> Settings:
    return Settings()
