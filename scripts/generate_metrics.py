"""Genera los artefactos de evaluación CatBoost (métricas reales + predicciones).

- `metrics_by_hour_catboost.csv`: copia de las métricas reales por hora.
- `global_metrics_catboost.json`: media global de esas métricas.
- `validation_predictions.csv`: carga los 24 `.cbm`, aplica el FIX de `Zona` y
  re-predice el holdout 25-31 oct fila a fila (real vs predicho, con nivel).

Requiere catboost/pandas/sklearn instalados y los modelos copiados en backend/models.
"""

from __future__ import annotations

import json
import os
import sys

import numpy as np
import pandas as pd

# Permite importar el pipeline del backend
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from common import CSV_IMPUTADO, OUT_DATA, OUT_MODELS, SRC_MODELS, ensure_dirs  # noqa: E402


def _copy_metrics() -> pd.DataFrame:
    src = os.path.join(SRC_MODELS, "metrics_by_hour_cat_raw.csv")
    m = pd.read_csv(src)
    m.to_csv(os.path.join(OUT_DATA, "metrics_by_hour_catboost.csv"), index=False)
    glob = {
        "MAE": round(float(m["MAE"].mean()), 2),
        "RMSE": round(float(m["RMSE"].mean()), 2),
        "R2": round(float(m["R2"].mean()), 3),
        "sMAPE": round(float(m["sMAPE"].mean()), 2),
        "validation": "holdout temporal días 25-31 oct 2023",
        "model": "CatBoost por hora (baseline + log-ratio + shrink + embeddings)",
    }
    with open(os.path.join(OUT_DATA, "global_metrics_catboost.json"), "w", encoding="utf-8") as f:
        json.dump(glob, f, ensure_ascii=False, indent=2)
    print(f"[OK] métricas globales: {glob}")
    return m


def _validation_predictions() -> None:
    """Re-predice el holdout cargando los modelos (fix de Zona incluido)."""
    from src.pipeline import (  # noqa: E402
        FEATS, CAT_IDX, TrafficModel, classify_level, levels_from_baseline,
        read_october_adv, sigmoid, smape, rmse,
    )
    from catboost import Pool
    from sklearn.metrics import mean_absolute_error, r2_score

    if not os.path.exists(CSV_IMPUTADO):
        print(f"[WARN] No existe {CSV_IMPUTADO}; se omite validation_predictions.csv")
        return

    print("[..] Leyendo datos y construyendo features (holdout 25-31)...")
    df = read_october_adv(CSV_IMPUTADO)
    model = TrafficModel(OUT_MODELS)
    base, emb = model.baseline, model.emb
    q33, q66 = levels_from_baseline(base)

    valid = df[df["Dia"] >= 25].copy()
    valid = valid.merge(base, on=["Zona", "Dia_Semana", "Hora"], how="left")
    # fallback baseline por (Zona,Hora)
    if valid["baseline"].isna().any():
        fb = df[df["Dia"] <= 24].groupby(["Zona", "Hora"])["Intensidad"].median()
        fb = fb.rename("base_fb").reset_index()
        valid = valid.merge(fb, on=["Zona", "Hora"], how="left")
        valid["baseline"] = valid["baseline"].fillna(valid["base_fb"]).fillna(base["baseline"].median())
        valid.drop(columns=["base_fb"], inplace=True)
    valid["logb"] = np.log1p(valid["baseline"])
    valid = valid.merge(emb, on="Zona", how="left")
    for c in [col for col in FEATS if col.startswith("z_emb")]:
        if c in valid.columns:
            valid[c] = valid[c].fillna(0.0)

    rows = []
    for h in range(24):
        sub = valid[valid["Hora"] == h].copy()
        if sub.empty:
            continue
        mdl = model._model(h)
        delta = mdl.predict(Pool(sub[FEATS], cat_features=CAT_IDX))
        w = sigmoid((sub["baseline"].values - model.tau) / model.s)
        sub["y_pred"] = np.expm1(sub["logb"].values + w * delta).clip(min=0)
        rows.append(sub)
        print(f"  hora {h:02d}: {len(sub)} filas")

    VAL = pd.concat(rows, ignore_index=True)
    out = pd.DataFrame({
        "Zona": VAL["Zona"].astype(int),
        "Dia": VAL["Dia"].astype(int),
        "Hora": VAL["Hora"].astype(int),
        "Dia_Semana": VAL["Dia_Semana"].astype(int),
        "y_real": VAL["Intensidad"].round(2),
        "baseline": VAL["baseline"].round(2),
        "y_pred": VAL["y_pred"].round(2),
    })
    out["abs_error"] = (out["y_real"] - out["y_pred"]).abs().round(2)
    out["nivel_real"] = out["y_real"].apply(lambda v: classify_level(v, q33, q66))
    out["nivel_pred"] = out["y_pred"].apply(lambda v: classify_level(v, q33, q66))
    out.to_csv(os.path.join(OUT_DATA, "validation_predictions.csv"), index=False)

    mae = mean_absolute_error(out["y_real"], out["y_pred"])
    r2 = r2_score(out["y_real"], out["y_pred"])
    print(f"[OK] validation_predictions.csv ({len(out)} filas) | "
          f"MAE(shrink)={mae:.2f} RMSE={rmse(out['y_real'].values, out['y_pred'].values):.2f} "
          f"R2={r2:.3f} sMAPE={smape(out['y_real'].values, out['y_pred'].values):.2f}")


def main() -> int:
    ensure_dirs()
    _copy_metrics()
    try:
        _validation_predictions()
    except Exception as e:  # pragma: no cover
        print(f"[WARN] No se pudo generar validation_predictions.csv: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
