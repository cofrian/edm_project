"""Copia los 24 modelos CatBoost entrenados + artefactos de apoyo a backend/models.

NO reentrena. Renombra `cat_hour_HH.cbm` -> `catboost_hour_HH.cbm`.
Los `.cbm` se versionan con Git LFS (ver .gitattributes).
"""

from __future__ import annotations

import shutil
import sys

from common import OUT_MODELS, SRC_MODELS, ensure_dirs


SUPPORT_FILES = [
    "baseline_oct2023_SMOO.csv",
    "zone_embeddings.csv",
    "ratio_prior.csv",
    "shrink_cfg.json",
    "metrics_by_hour_cat_raw.csv",
]


def main() -> int:
    ensure_dirs()
    import os

    if not os.path.isdir(SRC_MODELS):
        print(f"[ERROR] No existe la carpeta de modelos fuente: {SRC_MODELS}")
        return 1

    copied = 0
    for h in range(24):
        src = os.path.join(SRC_MODELS, f"cat_hour_{h:02d}.cbm")
        dst = os.path.join(OUT_MODELS, f"catboost_hour_{h:02d}.cbm")
        if os.path.exists(src):
            shutil.copy2(src, dst)
            copied += 1
        else:
            print(f"[WARN] Falta {src}")
    print(f"[OK] Copiados {copied}/24 modelos .cbm a {OUT_MODELS}")

    for name in SUPPORT_FILES:
        src = os.path.join(SRC_MODELS, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(OUT_MODELS, name))
            print(f"[OK] {name}")
        else:
            print(f"[WARN] Falta artefacto de apoyo {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
