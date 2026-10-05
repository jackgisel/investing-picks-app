"""The X graphic allowlist.

The web app owns the list (`apps/web/src/lib/income-visual/themes.json`).
The worker reads the same file so a name on it is ingested even when it sits
under the broad market-cap floor. The image is copied to `/x-themes.json` in
the worker image.
"""

from __future__ import annotations

import json
from pathlib import Path

_CANDIDATES = (
    Path("/x-themes.json"),
    Path(__file__).resolve().parents[4]
    / "apps/web/src/lib/income-visual/themes.json",
)


def theme_tickers() -> frozenset[str]:
    for path in _CANDIDATES:
        if not path.is_file():
            continue
        data = json.loads(path.read_text())
        return frozenset(
            str(ticker).upper()
            for names in data.get("themes", {}).values()
            for ticker in names
        )
    return frozenset()
