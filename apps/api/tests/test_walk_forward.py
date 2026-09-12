"""Phase 6 walk-forward: snapshot holes fail; complete Friday is yesterday-bounded."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pytest

from app.db.models import CompositeScore, ConsensusSnapshot, PriceBar, UniverseMembership
from worker.backtest.__main__ import main
from worker.backtest.config import load_config
from worker.backtest.store import open_dataset
from worker.backtest.walk_forward import (
    SnapshotGapError,
    latest_complete_evaluation_friday,
    require_no_snapshot_gaps,
    walk_forward,
)


def _toml(tmp_path: Path, dataset: Path) -> Path:
    text = f"""
dataset = "{dataset}"
dataset_sha256 = "deadbeef"
start = "2026-08-07"
end = "2026-09-04"
position_size_usd = 1000
initial_cash = 50000
max_adds_per_evaluation = 1
fill_price = "same_close"
slippage_bps = 0
universe_scope = "all"
params_version_label = "run118"
"""
    path = tmp_path / "run118.toml"
    path.write_text(text)
    return path


def _snapshot(db, as_of: date) -> None:
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=as_of,
            fiscal_period=date(2026, 12, 31),
            eps_avg=2.0,
            revenue_avg=1000.0,
            raw={},
        )
    )


def _fill_weekdays(db, start: date, before: date) -> None:
    cursor = start
    while cursor < before:
        if cursor.weekday() < 5:
            _snapshot(db, cursor)
        cursor += timedelta(days=1)
    db.commit()


def test_latest_complete_friday_ignores_today():
    # Friday 2026-09-04 is an evaluation day; a Friday 08:00 UTC run must not
    # treat today as complete.
    assert latest_complete_evaluation_friday(date(2026, 9, 4)) == date(2026, 8, 21)
    assert latest_complete_evaluation_friday(date(2026, 9, 12)) == date(2026, 9, 4)


def test_require_no_snapshot_gaps_fails_on_a_weekday_hole(db):
    _snapshot(db, date(2026, 9, 7))  # Monday
    db.commit()
    with pytest.raises(SnapshotGapError, match="permanent consensus snapshot hole"):
        require_no_snapshot_gaps(db, date(2026, 9, 11))


def test_walk_forward_fails_loudly_on_snapshot_gap(tmp_path):
    live = open_dataset(tmp_path / "live.sqlite")
    dest = open_dataset(tmp_path / "dataset-v1.sqlite")
    _snapshot(live, date(2026, 9, 7))
    live.commit()
    cfg = load_config(_toml(tmp_path, tmp_path / "dataset-v1.sqlite"))
    with pytest.raises(SnapshotGapError, match="permanent consensus snapshot hole"):
        walk_forward(
            dest,
            live,
            cfg,
            today=date(2026, 9, 11),
            skip_ingest=True,
            skip_score=True,
            require_parity=False,
            dataset_path=tmp_path / "dataset-v1.sqlite",
            manifest_path=tmp_path / "manifest.json",
        )
    live.close()
    dest.close()


def test_walk_forward_exports_and_pins_when_window_already_scored(tmp_path):
    dataset = tmp_path / "dataset-v1.sqlite"
    live_path = tmp_path / "live.sqlite"
    dest = open_dataset(dataset)
    live = open_dataset(live_path)
    today = date(2026, 9, 12)
    _fill_weekdays(live, date(2026, 8, 3), today)
    for as_of in (date(2026, 8, 7), date(2026, 8, 21), date(2026, 9, 4)):
        dest.add(
            CompositeScore(
                ticker="AAA",
                as_of=as_of,
                quant_rating=4.5,
                composite=80.0,
                valuation_grade="A",
                growth_grade="A",
                profitability_grade="A",
                momentum_grade="A",
                revisions_grade="A",
                sector="Technology",
            )
        )
        dest.add(
            UniverseMembership(
                as_of=as_of,
                ticker="AAA",
                universe_scope="top400_live",
                market_cap=2e9,
                close=50.0,
            )
        )
        dest.add(PriceBar(ticker="AAA", date=as_of, close=50.0))
    dest.commit()
    cfg = load_config(_toml(tmp_path, dataset))
    manifest = tmp_path / "manifest.json"
    result = walk_forward(
        dest,
        live,
        cfg,
        today=today,
        skip_ingest=True,
        skip_score=True,
        require_parity=False,
        dataset_path=dataset,
        manifest_path=manifest,
        upload=False,
    )
    live.close()
    dest.close()
    assert result["skipped"] is False
    assert result["complete_friday"] == "2026-09-04"
    assert result["parity"]["skipped"] is True
    assert manifest.exists()
    assert result["exported"]["consensus_snapshots"] >= 1
    assert '"end = "2026-09-04"' in (tmp_path / "run118.toml").read_text() or (
        'end = "2026-09-04"' in (tmp_path / "run118.toml").read_text()
    )


def test_walk_forward_cli_no_parity_on_fixture(tmp_path):
    dataset = tmp_path / "dataset-v1.sqlite"
    live_path = tmp_path / "live.sqlite"
    dest = open_dataset(dataset)
    live = open_dataset(live_path)
    today = date(2026, 9, 12)
    _fill_weekdays(live, date(2026, 8, 3), today)
    dest.add(
        CompositeScore(
            ticker="AAA",
            as_of=date(2026, 9, 4),
            quant_rating=4.5,
            composite=80.0,
            valuation_grade="A",
            growth_grade="A",
            profitability_grade="A",
            momentum_grade="A",
            revisions_grade="A",
            sector="Technology",
        )
    )
    dest.commit()
    dest.close()
    live.close()
    cfg = _toml(tmp_path, dataset)
    assert (
        main(
            [
                "walk-forward",
                "--config",
                str(cfg),
                "--dataset",
                str(dataset),
                "--from-url",
                f"sqlite:///{live_path}",
                "--manifest",
                str(tmp_path / "manifest.json"),
                "--today",
                today.isoformat(),
                "--skip-ingest",
                "--skip-score",
                "--no-parity",
            ]
        )
        == 0
    )
