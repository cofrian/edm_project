"""Selector de solver CBC compatible con local, CI y Docker."""

from __future__ import annotations

import shutil

import pulp


def cbc_solver(msg: bool = False) -> pulp.LpSolver:
    """Usa CBC del sistema si existe; si no, cae al binario empaquetado por PuLP."""
    cbc_path = shutil.which("cbc")
    if cbc_path:
        return pulp.COIN_CMD(path=cbc_path, msg=msg)
    return pulp.PULP_CBC_CMD(msg=msg)
