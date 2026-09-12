"""Phase 6 walk-forward: snapshot holes fail; complete Friday is yesterday-bounded."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.db.models import (
    CompositeScore,
    ConsensusSnapshot,
    Evaluation,
    Portfolio,
    PriceBar,
    Trade,
    UniverseMembership,
)
from worker.backtest.__main__ import main
from worker.backtest.config import load_config
from worker.backtest.store import open_dataset
from worker.backtest.walk_forward import (
    LedgerParityError,
    SnapshotGapError,
    dataset_ledger_diff,
    emit_github_output,
    engine_drift_check,
    latest_complete_evaluation_friday,
    mismatch_rows,
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


def _score(db, ticker: str, as_of: date, qr: float = 4.8) -> None:
    db.add(
        CompositeScore(
            ticker=ticker,
            as_of=as_of,
            quant_rating=qr,
            composite=90.0,
            valuation_grade="A",
            growth_grade="A",
            profitability_grade="A",
            momentum_grade="A",
            revisions_grade="A",
            sector="Technology",
        )
    )


def _bar(db, ticker: str, as_of: date, close: float = 50.0) -> None:
    db.add(PriceBar(ticker=ticker, date=as_of, close=close))


def _live_book(db, cash: float = 100_000.0) -> Portfolio:
    p = Portfolio(
        id=1,
        name="live",
        cash=cash,
        kind="live",
        params_json={"position_size_usd": 1000},
    )
    db.add(p)
    db.commit()
    return p


def _engine_trade(
    db,
    portfolio: Portfolio,
    ticker: str,
    as_of: date,
    *,
    side: str = "buy",
    action: str = "buy",
) -> None:
    ev = Evaluation(
        portfolio_id=portfolio.id,
        mode="biweekly",
        params_version="test",
        executed=True,
    )
    db.add(ev)
    db.flush()
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            evaluation_id=ev.id,
            ticker=ticker,
            side=side,
            action=action,
            shares=20.0,
            price=50.0,
            notional=1000.0,
            timestamp=datetime(
                as_of.year, as_of.month, as_of.day, 20, 0, tzinfo=timezone.utc
            ),
        )
    )
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
    assert result["engine_drift"]["skipped"] is True
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


def test_dataset_ledger_diff_writes_summary_and_does_not_raise(
    tmp_path, db, portfolio, monkeypatch
):
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    dest = open_dataset(tmp_path / "dataset.sqlite")
    friday = date(2026, 8, 7)
    _score(dest, "AAA", friday)
    _bar(dest, "AAA", friday)
    dest.commit()
    cfg = load_config(_toml(tmp_path, tmp_path / "dataset.sqlite"))
    payload = dataset_ledger_diff(dest, db, cfg, portfolio_id=portfolio.id)
    dest.close()
    assert payload["parity"] is False
    rows = mismatch_rows(payload)
    assert any(r["ticker"] == "AAA" and r["date"] == "2026-08-07" for r in rows["only_in_replay"])
    text = summary.read_text()
    assert "Dataset vs live ledger" in text
    assert "2026-08-07" in text
    assert "AAA" in text
    assert "| date | ticker | side | action |" in text


def test_engine_drift_check_passes_when_live_scores_match_ledger(tmp_path, db, portfolio):
    friday = date(2026, 8, 7)
    _score(db, "AAA", friday)
    _bar(db, "AAA", friday)
    _engine_trade(db, portfolio, "AAA", friday)
    cfg = load_config(_toml(tmp_path, tmp_path / "unused.sqlite"))
    payload = engine_drift_check(db, cfg, portfolio_id=portfolio.id)
    assert payload["parity"] is True
    assert payload["skipped"] is False


def test_engine_drift_check_raises_when_live_scores_disagree(tmp_path, db, portfolio):
    friday = date(2026, 8, 7)
    _score(db, "AAA", friday)
    _bar(db, "AAA", friday)
    _engine_trade(db, portfolio, "BBB", friday)
    cfg = load_config(_toml(tmp_path, tmp_path / "unused.sqlite"))
    with pytest.raises(LedgerParityError, match="engine drift"):
        engine_drift_check(db, cfg, portfolio_id=portfolio.id)


def test_walk_forward_keeps_pin_when_dataset_ledger_disagrees(tmp_path, monkeypatch):
    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    dataset = tmp_path / "dataset-v1.sqlite"
    live_path = tmp_path / "live.sqlite"
    dest = open_dataset(dataset)
    live = open_dataset(live_path)
    today = date(2026, 9, 12)
    _fill_weekdays(live, date(2026, 8, 3), today)
    _live_book(live)
    friday = date(2026, 8, 7)
    for as_of in (friday, date(2026, 8, 21), date(2026, 9, 4)):
        _score(dest, "AAA", as_of)
        _bar(dest, "AAA", as_of)
        dest.add(
            UniverseMembership(
                as_of=as_of,
                ticker="AAA",
                universe_scope="top400_live",
                market_cap=2e9,
                close=50.0,
            )
        )
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
        require_parity=True,
        dataset_path=dataset,
        manifest_path=manifest,
        upload=False,
    )
    live.close()
    dest.close()
    assert result["parity"]["parity"] is False
    assert result["engine_drift"]["parity"] is True
    assert manifest.exists()
    text = summary.read_text()
    assert "AAA" in text
    assert "2026-08-07" in text
    rows = mismatch_rows(result["parity"])
    assert any(r["ticker"] == "AAA" for r in rows["only_in_replay"])


def test_walk_forward_hard_fails_on_engine_drift(tmp_path):
    dataset = tmp_path / "dataset-v1.sqlite"
    live_path = tmp_path / "live.sqlite"
    dest = open_dataset(dataset)
    live = open_dataset(live_path)
    today = date(2026, 9, 12)
    _fill_weekdays(live, date(2026, 8, 3), today)
    portfolio = _live_book(live)
    friday = date(2026, 8, 7)
    _score(live, "AAA", friday)
    _bar(live, "AAA", friday)
    _engine_trade(live, portfolio, "BBB", friday)
    dest.commit()
    cfg = load_config(_toml(tmp_path, dataset))
    with pytest.raises(LedgerParityError, match="engine drift"):
        walk_forward(
            dest,
            live,
            cfg,
            today=today,
            skip_ingest=True,
            skip_score=True,
            require_parity=True,
            dataset_path=dataset,
            manifest_path=tmp_path / "manifest.json",
            upload=False,
        )
    live.close()
    dest.close()


def test_emit_github_output_separates_dataset_parity_from_engine_drift(
    tmp_path, monkeypatch
):
    out = tmp_path / "github_output.txt"
    monkeypatch.setenv("GITHUB_OUTPUT", str(out))
    emit_github_output(
        {
            "changed": True,
            "new_sha256": "abc",
            "new_end": "2026-09-04",
            "parity": {"parity": False},
            "engine_drift": {"parity": True},
        }
    )
    text = out.read_text()
    assert "changed=true" in text
    assert "parity=false" in text
    assert "engine_drift=true" in text


def test_walk_forward_rescores_stale_derive_version(tmp_path):
    from app.db.models import Fundamentals, MarketCapHistory, Stock
    from worker.services.backtest_derive import DERIVE_VERSION

    dataset = tmp_path / "dataset-v1.sqlite"
    live_path = tmp_path / "live.sqlite"
    dest = open_dataset(dataset)
    live = open_dataset(live_path)
    today = date(2026, 9, 12)
    _fill_weekdays(live, date(2026, 8, 3), today)
    dest.add(
        Stock(
            ticker="AAA",
            sector="Technology",
            market_cap=2e9,
            is_active=True,
            is_etf=False,
        )
    )
    for as_of in (date(2026, 8, 7), date(2026, 8, 21), date(2026, 9, 4)):
        _score(dest, "AAA", as_of)
        _bar(dest, "AAA", as_of)
        dest.add(MarketCapHistory(ticker="AAA", date=as_of, market_cap=2e9))
        dest.add(
            UniverseMembership(
                as_of=as_of,
                ticker="AAA",
                universe_scope="top400_live",
                market_cap=2e9,
                close=50.0,
            )
        )
        dest.add(
            Fundamentals(
                ticker="AAA",
                as_of=as_of,
                data={
                    "source": "pit",
                    "deriveVersion": 1,
                    "universe_scope": "top400_live",
                },
            )
        )
    dest.commit()
    cfg = load_config(_toml(tmp_path, dataset))
    result = walk_forward(
        dest,
        live,
        cfg,
        today=today,
        skip_ingest=True,
        skip_score=False,
        require_parity=False,
        dataset_path=dataset,
        manifest_path=tmp_path / "manifest.json",
        upload=False,
    )
    assert result["scored"]["n_fridays"] >= 1
    pit = (
        dest.query(Fundamentals)
        .filter(Fundamentals.ticker == "AAA", Fundamentals.as_of == date(2026, 8, 7))
        .one()
    )
    assert pit.data.get("deriveVersion") == DERIVE_VERSION
    live.close()
    dest.close()
