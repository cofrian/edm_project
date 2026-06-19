"""Modo A — Optimización de ubicaciones Valenbisi / movilidad sostenible (PuLP).

Programación lineal entera binaria:

    x_i ∈ {0,1}
    score_i = α·trafico_i + β·poblacion_i + γ·deficit_i   (cada término normalizado)
    max  Σ score_i · x_i
    s.a. Σ x_i = N
"""

from __future__ import annotations

import pandas as pd
import pulp

from .data_loader import load_candidates_valenbisi
from .schemas import OptimizeResponse, SelectedCandidate, ValenbisiRequest
from .scoring import minmax
from .solver import cbc_solver


def optimize(req: ValenbisiRequest) -> OptimizeResponse:
    df = load_candidates_valenbisi().copy()
    if df.empty:
        return OptimizeResponse(
            mode="valenbisi", selected=[], total_score=0.0, total_cost=0.0,
            n_selected=0, constraint=f"sum(x) = {req.n}",
        )

    df["s_traf"] = minmax(df.get("traffic_score", 0))
    df["s_pob"] = minmax(df.get("population_score", 0))
    df["s_def"] = minmax(df.get("valenbisi_deficit_score", 0))
    df["score"] = (
        req.alpha_trafico * df["s_traf"]
        + req.beta_poblacion * df["s_pob"]
        + req.gamma_deficit * df["s_def"]
    )

    n = min(req.n, len(df))
    prob = pulp.LpProblem("valenbisi", pulp.LpMaximize)
    x = {i: pulp.LpVariable(f"x_{i}", cat="Binary") for i in df.index}
    prob += pulp.lpSum(df.loc[i, "score"] * x[i] for i in df.index)
    prob += pulp.lpSum(x[i] for i in df.index) == n
    prob.solve(cbc_solver(msg=False))

    selected: list[SelectedCandidate] = []
    total_score = total_cost = 0.0
    for i in df.index:
        if x[i].value() and x[i].value() > 0.5:
            row = df.loc[i]
            cost = float(row.get("cost", 0) or 0)
            selected.append(
                SelectedCandidate(
                    candidate_id=int(row.get("candidate_id", i)),
                    lat=float(row["lat"]), lon=float(row["lon"]),
                    zona=int(row["zona"]) if "zona" in row and pd.notna(row["zona"]) else None,
                    score=round(float(row["score"]), 4), cost=round(cost, 2),
                )
            )
            total_score += float(row["score"])
            total_cost += cost

    selected.sort(key=lambda c: c.score, reverse=True)
    return OptimizeResponse(
        mode="valenbisi", selected=selected,
        total_score=round(total_score, 4), total_cost=round(total_cost, 2),
        n_selected=len(selected), constraint=f"sum(x) = {n}",
    )
