"""Cálculo de scores normalizados para la optimización."""

from __future__ import annotations

import pandas as pd


def minmax(s: pd.Series) -> pd.Series:
    lo, hi = float(s.min()), float(s.max())
    if hi - lo < 1e-9:
        return pd.Series([0.0] * len(s), index=s.index)
    return (s - lo) / (hi - lo)
