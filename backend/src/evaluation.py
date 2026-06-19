"""Análisis de errores a partir de las predicciones de validación."""

from __future__ import annotations

from .data_loader import load_validation_predictions
from .zone_labels import zone_label


def _prepare_errors_df():
    df = load_validation_predictions()
    if df.empty or "Zona" not in df.columns:
        return None
    err_col = "abs_error" if "abs_error" in df.columns else None
    if err_col is None and {"y_real", "y_pred"}.issubset(df.columns):
        df = df.assign(abs_error=(df["y_real"] - df["y_pred"]).abs())
        err_col = "abs_error"
    if err_col is None:
        return None
    return df, err_col


def errors_by_zone(top: int = 15, hora: int | None = None) -> list[dict]:
    prepared = _prepare_errors_df()
    if prepared is None:
        return []
    df, err_col = prepared
    if hora is not None and "Hora" in df.columns:
        df = df[df["Hora"] == hora]
        if df.empty:
            return []
    g = (
        df.groupby("Zona")[err_col]
        .mean()
        .sort_values(ascending=False)
        .head(top)
        .reset_index()
        .rename(columns={err_col: "mae"})
    )
    g["mae"] = g["mae"].round(2)
    records = g.to_dict(orient="records")
    for row in records:
        z = int(row["Zona"])
        row["descripcion"] = zone_label(z)
        row["calle"] = row["descripcion"]
    return records


def scatter_sample(n: int = 500) -> list[dict]:
    """Muestra real vs predicho para el gráfico de dispersión."""
    df = load_validation_predictions()
    if df.empty or not {"y_real", "y_pred"}.issubset(df.columns):
        return []
    sample = df.sample(min(n, len(df)), random_state=42)
    return [
        {"y_real": round(float(r.y_real), 2), "y_pred": round(float(r.y_pred), 2)}
        for r in sample.itertuples()
    ]
