"""Phase 4 CLI: run / report / compare, N≥24 gate, $1,000 sizing."""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from outpick_strategy import RUN118_PARAMS

from app.db.models import CompositeScore, PriceBar, UniverseMembership
from worker.backtest.__main__ import main
from worker.backtest.compare import compare_results
from worker.backtest.config import load_config
from worker.backtest.report import render_report
from worker.backtest.run import params_from_config, run_backtest
from worker.backtest.store import open_dataset

FRIDAY = date(2026, 8, 7)
FRIDAY2 = date(2026, 8, 21)


def _toml(tmp_path: Path, dataset: Path) -> Path:
    text = f"""
dataset = "{dataset}"
dataset_sha256 = "deadbeef"
start = "2026-08-07"
end = "2026-08-21"
position_size_usd = 1000
initial_cash = 50000
max_adds_per_evaluation = 1
fill_price = "same_close"
slippage_bps = 0
universe_scope = "all"
params_version_label = "run118"

[sensitivity]
fill_price = "next_close"
slippage_bps = 10
"""
    path = tmp_path / "run118.toml"
    path.write_text(text)
    return path


def _seed(db):
    for ticker, qr, sector in (
        ("AAA", 4.9, "Technology"),
        ("BBB", 4.8, "Health Care"),
    ):
        for as_of in (FRIDAY, FRIDAY2):
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
                    sector=sector,
                )
            )
            db.add(
                UniverseMembership(
                    as_of=as_of,
                    ticker=ticker,
                    universe_scope="top400_live",
                    market_cap=2e9,
                    close=50.0,
                )
            )
    for d in (FRIDAY, date(2026, 8, 10), FRIDAY2, date(2026, 8, 24)):
        db.add(PriceBar(ticker="AAA", date=d, close=50.0))
        db.add(PriceBar(ticker="BBB", date=d, close=40.0))
    db.commit()


def test_config_pins_thousand_dollar_size_and_one_add(tmp_path):
    dataset = tmp_path / "dataset-v1.sqlite"
    dataset.write_bytes(b"x")
    cfg = load_config(_toml(tmp_path, dataset))
    assert cfg.position_size_usd == 1000
    assert cfg.max_adds_per_evaluation == 1
    assert cfg.initial_cash == 50_000
    params = params_from_config(cfg)
    assert params.position_size_usd == 1000
    assert params.max_adds_per_evaluation == 1
    assert params.version_hash() != RUN118_PARAMS.version_hash()


def test_config_rejects_adaptive_max_adds(tmp_path):
    dataset = tmp_path / "d.sqlite"
    dataset.write_bytes(b"x")
    path = tmp_path / "bad.toml"
    path.write_text(
        f"""
dataset = "{dataset}"
dataset_sha256 = "x"
start = "2026-08-07"
end = "2026-08-21"
position_size_usd = 1000
max_adds_per_evaluation = 3
"""
    )
    with pytest.raises(ValueError, match="must be 1"):
        load_config(path)


def test_run_report_compare_on_a_tiny_dataset(tmp_path):
    dataset = tmp_path / "dataset-v1.sqlite"
    db = open_dataset(dataset)
    _seed(db)
    cfg = load_config(_toml(tmp_path, dataset))
    payload = run_backtest(db, cfg, sensitivity=True, skip_hash=True)
    db.close()

    assert payload["config"]["position_size_usd"] == 1000
    assert payload["config"]["max_adds_per_evaluation"] == 1
    assert payload["diagnostics"]["n_evaluations"] == 2
    assert payload["metrics"]["status"] == "insufficient_sample"
    assert payload["holdout"]["status"] == "insufficient_sample"
    assert payload["gates"]["decision_diff"]["status"] == "ok"
    assert payload["gates"]["holdout"]["status"] == "insufficient_sample"
    assert "cagr_pct" not in payload["metrics"]
    assert "sharpe" not in payload["metrics"]
    assert "return_pct" not in payload["metrics"]
    buys = [t for t in payload["trades"] if t["side"] == "buy"]
    assert len(buys) == 2
    assert all(abs(t["notional"] - 1000) < 1e-6 for t in buys)
    assert payload["sensitivity"]["fill"]["price"] == "next_close"
    assert payload["sensitivity"]["fill"]["slippage_bps"] == 10
    assert "Remove the BUG-P1/P2" in payload["recommendation"]

    md = render_report(payload)
    assert "insufficient sample" in md.lower()
    assert "cagr_pct:" not in md.lower()
    assert "return_pct:" not in md.lower()
    assert "Remove the BUG-P1/P2" in md

    out = tmp_path / "result.json"
    baseline = tmp_path / "baseline.json"
    from worker.backtest.run import write_result

    write_result(payload, out)
    write_result(payload, baseline)
    match = compare_results(payload, payload)
    assert match["exit_code"] == 0

    from app.services.backtest_metrics import compare_payload

    left = dict(payload)
    right = dict(payload)
    right["trades"] = []
    right["compare"] = compare_payload(right)
    left["compare"] = compare_payload(left)
    det = compare_results(left, right)
    assert det["status"] == "determinism_failure"
    assert det["exit_code"] == 1

    stale = dict(payload)
    stale["params_version"] = "changed"
    stale["compare"] = compare_payload(stale)
    base = dict(payload)
    base["compare"] = compare_payload(base)
    assert compare_results(stale, base)["exit_code"] == 2

    tape = dict(payload)
    tape["tape_version"] = 2
    tape["compare"] = compare_payload(tape)
    old_tape = dict(payload)
    old_tape["tape_version"] = 1
    old_tape["compare"] = compare_payload(old_tape)
    report = compare_results(tape, old_tape)
    assert report["status"] == "baseline_stale"
    assert report["exit_code"] == 2
    assert report["same_data"] is False


def test_cli_run_report_compare_roundtrip(tmp_path):
    dataset = tmp_path / "dataset-v1.sqlite"
    db = open_dataset(dataset)
    _seed(db)
    db.close()
    cfg = _toml(tmp_path, dataset)
    out = tmp_path / "result.json"
    md = tmp_path / "report.md"
    assert (
        main(
            [
                "run",
                "--config",
                str(cfg),
                "--dataset",
                str(dataset),
                "--out",
                str(out),
                "--skip-hash",
            ]
        )
        == 0
    )
    assert out.exists()
    assert main(["report", str(out), "--out", str(md)]) == 0
    text = md.read_text().lower()
    assert "insufficient sample" in text
    assert "cagr_pct:" not in text
    assert "holdout" in text
    assert main(["compare", str(out), str(out)]) == 0
    assert (
        main(
            [
                "compare",
                str(out),
                str(out),
                "--sweep",
                "--config",
                str(cfg),
                "--dataset",
                str(dataset),
                "--skip-hash",
            ]
        )
        == 0
    )


def test_shipped_toml_is_canonical():
    from worker.backtest.config import repo_root

    cfg = load_config(repo_root() / "backtests/run118.toml")
    assert cfg.position_size_usd == 1000
    assert cfg.max_adds_per_evaluation == 1
    assert cfg.initial_cash == 50_000
    assert cfg.fill_price == "same_close"
    assert cfg.slippage_bps == 0
    assert cfg.sensitivity_fill_price == "next_close"
    assert cfg.sensitivity_slippage_bps == 10
    assert cfg.dataset_sha256 == (
        "b052a791ebc827e7e750b7a251b07e515235708fe612a1e4b0bf9192a6f724c0"
    )


def test_fetch_pinned_dataset_from_url_and_cache(tmp_path, monkeypatch):
    import hashlib
    import json

    from worker.backtest.download import fetch_pinned_dataset

    blob = b"pinned-dataset-bytes"
    remote = tmp_path / "remote.sqlite"
    remote.write_bytes(blob)
    digest = hashlib.sha256(blob).hexdigest()
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps({"dataset": "dataset-v1.sqlite", "sha256": digest, "bytes": len(blob)})
    )
    monkeypatch.setenv("BACKTEST_DATASET_URL", remote.resolve().as_uri())
    dest = tmp_path / "dataset-v1.sqlite"
    first = fetch_pinned_dataset(dest, manifest=manifest)
    assert dest.read_bytes() == blob
    assert first["cached"] is False
    assert first["sha256"] == digest
    second = fetch_pinned_dataset(dest, manifest=manifest)
    assert second["cached"] is True


def test_fetch_pinned_dataset_rejects_hash_mismatch(tmp_path, monkeypatch):
    import json

    from worker.backtest.download import fetch_pinned_dataset

    remote = tmp_path / "remote.sqlite"
    remote.write_bytes(b"nope")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"dataset": "dataset-v1.sqlite", "sha256": "abc"}))
    monkeypatch.setenv("BACKTEST_DATASET_URL", remote.resolve().as_uri())
    with pytest.raises(RuntimeError, match="hash mismatch"):
        fetch_pinned_dataset(tmp_path / "out.sqlite", manifest=manifest)


def test_equity_csv_and_update_baseline_compare(tmp_path):
    from worker.backtest.compare import compare_results
    from worker.backtest.report import write_equity_csv

    result = {
        "equity_curve": [
            {"date": "2026-08-07", "cash": 49000, "invested": 1000, "equity": 50000, "position_count": 1}
        ],
        "compare": {"params_version": "aaa", "dataset_sha256": "bbb", "trades": [1]},
    }
    csv_path = write_equity_csv(result, tmp_path / "eq.csv")
    text = csv_path.read_text()
    assert text.splitlines()[0] == "date,cash,invested,equity,position_count"
    assert "2026-08-07,49000,1000,50000,1" in text

    drifted = {"compare": {"params_version": "ccc", "dataset_sha256": "ddd", "trades": []}}
    stale = compare_results(result, drifted)
    assert stale["exit_code"] == 2
    refreshed = compare_results(result, drifted, update_baseline=True)
    assert refreshed["exit_code"] == 0
    assert refreshed["status"] == "update_baseline"


def test_workflow_declares_the_backtest_job():
    from worker.backtest.config import repo_root

    text = (repo_root() / ".github/workflows/test.yml").read_text()
    assert "name: backtest" in text
    assert "scripts/backtest-ci.sh" in text
    assert "backtests/baselines/run118.json" in text
    assert "cron: \"0 8 * * *\"" in text
    assert "run-backtest" in text
    assert "actions/cache@v4" in text
    assert "BACKTEST_DATASET_URL" in text
    assert "name: walk-forward" in text
    assert "scripts/walk-forward-ci.sh" in text
    assert "peter-evans/create-pull-request" in text
    assert "Engine drift" in text
    assert "do not block this PR" in text
    assert "STRATEGY_CHANGELOG.md" in text


def test_sweep_never_touches_max_adds_or_size_and_reports_experiments(tmp_path):
    from worker.backtest.sweep import NEVER_SWEEP, SWEEP_FIELDS, run_sweep

    assert "max_adds_per_evaluation" in NEVER_SWEEP
    assert "position_size_usd" in NEVER_SWEEP
    assert "max_adds_per_evaluation" not in SWEEP_FIELDS

    dataset = tmp_path / "dataset-v1.sqlite"
    db = open_dataset(dataset)
    _seed(db)
    cfg = load_config(_toml(tmp_path, dataset))
    payload = run_backtest(db, cfg, sensitivity=False, skip_hash=True)
    report = run_sweep(db, cfg, payload, skip_hash=True)
    db.close()
    assert report["canonical_position_size_usd"] == 1000
    assert report["max_adds_per_evaluation"] == 1
    names = {row["name"] for row in report["rows"]}
    assert "hold_removal_rating_plus_10pct" in names
    assert "sector_concentration_minus_10pct" in names
    exp = {row["name"] for row in report["experiments"]}
    assert "min_holding_days_30" in exp
    assert "drawdown_breaker_on" in exp
    assert "hold_removal_2_7" in exp
    assert "sector_cap_20pct" in exp
    deferred = {row["name"] for row in report["deferred"]}
    assert "four_window_momentum" in deferred
    params = params_from_config(cfg, {"max_adds_per_evaluation": 9, "position_size_usd": 50})
    assert params.max_adds_per_evaluation == 1
    assert params.position_size_usd == 1000


def test_walk_forward_cli_skips_without_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    assert main(["walk-forward"]) == 0


def test_update_config_pin_rewrites_end_and_hash(tmp_path):
    from datetime import date as date_cls

    from worker.backtest.config import update_config_pin

    dataset = tmp_path / "d.sqlite"
    dataset.write_bytes(b"x")
    path = _toml(tmp_path, dataset)
    update_config_pin(
        path, end=date_cls(2026, 9, 18), dataset_sha256="abc" * 10 + "abcd"
    )
    text = path.read_text()
    assert 'end = "2026-09-18"' in text
    assert "abcabcabcabcabcabcabcabcabcabcabcd" in text
    assert "position_size_usd = 1000" in text

