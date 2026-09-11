"""Content-hash the dataset file and pin it in datasets/manifest.json."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

MANIFEST_NAME = "manifest.json"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(
    dataset_path: Path,
    manifest_path: Path,
    *,
    extra: dict | None = None,
) -> dict:
    payload = {
        "dataset": dataset_path.name,
        "sha256": sha256_file(dataset_path),
        "bytes": dataset_path.stat().st_size,
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    if extra:
        payload.update(extra)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(payload, indent=2) + "\n")
    return payload
