"""Optimización de cobertura poblacional (Modelo 2 y 3 del notebook SMARTCITIES).

Modelo 2 — un tipo de equipamiento (polideportivo O centro de salud):
    max  Σⱼ pⱼ Yⱼ
    s.a. Yⱼ − Σᵢ αᵢⱼ Xᵢ ≤ 0   ∀j
         Σᵢ cᵢ Xᵢ ≤ presupuesto

Modelo 3 — multi-objetivo (polideportivo + centro de salud):
    max  λ Σⱼ pⱼ Yⱼ + (1−λ) Σⱼ p'ⱼ Y'ⱼ
    s.a. restricciones de cobertura para ambos tipos
         Σᵢ c1ᵢ Xᵢ + Σᵢ c2ᵢ X'ᵢ ≤ presupuesto
         Xᵢ + X'ᵢ ≤ 1
"""

from __future__ import annotations

import pulp

from .coverage_data import (
    coverage_data_available,
    load_candidates_facilities,
    load_coverage_alpha,
    load_population_hexes,
)
from .schemas import FacilityRequest, MultiFacilityRequest, OptimizeResponse, SelectedCandidate


def _fallback_simple(req: FacilityRequest) -> OptimizeResponse:
    """Fallback al optimizador simplificado si faltan artefactos de cobertura."""
    from .optimize_coverage import optimize as simple_opt
    from .schemas import CoverageRequest

    return simple_opt(
        CoverageRequest(
            presupuesto=req.presupuesto,
            alpha_poblacion=1.0,
            beta_trafico=0.0,
            gamma_deficit=0.0,
        )
    )


def _build_response(
    mode: str,
    selected_ids: list[int],
    total_pop: float,
    total_cost: float,
    budget: float,
    facility_type: str,
) -> OptimizeResponse:
    cand = load_candidates_facilities()
    cost_col = "cost_sports" if facility_type == "sports" else "cost_health"
    selected: list[SelectedCandidate] = []
    for cid in selected_ids:
        row = cand[cand["candidate_id"] == cid]
        if row.empty:
            continue
        r = row.iloc[0]
        selected.append(
            SelectedCandidate(
                candidate_id=int(cid),
                lat=float(r["lat"]),
                lon=float(r["lon"]),
                zona=int(r["zona"]) if pd_notna(r.get("zona")) else None,
                score=round(float(r.get("population_in_isochrone", 0)), 2),
                cost=round(float(r[cost_col]), 2),
            )
        )
    selected.sort(key=lambda c: c.score, reverse=True)
    return OptimizeResponse(
        mode=mode,
        selected=selected,
        total_score=round(total_pop, 2),
        total_cost=round(total_cost, 2),
        n_selected=len(selected),
        constraint=f"sum(cost) <= {budget}; cobertura ILP (poblacion real)",
        population_covered=round(total_pop, 0),
    )


def pd_notna(v) -> bool:
    import pandas as pd
    return v is not None and pd.notna(v)


def _alpha_matrix(alpha_data: dict) -> dict[int, list[int]]:
    return {
        int(k): [int(h) for h in v]
        for k, v in alpha_data.get("alpha", {}).items()
    }


def _covering_vars(h: int, alpha: dict[int, list[int]], X: dict[int, pulp.LpVariable]):
    return [X[cid] for cid, hexes in alpha.items() if h in hexes and cid in X]


def optimize_facility(req: FacilityRequest) -> OptimizeResponse:
    if not coverage_data_available():
        return _fallback_simple(req)

    pop = load_population_hexes()
    alpha_data = load_coverage_alpha()
    cand = load_candidates_facilities()
    alpha = _alpha_matrix(alpha_data)

    if pop.empty or cand.empty:
        return _fallback_simple(req)

    facility = req.facility_type
    weight_col = "weight_sports" if facility == "sports" else "weight_health"
    cost_col = "cost_sports" if facility == "sports" else "cost_health"
    mode_label = "polideportivo" if facility == "sports" else "centro_salud"

    hex_ids = pop["hex_id"].tolist()
    weights = dict(zip(pop["hex_id"], pop[weight_col]))
    active_hexes = [h for h in hex_ids if weights.get(h, 0) > 0]

    prob = pulp.LpProblem(f"coverage_{facility}", pulp.LpMaximize)
    X = {int(r["candidate_id"]): pulp.LpVariable(f"X_{r['candidate_id']}", cat="Binary")
         for _, r in cand.iterrows()}
    Y = {h: pulp.LpVariable(f"Y_{h}", cat="Binary") for h in active_hexes}

    prob += pulp.lpSum(weights[h] * Y[h] for h in active_hexes)

    for h in active_hexes:
        cover = _covering_vars(int(h), alpha, X)
        if cover:
            prob += (Y[h] - pulp.lpSum(cover) <= 0, f"cover_{h}")

    prob += (
        pulp.lpSum(float(cand.loc[cand["candidate_id"] == cid, cost_col].iloc[0]) * X[cid]
                   for cid in X)
        <= req.presupuesto,
        "budget",
    )

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    selected_ids = [cid for cid, var in X.items() if var.value() and var.value() > 0.5]
    total_cost = sum(
        float(cand.loc[cand["candidate_id"] == cid, cost_col].iloc[0])
        for cid in selected_ids
    )
    total_pop = sum(
        weights[h] * Y[h].value()
        for h in active_hexes
        if Y[h].value() and Y[h].value() > 0.5
    )

    return _build_response(mode_label, selected_ids, total_pop, total_cost, req.presupuesto, facility)


def optimize_multi(req: MultiFacilityRequest) -> OptimizeResponse:
    if not coverage_data_available():
        from .schemas import FacilityRequest
        return optimize_facility(
            FacilityRequest(presupuesto=req.presupuesto, facility_type="sports")
        )

    pop = load_population_hexes()
    alpha_data = load_coverage_alpha()
    cand = load_candidates_facilities()
    alpha = _alpha_matrix(alpha_data)

    hex_ids = pop["hex_id"].tolist()
    w_sports = dict(zip(pop["hex_id"], pop["weight_sports"]))
    w_health = dict(zip(pop["hex_id"], pop["weight_health"]))
    active = [h for h in hex_ids if w_sports.get(h, 0) > 0 or w_health.get(h, 0) > 0]

    prob = pulp.LpProblem("coverage_multi", pulp.LpMaximize)
    X = {int(r["candidate_id"]): pulp.LpVariable(f"Xs_{r['candidate_id']}", cat="Binary")
         for _, r in cand.iterrows()}
    Xp = {int(r["candidate_id"]): pulp.LpVariable(f"Xh_{r['candidate_id']}", cat="Binary")
          for _, r in cand.iterrows()}
    Y = {h: pulp.LpVariable(f"Ys_{h}", cat="Binary") for h in active}
    Yp = {h: pulp.LpVariable(f"Yh_{h}", cat="Binary") for h in active}

    lam = req.lambda_sports
    prob += pulp.lpSum(
        lam * w_sports.get(h, 0) * Y[h] + (1 - lam) * w_health.get(h, 0) * Yp[h]
        for h in active
    )

    for h in active:
        sports_cover = _covering_vars(int(h), alpha, X)
        health_cover = _covering_vars(int(h), alpha, Xp)
        if sports_cover:
            prob += (Y[h] - pulp.lpSum(sports_cover) <= 0, f"cover_s_{h}")
        if health_cover:
            prob += (Yp[h] - pulp.lpSum(health_cover) <= 0, f"cover_h_{h}")

    prob += (
        pulp.lpSum(
            float(cand.loc[cand["candidate_id"] == cid, "cost_sports"].iloc[0]) * X[cid]
            + float(cand.loc[cand["candidate_id"] == cid, "cost_health"].iloc[0]) * Xp[cid]
            for cid in X
        )
        <= req.presupuesto
    )

    for cid in X:
        prob += X[cid] + Xp[cid] <= 1, f"one_per_site_{cid}"

    prob.solve(pulp.PULP_CBC_CMD(msg=False))

    selected: list[SelectedCandidate] = []
    total_cost = 0.0
    total_pop = 0.0
    for cid in X:
        row = cand[cand["candidate_id"] == cid].iloc[0]
        if X[cid].value() and X[cid].value() > 0.5:
            selected.append(SelectedCandidate(
                candidate_id=cid, lat=float(row["lat"]), lon=float(row["lon"]),
                zona=int(row["zona"]), score=float(row["population_in_isochrone"]),
                cost=float(row["cost_sports"]), facility_type="polideportivo",
            ))
            total_cost += float(row["cost_sports"])
        elif Xp[cid].value() and Xp[cid].value() > 0.5:
            selected.append(SelectedCandidate(
                candidate_id=cid, lat=float(row["lat"]), lon=float(row["lon"]),
                zona=int(row["zona"]), score=float(row["population_in_isochrone"]),
                cost=float(row["cost_health"]), facility_type="centro_salud",
            ))
            total_cost += float(row["cost_health"])

    for h in active:
        if Y[h].value() and Y[h].value() > 0.5:
            total_pop += lam * w_sports.get(h, 0)
        if Yp[h].value() and Yp[h].value() > 0.5:
            total_pop += (1 - lam) * w_health.get(h, 0)

    selected.sort(key=lambda c: c.score, reverse=True)
    return OptimizeResponse(
        mode="multi",
        selected=selected,
        total_score=round(total_pop, 2),
        total_cost=round(total_cost, 2),
        n_selected=len(selected),
        constraint=f"sum(cost) <= {req.presupuesto}; multi ILP lambda={lam}",
        population_covered=round(total_pop, 0),
    )
