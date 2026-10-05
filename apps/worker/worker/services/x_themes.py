"""The X graphic allowlist.

The web app owns the list (`apps/web/src/lib/income-visual/themes.json`).
The worker reads the same file so a name on it is ingested even when it sits
under the broad market-cap floor. The image is copied to `/x-themes.json` in
the worker image.
"""

from __future__ import annotations

import json
from pathlib import Path

_IMAGE_PATH = Path("/x-themes.json")
_REPO_PATH = "apps/web/src/lib/income-visual/themes.json"


def _candidates() -> list[Path]:
    # The repo checkout is only there in dev. In the worker image the file
    # sits only 3 levels up, so indexing `parents` at import time crashed it.
    paths = [_IMAGE_PATH]
    parents = Path(__file__).resolve().parents
    if len(parents) > 4:
        paths.append(parents[4] / _REPO_PATH)
    return paths


def theme_tickers() -> frozenset[str]:
    for path in _candidates():
        if not path.is_file():
            continue
        data = json.loads(path.read_text())
        return frozenset(
            str(ticker).upper()
            for names in data.get("themes", {}).values()
            for ticker in names
        )
    return frozenset()
