"""Cliente HTTP mínimo (stdlib) para integraciones externas."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any


def get_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 30.0,
) -> Any:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))
