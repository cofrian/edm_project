"""Métricas de sistema (CPU, RAM) para ModelOps / monitorización."""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone


def system_metrics() -> dict:
    out: dict = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pid": os.getpid(),
    }
    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        out.update(
            {
                "available": True,
                "cpu_percent": psutil.cpu_percent(interval=0.05),
                "ram_percent": round(vm.percent, 1),
                "ram_used_mb": round(vm.used / (1024**2)),
                "ram_total_mb": round(vm.total / (1024**2)),
                "disk_percent": round(psutil.disk_usage("/").percent, 1),
            }
        )
    except Exception:
        out["available"] = False
        out["note"] = "psutil no disponible en este entorno"
    out["uptime_seconds"] = round(time.process_time(), 1)
    return out
