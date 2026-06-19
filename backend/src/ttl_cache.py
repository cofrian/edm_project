"""Cache en memoria con TTL simple."""

from __future__ import annotations

import time
from typing import Any, TypeVar

T = TypeVar("T")

_store: dict[str, tuple[float, Any]] = {}


def get_cached(key: str) -> Any | None:
    item = _store.get(key)
    if item is None:
        return None
    expires, value = item
    if time.time() > expires:
        _store.pop(key, None)
        return None
    return value


def set_cached(key: str, value: Any, ttl_seconds: float) -> None:
    _store[key] = (time.time() + ttl_seconds, value)


def clear_cache() -> None:
    _store.clear()
