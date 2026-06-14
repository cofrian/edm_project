"""Pipeline de inferencia del modelo de tráfico CatBoost.

Reproduce fielmente el bloque "MODELO C — CatBoost + log-ratio + baseline suave +
shrink + zona embeddings" del notebook original (`traffic_pred.ipynb`), pero:

- Aplica el FIX del bug de `Zona` (se fuerza a un único tipo `int` en todo el
  pipeline, evitando el error "merge on object and int64 columns for key 'Zona'").
- NO reentrena: solo carga los modelos `.cbm` ya entrenados para predecir.

El modelo es híbrido por hora:

    Intensidad = baseline_{zona, dia_semana, hora} * exp( shrink * f_CatBoost(features) )

donde `f_CatBoost` aprende el residuo log-ratio sobre el baseline suavizado.
"""

from __future__ import annotations

import json
import os
from math import pi

import numpy as np
import pandas as pd

# Features exactamente en el mismo orden con el que se entrenó cada modelo.
EMB_COLS = [f"z_emb{i + 1}" for i in range(5)]
FEATS = [
    "Zona", "Dia_Semana", "tipo_dia", "es_viernes", "es_finde",
    "hora_sin", "hora_cos", "dia_mes_norm",
    "temp_c", "hum_rel_%", "pres_mb", "vel_viento_ms", "vel_viento_max_ms",
    "wind_sin", "wind_cos", "precip_lm2",
    "temp_c_lag1", "temp_c_lag3", "hum_rel_%_lag1", "pres_mb_lag1", "pres_mb_lag3",
    "precip_lm2_lag1", "vel_viento_ms_lag1", "vel_viento_ms_lag3",
    *EMB_COLS,
]
CAT_NAMES = ["Zona", "Dia_Semana", "tipo_dia"]
CAT_IDX = [FEATS.index(c) for c in CAT_NAMES]

TIPO_CATEGORIES = ["laborable", "sabado", "domingo"]


def smape(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(100 * np.mean(2 * np.abs(y - yhat) / (np.abs(y) + np.abs(yhat) + 1e-6)))


def rmse(y: np.ndarray, yhat: np.ndarray) -> float:
    from sklearn.metrics import mean_squared_error

    return float(mean_squared_error(y, yhat) ** 0.5)


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def fix_zona_dtype(df: pd.DataFrame) -> pd.DataFrame:
    """FIX del bug de `Zona`: tipo único `int` en todo el pipeline."""
    if "Zona" in df.columns:
        df["Zona"] = df["Zona"].astype(str).str.extract(r"(\d+)")[0].astype("int32")
    return df


def tipo_dia_from_dow(dow: int) -> str:
    return "laborable" if dow < 5 else ("sabado" if dow == 5 else "domingo")


# --------------------------------------------------------------------------- #
# Lectura y feature engineering (idéntico al notebook, con fix de Zona)
# --------------------------------------------------------------------------- #
def read_october_adv(csv_path: str) -> pd.DataFrame:
    """Lee el CSV de octubre 2023 y construye las features avanzadas."""
    dtypes = {
        "Año": "int16", "Mes": "int8", "Dia": "int8", "Hora": "int8", "Dia_Semana": "int8",
        "Intensidad": "float32", "Velocidad": "float32", "Ocupacion": "float32",
        "temp_c": "float32", "hum_rel_%": "float32", "pres_mb": "float32",
        "vel_viento_ms": "float32", "vel_viento_max_ms": "float32",
        "dir_viento_grados": "float32", "rad_wm2": "float32", "precip_lm2": "float32",
    }
    df = pd.read_csv(csv_path, sep=";", dtype=dtypes, decimal=".", low_memory=False)
    df = fix_zona_dtype(df)
    df = df[df["Mes"] == 10].copy()

    df["fecha"] = pd.to_datetime(dict(year=df["Año"], month=df["Mes"], day=df["Dia"]))
    df["Dia_Semana"] = df["fecha"].dt.weekday.astype("int8")
    df.drop(columns=["fecha"], inplace=True)

    tipo_vals = np.select(
        [df["Dia_Semana"] < 5, df["Dia_Semana"] == 5, df["Dia_Semana"] == 6],
        ["laborable", "sabado", "domingo"], default="laborable",
    )
    df["tipo_dia"] = pd.Categorical(tipo_vals, categories=TIPO_CATEGORIES)
    df["es_finde"] = (df["Dia_Semana"] >= 5).astype("int8")
    df["es_viernes"] = (df["Dia_Semana"] == 4).astype("int8")
    df["hora_sin"] = np.sin(2 * pi * df["Hora"] / 24)
    df["hora_cos"] = np.cos(2 * pi * df["Hora"] / 24)
    df["dia_mes_norm"] = df["Dia"] / 31.0
    df["wind_sin"] = np.sin(np.deg2rad(df["dir_viento_grados"]))
    df["wind_cos"] = np.cos(np.deg2rad(df["dir_viento_grados"]))

    df = df.sort_values(["Zona", "Año", "Mes", "Dia", "Hora"]).reset_index(drop=True)
    for c in ["temp_c", "hum_rel_%", "pres_mb", "precip_lm2", "vel_viento_ms"]:
        df[f"{c}_lag1"] = df.groupby("Zona")[c].shift(1)
        df[f"{c}_lag3"] = df.groupby("Zona")[c].shift(3)

    lag_cols = [c for c in df.columns if c.endswith("_lag1") or c.endswith("_lag3")]
    for c in lag_cols:
        df[c] = df[c].fillna(df.groupby(["Zona", "Dia_Semana", "Hora"])[c].transform("median"))
        df[c] = df[c].fillna(df[c].median())
    return df


# --------------------------------------------------------------------------- #
# Carga de artefactos del modelo
# --------------------------------------------------------------------------- #
class TrafficModel:
    """Carga baseline + embeddings + shrink + 24 modelos CatBoost para inferencia."""

    def __init__(self, models_dir: str):
        self.models_dir = models_dir
        self.baseline = fix_zona_dtype(
            pd.read_csv(os.path.join(models_dir, "baseline_oct2023_SMOO.csv"))
        )
        self.emb = fix_zona_dtype(
            pd.read_csv(os.path.join(models_dir, "zone_embeddings.csv"))
        )
        with open(os.path.join(models_dir, "shrink_cfg.json"), encoding="utf-8") as f:
            cfg = json.load(f)
        self.tau = float(cfg["tau"])
        self.s = float(cfg["s"])
        self._models: dict[int, object] = {}

    # Lista de zonas disponibles (ordenadas)
    @property
    def zonas(self) -> list[int]:
        return sorted(self.baseline["Zona"].unique().tolist())

    def _model(self, hour: int):
        if hour not in self._models:
            from catboost import CatBoostRegressor

            path = os.path.join(self.models_dir, f"catboost_hour_{hour:02d}.cbm")
            if not os.path.exists(path):  # nombre original como fallback
                path = os.path.join(self.models_dir, f"cat_hour_{hour:02d}.cbm")
            model = CatBoostRegressor()
            model.load_model(path)
            self._models[hour] = model
        return self._models[hour]

    def baseline_lookup(self, zona: int, dow: int, hora: int) -> float:
        m = self.baseline
        row = m[(m["Zona"] == zona) & (m["Dia_Semana"] == dow) & (m["Hora"] == hora)]
        if not row.empty:
            return float(row["baseline"].iloc[0])
        # fallback por (Zona, Hora)
        row = m[(m["Zona"] == zona) & (m["Hora"] == hora)]
        if not row.empty:
            return float(row["baseline"].median())
        return float(m["baseline"].median())

    def _emb_lookup(self, zona: int) -> dict[str, float]:
        row = self.emb[self.emb["Zona"] == zona]
        if row.empty:
            return {c: 0.0 for c in EMB_COLS}
        return {c: float(row[c].iloc[0]) for c in EMB_COLS if c in row.columns}

    def predict_point(
        self,
        zona: int,
        hora: int,
        dow: int,
        weather: dict,
    ) -> dict:
        """Predice la intensidad para una (zona, hora, día) con meteo dada.

        Los lags meteorológicos se aproximan con el valor actual (proxy), ya que el
        endpoint recibe condiciones puntuales y no la serie completa del día. La
        señal dominante es el baseline real; el residuo CatBoost ajusta por meteo.
        """
        from catboost import Pool

        baseline = self.baseline_lookup(zona, dow, hora)
        logb = np.log1p(baseline)
        tipo = tipo_dia_from_dow(dow)

        feat = {
            "Zona": int(zona),
            "Dia_Semana": int(dow),
            "tipo_dia": tipo,
            "es_viernes": 1 if dow == 4 else 0,
            "es_finde": 1 if dow >= 5 else 0,
            "hora_sin": np.sin(2 * pi * hora / 24),
            "hora_cos": np.cos(2 * pi * hora / 24),
            "dia_mes_norm": weather.get("dia_mes_norm", 0.5),
            "temp_c": weather.get("temp_c", 20.0),
            "hum_rel_%": weather.get("hum_rel", 60.0),
            "pres_mb": weather.get("pres_mb", 1015.0),
            "vel_viento_ms": weather.get("vel_viento_ms", 2.0),
            "vel_viento_max_ms": weather.get("vel_viento_max_ms", 5.0),
            "wind_sin": np.sin(np.deg2rad(weather.get("dir_viento_grados", 0.0))),
            "wind_cos": np.cos(np.deg2rad(weather.get("dir_viento_grados", 0.0))),
            "precip_lm2": weather.get("precip_lm2", 0.0),
        }
        # lags como proxy del valor actual
        feat["temp_c_lag1"] = feat["temp_c"]
        feat["temp_c_lag3"] = feat["temp_c"]
        feat["hum_rel_%_lag1"] = feat["hum_rel_%"]
        feat["pres_mb_lag1"] = feat["pres_mb"]
        feat["pres_mb_lag3"] = feat["pres_mb"]
        feat["precip_lm2_lag1"] = feat["precip_lm2"]
        feat["vel_viento_ms_lag1"] = feat["vel_viento_ms"]
        feat["vel_viento_ms_lag3"] = feat["vel_viento_ms"]
        feat.update(self._emb_lookup(zona))

        X = pd.DataFrame([feat])[FEATS]
        pool = Pool(X, cat_features=CAT_IDX)
        delta = float(self._model(hora).predict(pool)[0])
        w = float(sigmoid((baseline - self.tau) / self.s))
        intensidad = float(np.expm1(logb + w * delta))
        intensidad = max(0.0, intensidad)
        return {
            "intensidad": round(intensidad, 2),
            "baseline": round(baseline, 2),
            "shrink_weight": round(w, 4),
        }


def levels_from_baseline(baseline_df: pd.DataFrame) -> tuple[float, float]:
    """Terciles (p33, p66) de la intensidad baseline → umbrales baja/media/alta."""
    bf = fix_zona_dtype(baseline_df.copy())
    q33 = float(bf["baseline"].quantile(0.33))
    q66 = float(bf["baseline"].quantile(0.66))
    return q33, q66


def classify_level(intensidad: float, q33: float, q66: float) -> str:
    if intensidad < q33:
        return "baja"
    if intensidad < q66:
        return "media"
    return "alta"
