"""Canonical backtest config (`backtests/run118.toml`)."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from datetime import date
from pathlib import Path
import re


def repo_root(start: Path | None = None) -> Path:
    cursor = (start or Path.cwd()).resolve()
    for p in [cursor, *cursor.parents]:
        if (p / "backtests").is_dir() and (p / "packages" / "strategy").is_dir():
            return p
    return cursor


@dataclass(frozen=True)
class BacktestConfig:
    dataset: Path
    dataset_sha256: str
    start: date
    end: date
    position_size_usd: float
    initial_cash: float
    max_adds_per_evaluation: int
    fill_price: str
    slippage_bps: float
    universe_scope: str
    params_version_label: str
    sensitivity_fill_price: str
    sensitivity_slippage_bps: float
    source: Path


def load_config(path: str | Path, *, dataset_override: str | None = None) -> BacktestConfig:
    path = Path(path).resolve()
    raw = tomllib.loads(path.read_text())
    root = repo_root(path)
    dataset = Path(dataset_override) if dataset_override else Path(raw["dataset"])
    if not dataset.is_absolute():
        dataset = (root / dataset).resolve()
    sensitivity = raw.get("sensitivity") or {}
    max_adds = int(raw.get("max_adds_per_evaluation", 1))
    if max_adds != 1:
        raise ValueError(
            f"max_adds_per_evaluation must be 1 (got {max_adds}); "
            "do not reintroduce adaptive max_buys"
        )
    fill_price = raw.get("fill_price", "same_close")
    if fill_price not in ("same_close", "next_close"):
        raise ValueError(f"unknown fill_price {fill_price!r}")
    scope = raw.get("universe_scope", "all")
    if scope not in ("all", "top400_live", "full"):
        raise ValueError(f"unknown universe_scope {scope!r}")
    return BacktestConfig(
        dataset=dataset,
        dataset_sha256=str(raw["dataset_sha256"]),
        start=date.fromisoformat(raw["start"]),
        end=date.fromisoformat(raw["end"]),
        position_size_usd=float(raw["position_size_usd"]),
        initial_cash=float(raw.get("initial_cash", 50_000)),
        max_adds_per_evaluation=1,
        fill_price=fill_price,
        slippage_bps=float(raw.get("slippage_bps", 0)),
        universe_scope=scope,
        params_version_label=str(raw.get("params_version_label", "run118")),
        sensitivity_fill_price=str(sensitivity.get("fill_price", "next_close")),
        sensitivity_slippage_bps=float(sensitivity.get("slippage_bps", 10)),
        source=path,
    )


def update_config_pin(path: str | Path, *, end: date, dataset_sha256: str) -> None:
    """Rewrite `end` and `dataset_sha256` in the canonical toml, keep comments."""
    path = Path(path)
    text = path.read_text()
    text = re.sub(
        r'(?m)^end = ".*"',
        f'end = "{end.isoformat()}"',
        text,
        count=1,
    )
    text = re.sub(
        r'(?m)^dataset_sha256 = ".*"',
        f'dataset_sha256 = "{dataset_sha256}"',
        text,
        count=1,
    )
    path.write_text(text)
