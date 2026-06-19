"""Modo B — Optimización de cobertura urbana bajo presupuesto (PuLP).

Programación lineal entera binaria:

    x_i ∈ {0,1}
    score_i = α·poblacion_i + β·trafico_i + γ·deficit_i   (cada término normalizado)
    max  Σ score_i · x_i
    s.a. Σ coste_i · x_i ≤ presupuesto
"""

from __future__ import annotations

import pandas as pd
import pulp

from .data_loader import load_coverage_candidates
from .schemas import CoverageRequest, OptimizeResponse, SelectedCandidate
from .scoring import minmax
from .solver import cbc_solver


def optimize(req: CoverageRequest) -> OptimizeResponse:
    df = load_coverage_candidates().copy()
    if df.empty:
        return OptimizeResponse(
            mode="coverage", selected=[], total_score=0.0, total_cost=0.0,
            n_selected=0, constraint=f"sum(cost*x) <= {req.presupuesto}",
        )

    df["s_pob"] = minmax(df.get("population_covered", 0))
    df["s_traf"] = minmax(df.get("traffic_pressure", 0))
    df["s_def"] = minmax(df.get("coverage_deficit", 0))
    df["score"] = (
        req.alpha_poblacion * df["s_pob"]
        + req.beta_trafico * df["s_traf"]
        + req.gamma_deficit * df["s_def"]
    )
    df["cost"] = df.get("cost", 1.0).fillna(1.0)

    prob = pulp.LpProblem("coverage", pulp.LpMaximize)
    x = {i: pulp.LpVariable(f"x_{i}", cat="Binary") for i in df.index}
    prob += pulp.lpSum(df.loc[i, "score"] * x[i] for i in df.index)
    prob += pulp.lpSum(float(df.loc[i, "cost"]) * x[i] for i in df.index) <= req.presupuesto
    prob.solve(cbc_solver(msg=False))

    selected: list[SelectedCandidate] = []
    total_score = total_cost = 0.0
    for i in df.index:
        if x[i].value() and x[i].value() > 0.5:
            row = df.loc[i]
            cost = float(row["cost"])
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
        mode="coverage", selected=selected,
        total_score=round(total_score, 4), total_cost=round(total_cost, 2),
        n_selected=len(selected), constraint=f"sum(cost*x) <= {req.presupuesto}",
    )
