"""Run the shipped engine over a scored dataset and write a result JSON."""

from __future__ import annotations

import hashlib
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, StrategyParams
from outpick_strategy.cadence import evaluation_fridays_between

from app.db.models import CompositeScore, PriceBar, UniverseMembership
from app.services.backtest_metrics import (
    MIN_EVALUATIONS_FOR_HOLDOUT,
    MIN_EVALUATIONS_FOR_RETURNS,
    assert_no_return_metrics,
    compare_payload,
    decision_diagnostics,
    holdout_split,
    promotion_gates,
    risk_return_metrics,
)
from app.services.portfolio import load_scores_as_of
from app.services.replay import FillModel, ReplayResult, replay
from worker.backtest.config import BacktestConfig
from worker.backtest.manifest import sha256_file


def params_from_config(
    cfg: BacktestConfig, overrides: dict | None = None
) -> StrategyParams:
    kwargs: dict = {
        "position_size_usd": cfg.position_size_usd,
        "max_adds_per_evaluation": 1,
    }
    for key, value in (overrides or {}).items():
        if key in ("max_adds_per_evaluation", "position_size_usd"):
            continue
        kwargs[key] = value
    kwargs["max_adds_per_evaluation"] = 1
    kwargs["position_size_usd"] = cfg.position_size_usd
    params = RUN118_PARAMS.with_overrides(**kwargs)
    if params.max_adds_per_evaluation != 1:
        raise ValueError("max_adds_per_evaluation must stay 1")
    return params


def scored_eval_dates(
    db: Session, start: date, end: date, universe_scope: str
) -> list[date]:
    """Evaluation Fridays that have materialised scores (and optional scope)."""
    scored = {
        row[0]
        for row in db.query(CompositeScore.as_of)
        .filter(CompositeScore.as_of >= start, CompositeScore.as_of <= end)
        .distinct()
        .all()
    }
    out: list[date] = []
    for friday in evaluation_fridays_between(start, end):
        if friday not in scored:
            continue
        if universe_scope != "all":
            row = (
                db.query(UniverseMembership.universe_scope)
                .filter(UniverseMembership.as_of == friday)
                .first()
            )
            if row is None or row[0] != universe_scope:
                continue
        out.append(friday)
    return out


def universe_scope_by_date(db: Session, dates: list[date]) -> dict[date, str]:
    if not dates:
        return {}
    rows = (
        db.query(UniverseMembership.as_of, UniverseMembership.universe_scope)
        .filter(UniverseMembership.as_of.in_(dates))
        .distinct()
        .all()
    )
    return {as_of: scope for as_of, scope in rows}


def spy_closes(db: Session, start: date, end: date) -> dict[date, float]:
    rows = (
        db.query(PriceBar.date, PriceBar.close)
        .filter(PriceBar.ticker == "SPY", PriceBar.date >= start, PriceBar.date <= end)
        .all()
    )
    return {d: float(c) for d, c in rows if c}


def verify_dataset(cfg: BacktestConfig) -> str:
    if not cfg.dataset.exists():
        raise FileNotFoundError(
            f"dataset not found: {cfg.dataset}. "
            "Download dataset-v1.sqlite from Railway bucket outpick-backtest "
            "(python -m worker.backtest download --dataset <path>)."
        )
    digest = sha256_file(cfg.dataset)
    if digest != cfg.dataset_sha256:
        raise ValueError(
            f"dataset hash mismatch: {digest} != {cfg.dataset_sha256} "
            f"(file {cfg.dataset})"
        )
    return digest


def _diagnostics(db: Session, result: ReplayResult, params: StrategyParams) -> dict:
    dates = [ev.as_of for ev in result.evaluations]
    scores = {d: load_scores_as_of(db, d) for d in dates}
    scopes = universe_scope_by_date(db, dates)
    return decision_diagnostics(
        result,
        params=params,
        scores_by_date=scores,
        universe_scope_by_date=scopes,
    )


def _metrics(result: ReplayResult, spy: dict[date, float]) -> dict:
    metrics = risk_return_metrics(
        n_evaluations=len(result.evaluations),
        equity_curve=result.equity_curve,
        trades=result.trades,
        spy_closes=spy or None,
    )
    assert_no_return_metrics(metrics)
    return metrics


def _fill_model(price: str, slippage_bps: float) -> FillModel:
    return FillModel(price=price, slippage_bps=slippage_bps)  # type: ignore[arg-type]


def run_backtest(
    db: Session,
    cfg: BacktestConfig,
    *,
    sensitivity: bool = True,
    skip_hash: bool = False,
    ledger_db: Session | None = None,
    ledger_portfolio_id: int | None = None,
    params_overrides: dict | None = None,
) -> dict:
    digest = cfg.dataset_sha256 if skip_hash else verify_dataset(cfg)
    params = params_from_config(cfg, params_overrides)
    eval_dates = scored_eval_dates(db, cfg.start, cfg.end, cfg.universe_scope)
    fill = _fill_model(cfg.fill_price, cfg.slippage_bps)
    result = replay(
        db,
        params,
        cfg.start,
        cfg.end,
        fill=fill,
        initial_cash=cfg.initial_cash,
        eval_dates=eval_dates,
    )
    spy = spy_closes(db, cfg.start, cfg.end)
    diagnostics = _diagnostics(db, result, params)
    metrics = _metrics(result, spy)

    payload: dict = {
        "config": {
            "path": str(cfg.source),
            "dataset": cfg.dataset.name,
            "start": cfg.start.isoformat(),
            "end": cfg.end.isoformat(),
            "position_size_usd": cfg.position_size_usd,
            "initial_cash": cfg.initial_cash,
            "max_adds_per_evaluation": 1,
            "universe_scope": cfg.universe_scope,
            "params_version_label": cfg.params_version_label,
        },
        "params_version": result.params_version,
        "dataset_sha256": digest,
        "fill": {"price": cfg.fill_price, "slippage_bps": cfg.slippage_bps},
        "start": cfg.start.isoformat(),
        "end": cfg.end.isoformat(),
        "diagnostics": diagnostics,
        "metrics": metrics,
        "holdout": holdout_split(
            diagnostics,
            equity_curve=result.equity_curve,
            trades=result.trades,
            spy_closes=spy or None,
        ),
        "gates": promotion_gates(diagnostics["n_evaluations"]),
        "min_evaluations_for_returns": MIN_EVALUATIONS_FOR_RETURNS,
        "min_evaluations_for_holdout": MIN_EVALUATIONS_FOR_HOLDOUT,
        "trades": [t.to_dict() for t in result.trades],
        "equity_curve": result.equity_curve,
        "final": result.final.snapshot(),
        "warnings": result.warnings,
        "recommendation": (
            "Remove the BUG-P1/P2 marketing figures (+250% / 39% CAGR) rather "
            "than replacing them. Publish nothing performance-shaped until "
            f"n_evaluations >= {MIN_EVALUATIONS_FOR_RETURNS}."
        ),
    }

    if sensitivity:
        sens_fill = _fill_model(cfg.sensitivity_fill_price, cfg.sensitivity_slippage_bps)
        sens = replay(
            db,
            params,
            cfg.start,
            cfg.end,
            fill=sens_fill,
            initial_cash=cfg.initial_cash,
            eval_dates=eval_dates,
        )
        payload["sensitivity"] = {
            "fill": {
                "price": cfg.sensitivity_fill_price,
                "slippage_bps": cfg.sensitivity_slippage_bps,
            },
            "diagnostics": _diagnostics(db, sens, params),
            "metrics": _metrics(sens, spy),
            "trades": [t.to_dict() for t in sens.trades],
            "warnings": sens.warnings,
            "trade_diff": _trade_keys(result.trades) != _trade_keys(sens.trades),
            "top_pick_fridays_differ": _top_picks(diagnostics) != _top_picks(
                _diagnostics(db, sens, params)
            ),
        }

    if ledger_db is not None and ledger_portfolio_id is not None:
        payload["ledger_parity"] = result.diff_against_ledger(
            ledger_db, ledger_portfolio_id
        )
    else:
        payload["ledger_parity"] = {
            "skipped": True,
            "reason": "no live ledger database",
        }

    payload["compare"] = compare_payload(payload)
    return payload


def write_result(payload: dict, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(_json(payload) + "\n")


def result_fingerprint(payload: dict) -> str:
    blob = _json(compare_payload(payload)).encode()
    return hashlib.sha256(blob).hexdigest()[:12]


def _trade_keys(trades) -> list[tuple]:
    return [(t.eval_date, t.ticker, t.side, t.action) for t in trades]


def _top_picks(diagnostics: dict) -> list[tuple]:
    return [(f["as_of"], f.get("top_pick")) for f in diagnostics.get("fridays") or []]


def _json(payload: dict) -> str:
    import json

    return json.dumps(payload, default=str, indent=2, sort_keys=True)
