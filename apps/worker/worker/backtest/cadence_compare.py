"""Replay Run 118 on the shipped cadence and on every Friday.

The live scheduler is unchanged. This writes a research report for a window
that is still far below the 24-evaluation return gate.
"""

from __future__ import annotations

import logging
import os
import shutil
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import func
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import CompositeScore, ConsensusSnapshot, PriceBar, UniverseMembership
from app.services.backtest_metrics import research_window_metrics
from app.services.replay import FillModel, ReplayResult, replay
from worker.backtest.config import BacktestConfig, repo_root
from worker.backtest.fridays import biweekly_eval_dates, research_eval_dates
from worker.backtest.manifest import sha256_file
from worker.backtest.membership import write_universe_membership
from worker.backtest.run import params_from_config, spy_closes
from worker.backtest.score import friday_needs_rederive, score_dataset

log = logging.getLogger(__name__)

MIN_BARS_FOR_A_SESSION = 100


def pick_diff(biweekly: dict, weekly: dict) -> dict:
    """Names each cadence bought, and off-cycle weekly buys the other arm took later."""
    bi_dates = set(biweekly.get("evaluation_dates") or [])
    bi_buys = list(biweekly.get("buys") or [])
    wk_buys = list(weekly.get("buys") or [])
    bi_tickers = {row["ticker"] for row in bi_buys}
    wk_tickers = {row["ticker"] for row in wk_buys}
    off_cycle = []
    for buy in wk_buys:
        if buy["date"] in bi_dates:
            continue
        later = [
            row["date"]
            for row in bi_buys
            if row["ticker"] == buy["ticker"] and row["date"] > buy["date"]
        ]
        off_cycle.append(
            {
                "ticker": buy["ticker"],
                "weekly_fill_date": buy["date"],
                "biweekly_bought_later": bool(later),
                "biweekly_later_fill_date": later[0] if later else None,
            }
        )
    return {
        "only_weekly": sorted(wk_tickers - bi_tickers),
        "only_biweekly": sorted(bi_tickers - wk_tickers),
        "both": sorted(wk_tickers & bi_tickers),
        "weekly_off_cycle": off_cycle,
    }


def _arm(name: str, result: ReplayResult, spy: dict[date, float]) -> dict:
    buys = [t for t in result.trades if t.side == "buy"]
    exits = [t for t in result.trades if t.side == "sell"]
    by_action: dict[str, int] = {}
    for trade in result.trades:
        by_action[trade.action] = by_action.get(trade.action, 0) + 1
    return {
        "cadence": name,
        "n_evaluations": len(result.evaluations),
        "evaluation_dates": [ev.as_of.isoformat() for ev in result.evaluations],
        "buy_count": len(buys),
        "exit_count": len(exits),
        "trades_by_action": dict(sorted(by_action.items())),
        "buys": [
            {
                "date": t.fill_date.isoformat(),
                "ticker": t.ticker,
                "notional": round(t.notional, 2),
                "action": t.action,
            }
            for t in buys
        ],
        "exits": [
            {
                "date": t.fill_date.isoformat(),
                "ticker": t.ticker,
                "notional": round(t.notional, 2),
                "action": t.action,
            }
            for t in exits
        ],
        "end_holdings": sorted(result.final.positions.keys()),
        "end_position_count": len(result.final.positions),
        "warnings": list(result.warnings),
        "metrics": research_window_metrics(
            equity_curve=result.equity_curve,
            trades=result.trades,
            spy_closes=spy,
        ),
    }


def compare_cadences(
    db: Session,
    cfg: BacktestConfig,
    start: date,
    end: date,
    *,
    biweekly_dates: list[date],
    weekly_dates: list[date],
) -> tuple[dict, dict]:
    """Replay both date lists with the shipped engine. One add, $1,000, same fill."""
    params = params_from_config(cfg)
    fill = FillModel(price=cfg.fill_price, slippage_bps=cfg.slippage_bps)  # type: ignore[arg-type]
    spy = spy_closes(db, start, end)
    arms = {}
    for name, dates in (("biweekly", biweekly_dates), ("weekly", weekly_dates)):
        result = replay(
            db,
            params,
            start,
            end,
            fill=fill,
            initial_cash=cfg.initial_cash,
            eval_dates=dates,
        )
        arms[name] = _arm(name, result, spy)
    return arms["biweekly"], arms["weekly"]


def _dates_with_scores(db: Session, dates: list[date]) -> tuple[list[date], list[date]]:
    if not dates:
        return [], []
    scored = {
        row[0]
        for row in db.query(CompositeScore.as_of)
        .filter(CompositeScore.as_of.in_(dates))
        .distinct()
        .all()
    }
    kept = [d for d in dates if d in scored]
    missing = [d for d in dates if d not in scored]
    return kept, missing


def prepare_scores(
    db: Session,
    start: date,
    end: date,
    weekly: list[date],
    *,
    allow_degenerate_revisions: bool = False,
) -> dict:
    """Membership and scores for weekly sessions that the pinned tape does not have yet."""
    need_membership = [
        day
        for day in weekly
        if db.query(UniverseMembership.ticker)
        .filter(UniverseMembership.as_of == day)
        .first()
        is None
    ]
    membership_rows = 0
    if need_membership:
        membership_rows = write_universe_membership(
            db, start, end, dates=need_membership
        )
    need_score = [
        day
        for day in weekly
        if db.query(CompositeScore.ticker).filter(CompositeScore.as_of == day).first()
        is None
        or friday_needs_rederive(db, day)
    ]
    scored = {"n_fridays": 0, "fridays": []}
    if need_score:
        log.info("Scoring %s Friday session(s): %s", len(need_score), need_score)
        scored = score_dataset(
            db,
            start,
            end,
            allow_degenerate_revisions=allow_degenerate_revisions,
            dates=need_score,
        )
    return {
        "membership_dates": [d.isoformat() for d in need_membership],
        "membership_rows": membership_rows,
        "scored_dates": [row.get("as_of") for row in scored.get("fridays") or []],
        "n_scored": scored.get("n_fridays"),
    }


def choose_end(
    db: Session, start: date, today: date, configured_end: date
) -> tuple[date, str]:
    """Latest Friday session that has a snapshot on or before it and a real tape of bars."""
    last_snap = db.query(func.max(ConsensusSnapshot.as_of)).scalar()
    if last_snap is None:
        return configured_end, (
            f"no consensus snapshots in the copy; using the pinned end {configured_end.isoformat()}"
        )
    cap = min(today, last_snap)
    usable: list[tuple[date, int]] = []
    for day in research_eval_dates(start, cap):
        n = (
            db.query(func.count(PriceBar.id)).filter(PriceBar.date == day).scalar()
            or 0
        )
        if n >= MIN_BARS_FOR_A_SESSION:
            usable.append((day, int(n)))
    if not usable:
        return configured_end, (
            f"no Friday through {cap.isoformat()} has {MIN_BARS_FOR_A_SESSION} or more "
            f"price bars; using the pinned end {configured_end.isoformat()}"
        )
    end, n_bars = usable[-1]
    if end > configured_end:
        note = (
            f"window extended from the pinned end {configured_end.isoformat()} "
            f"to {end.isoformat()} ({n_bars} price bars that session)"
        )
    elif end < configured_end:
        note = (
            f"price bars run out on {end.isoformat()}, before the pinned end "
            f"{configured_end.isoformat()}"
        )
    else:
        note = (
            f"window ends on the pinned end {configured_end.isoformat()} "
            f"({n_bars} price bars)"
        )
    return end, note


def _postgres_url() -> str | None:
    url = os.environ.get("DATABASE_URL") or ""
    if url.startswith("postgres"):
        return url
    try:
        from app.config import get_settings

        url = get_settings().database_url or ""
    except Exception:
        return None
    if url.startswith("postgres"):
        return url
    return None


def extend_copy(
    db: Session,
    cfg: BacktestConfig,
    today: date,
    *,
    skip_extend: bool,
    skip_ingest: bool,
) -> list[str]:
    """Pull newer snapshots and bars onto the working copy. Failures stay in the notes."""
    notes: list[str] = []
    if skip_extend:
        notes.append("live export skipped")
    else:
        url = _postgres_url()
        if url is None:
            notes.append(
                "DATABASE_URL is not a Postgres URL; no live snapshots were copied"
            )
        else:
            notes.append(_export_live(db, url))

    last_snap = db.query(func.max(ConsensusSnapshot.as_of)).scalar()
    cap = min(today, last_snap) if last_snap is not None else cfg.end
    if skip_ingest:
        notes.append("price ingest skipped")
    else:
        notes.append(_ingest_prices(db, cfg, today, cap))
    notes.append(_ensure_spy(db, cfg, cap))
    return notes


def _export_live(db: Session, url: str) -> str:
    from app.db.session import make_engine
    from worker.backtest.export import export_live_vintages

    engine = make_engine(url)
    src = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        info = export_live_vintages(src, db)
    except Exception as exc:
        log.warning("live snapshot export failed: %s", type(exc).__name__)
        return "live Postgres export failed; using snapshots already in the copy"
    finally:
        src.close()
        engine.dispose()
    return (
        f"exported live vintages "
        f"({info['consensus_snapshots']} snapshot rows attempted, "
        f"{info['fundamentals']} fundamentals rows attempted)"
    )


def _ingest_prices(db: Session, cfg: BacktestConfig, today: date, cap: date) -> str:
    from worker.backtest.ingest import ingest_delta, last_bar_date
    from worker.services.fmp import FMPClient

    from app.config import get_settings

    last = last_bar_date(db)
    if last is not None and last >= cap:
        return f"price bars already reach {last.isoformat()}"
    settings = get_settings()
    if not settings.fmp_api_key:
        reached = last.isoformat() if last else "none"
        return f"no FMP key; price bars stop at {reached}"
    fmp = FMPClient(settings.fmp_api_key, settings.fmp_base_url, settings.fmp_rate_limit)
    try:
        info = ingest_delta(db, fmp, history_start=cfg.start, end=min(today, cap))
    except Exception:
        log.exception("delta price ingest failed")
        return "price ingest failed; using bars already in the copy"
    finally:
        fmp.close()
    if info.get("stopped_on_access_error"):
        return "FMP refused a price request; using bars already in the copy"
    return f"price delta ingest touched {info.get('ingested_delta', 0)} known names"


def _ensure_spy(db: Session, cfg: BacktestConfig, cap: date) -> str:
    from app.config import get_settings
    from worker.services.fmp import FMPClient
    from worker.services.ingest import ingest_ticker_history

    n = db.query(PriceBar.id).filter(PriceBar.ticker == "SPY").count()
    if n:
        return f"SPY bars already in the copy ({n})"
    settings = get_settings()
    if not settings.fmp_api_key:
        return "SPY bars are missing and no FMP key was available"
    fmp = FMPClient(settings.fmp_api_key, settings.fmp_base_url, settings.fmp_rate_limit)
    try:
        ingest_ticker_history(db, fmp, "SPY", cfg.start, cap + timedelta(days=1))
    except Exception:
        log.exception("SPY price ingest failed")
        return "SPY price ingest failed"
    finally:
        fmp.close()
    n = db.query(PriceBar.id).filter(PriceBar.ticker == "SPY").count()
    return f"fetched SPY history ({n} bars)"


def ensure_working_copy(
    pinned: Path, copy: Path, *, refresh: bool, expected_sha256: str
) -> dict:
    """Point the replay at a sqlite copy. Never write the pinned path.

    Prefer a local file that matches the committed pin. If that file is
    missing, download the bucket object into the working copy. A newer
    bucket object is usable for this research run and is not written back
    as the pin.
    """
    copy.parent.mkdir(parents=True, exist_ok=True)
    if copy.exists() and not refresh:
        digest = sha256_file(copy)
        return {
            "reused": True,
            "sha256": digest,
            "matches_committed_pin": digest == expected_sha256,
            "path": str(copy),
        }
    if pinned.exists() and sha256_file(pinned) == expected_sha256:
        shutil.copy2(pinned, copy)
        return {
            "copied_pin": True,
            "sha256": expected_sha256,
            "matches_committed_pin": True,
            "path": str(copy),
        }
    from worker.backtest.download import download_dataset

    download_dataset(copy, key=pinned.name, sha256=None)
    digest = sha256_file(copy)
    return {
        "downloaded": True,
        "sha256": digest,
        "matches_committed_pin": digest == expected_sha256,
        "path": str(copy),
    }


def render_markdown(report: dict) -> str:
    bi = report["biweekly"]
    wk = report["weekly"]
    diff = report["pick_diff"]
    lines = [
        "# Weekly versus biweekly",
        "",
        report["note"],
        "",
        "## Window",
        "",
        f"Start {report['start']}, end {report['end']}.",
        _sentence(report["window_note"]),
    ]
    for note in report.get("extend_notes") or []:
        lines.append(_sentence(note))
    lines.extend(
        [
            "",
            f"Pinned dataset end is {report['pinned_end']}. "
            f"The working copy is `{report['working_copy']}`. "
            "The pinned file and the Run 118 baseline were not rewritten.",
            "",
            f"Both arms add at most one name per evaluation, "
            f"${report['position_size_usd']:.0f} each, "
            f"fill `{report['fill_price']}` at {report['slippage_bps']} bps. "
            f"Starting cash is ${report['initial_cash']:.0f}.",
            "",
            "## Book",
            "",
            "| | Biweekly | Weekly |",
            "| --- | --- | --- |",
            f"| Evaluations | {bi['n_evaluations']} | {wk['n_evaluations']} |",
            f"| Buys | {bi['buy_count']} | {wk['buy_count']} |",
            f"| Exits | {bi['exit_count']} | {wk['exit_count']} |",
            f"| Ending names | {bi['end_position_count']} | {wk['end_position_count']} |",
            _money_row("Ending invested", bi, wk),
            "",
            f"Biweekly dates: {_date_list(bi['evaluation_dates'])}.",
            f"Weekly dates: {_date_list(wk['evaluation_dates'])}.",
        ]
    )
    if report.get("unscored_weekly"):
        lines.append(
            "Weekly sessions with no scores, dropped from the replay: "
            + _date_list(report["unscored_weekly"])
            + "."
        )
    if report.get("unscored_biweekly"):
        lines.append(
            "Biweekly sessions with no scores, dropped from the replay: "
            + _date_list(report["unscored_biweekly"])
            + "."
        )
    lines.extend(["", "## Stock book", ""])
    lines.append(_stock_paragraph("Biweekly", bi))
    lines.append(_stock_paragraph("Weekly", wk))
    lines.extend(
        [
            "",
            "Those annualized figures extrapolate a few weeks of daily moves. "
            "They are not a year of volatility.",
            "",
            "## Same-dollar S&P 500",
            "",
            "Each fill buys or sells SPY with the same notional. "
            "Alpha is the stock book's dollar P&L minus that SPY path, "
            "marked on the last day of the window.",
            "",
            _spy_paragraph("Biweekly", bi),
            _spy_paragraph("Weekly", wk),
            "",
            "## Total equity",
            "",
            "Total-equity volatility counts the cash pile. "
            "It is not the test of a larger stock book.",
            "",
            _equity_paragraph("Biweekly", bi),
            _equity_paragraph("Weekly", wk),
            "",
            "## Picks",
            "",
        ]
    )
    lines.extend(_buy_lines("Biweekly", bi["buys"]))
    lines.extend(_buy_lines("Weekly", wk["buys"]))
    lines.append("")
    lines.append(
        "Only weekly bought: " + _tickers(diff["only_weekly"]) + "."
    )
    lines.append(
        "Only biweekly bought: " + _tickers(diff["only_biweekly"]) + "."
    )
    lines.append("Both bought: " + _tickers(diff["both"]) + ".")
    if diff["weekly_off_cycle"]:
        lines.extend(["", "Off-cycle weekly buys:", ""])
        for row in diff["weekly_off_cycle"]:
            if row["biweekly_bought_later"]:
                later = f"Biweekly bought it later on {row['biweekly_later_fill_date']}."
            else:
                later = "Biweekly did not buy it on a later evaluation Friday."
            lines.append(
                f"- {row['ticker']} on {row['weekly_fill_date']}. {later}"
            )
    else:
        lines.append("")
        lines.append("No weekly buy fell on a Friday the biweekly arm skipped.")
    lines.append("")
    return "\n".join(lines)


def _money_row(label: str, bi: dict, wk: dict) -> str:
    return (
        f"| {label} | {_dollars(_ending_invested(bi))} | {_dollars(_ending_invested(wk))} |"
    )


def _ending_invested(arm: dict) -> float | None:
    return ((arm.get("metrics") or {}).get("total_equity") or {}).get("ending_invested")


def _dollars(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"${value:,.0f}"


def _date_list(dates: list[str]) -> str:
    if not dates:
        return "none"
    return ", ".join(dates)


def _tickers(names: list[str]) -> str:
    if not names:
        return "none"
    return ", ".join(names)


def _stock_paragraph(label: str, arm: dict) -> str:
    book = (arm.get("metrics") or {}).get("stock_book") or {}
    ret = book.get("return_pct")
    daily = book.get("daily_stdev_pct")
    ann = book.get("annualized_vol_pct")
    days = book.get("n_return_days")
    return (
        f"{label}: stock-book return {_pct(ret)} over {days} return days, "
        f"daily standard deviation {_pct(daily)}, "
        f"annualized volatility {_pct(ann)}."
    )


def _spy_paragraph(label: str, arm: dict) -> str:
    spy = (arm.get("metrics") or {}).get("spy") or {}
    if spy.get("status") != "ok":
        missing = ", ".join(spy.get("missing_dates") or []) or "unknown"
        return f"{label}: SPY path unavailable ({spy.get('status')}, missing {missing})."
    return (
        f"{label}: picks {_signed(spy.get('picks_pnl'))}, "
        f"SPY {_signed(spy.get('spy_pnl'))}, "
        f"alpha {_signed(spy.get('alpha_pnl'))}."
    )


def _equity_paragraph(label: str, arm: dict) -> str:
    eq = (arm.get("metrics") or {}).get("total_equity") or {}
    return (
        f"{label}: total equity return {_pct(eq.get('return_pct'))}, "
        f"annualized volatility {_pct(eq.get('annualized_vol_pct'))}, "
        f"ending equity {_dollars(eq.get('ending_equity'))}."
    )


def _buy_lines(label: str, buys: list[dict]) -> list[str]:
    if not buys:
        return [f"{label} bought nothing."]
    lines = [f"{label} buys:"]
    for buy in buys:
        lines.append(
            f"- {buy['date']} {buy['ticker']} ${buy['notional']:,.0f} ({buy['action']})"
        )
    return lines


def _sentence(text: str) -> str:
    text = text.strip()
    if text and text[0].islower():
        text = text[0].upper() + text[1:]
    if text and text[-1] not in ".!?":
        text += "."
    return text


def _pct(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"{value:.2f}%"


def _signed(value: float | None) -> str:
    if value is None:
        return "n/a"
    return f"${value:,.2f}"


def build_report(
    *,
    cfg: BacktestConfig,
    working_copy: Path,
    start: date,
    end: date,
    window_note: str,
    extend_notes: list[str],
    prepare: dict,
    biweekly: dict,
    weekly: dict,
    unscored_biweekly: list[date],
    unscored_weekly: list[date],
) -> dict:
    report = {
        "status": "research_short_window",
        "note": (
            "This is a description of the stored tape, not a promotion result. "
            "Production reports still withhold CAGR, Sharpe, and alpha until 24 evaluations. "
            "Weekly here means every Friday, still one add. "
            "It also runs trims and removals on the extra dates, so exits can differ."
        ),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "pinned_end": cfg.end.isoformat(),
        "window_note": window_note,
        "extend_notes": extend_notes,
        "working_copy": str(working_copy),
        "pinned_dataset_sha256": cfg.dataset_sha256,
        "position_size_usd": cfg.position_size_usd,
        "initial_cash": cfg.initial_cash,
        "max_adds_per_evaluation": 1,
        "fill_price": cfg.fill_price,
        "slippage_bps": cfg.slippage_bps,
        "prepare": prepare,
        "unscored_biweekly": [d.isoformat() for d in unscored_biweekly],
        "unscored_weekly": [d.isoformat() for d in unscored_weekly],
        "biweekly": biweekly,
        "weekly": weekly,
        "pick_diff": pick_diff(biweekly, weekly),
    }
    return report


def run_cadence_compare(
    cfg: BacktestConfig,
    *,
    copy_path: Path | None = None,
    today: date | None = None,
    refresh_copy: bool = False,
    skip_extend: bool = False,
    skip_ingest: bool = False,
    allow_degenerate_revisions: bool = False,
) -> dict:
    """Copy the pinned dataset, score missing Fridays, replay both cadences."""
    root = repo_root(cfg.source)
    pinned = cfg.dataset
    copy = copy_path or (root / "datasets" / "dataset-cadence.sqlite")
    today = today or date.today()
    dataset = ensure_working_copy(
        pinned, copy, refresh=refresh_copy, expected_sha256=cfg.dataset_sha256
    )

    from worker.backtest.store import open_dataset

    db = open_dataset(copy)
    try:
        notes = extend_copy(
            db, cfg, today, skip_extend=skip_extend, skip_ingest=skip_ingest
        )
        end, window_note = choose_end(db, cfg.start, today, cfg.end)
        start = cfg.start
        weekly_all = research_eval_dates(start, end)
        biweekly_all = biweekly_eval_dates(start, end)
        prepare = prepare_scores(
            db,
            start,
            end,
            weekly_all,
            allow_degenerate_revisions=allow_degenerate_revisions,
        )
        biweekly_dates, unscored_bi = _dates_with_scores(db, biweekly_all)
        weekly_dates, unscored_wk = _dates_with_scores(db, weekly_all)
        biweekly, weekly = compare_cadences(
            db,
            cfg,
            start,
            end,
            biweekly_dates=biweekly_dates,
            weekly_dates=weekly_dates,
        )
        report = build_report(
            cfg=cfg,
            working_copy=copy,
            start=start,
            end=end,
            window_note=window_note,
            extend_notes=notes,
            prepare=prepare,
            biweekly=biweekly,
            weekly=weekly,
            unscored_biweekly=unscored_bi,
            unscored_weekly=unscored_wk,
        )
        report["dataset_sha256"] = dataset["sha256"]
        report["matches_committed_pin"] = dataset["matches_committed_pin"]
        if not dataset["matches_committed_pin"]:
            report["extend_notes"].insert(
                0,
                "Working copy does not match the committed pin "
                f"{cfg.dataset_sha256[:12]}. "
                "It started from the current bucket object, then this run "
                "added off-cycle scores and SPY bars locally. "
                "backtests/run118.toml was not rewritten",
            )
        return report
    finally:
        db.close()


def write_report(report: dict, out_dir: Path) -> tuple[Path, Path]:
    import json

    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "weekly-vs-biweekly.json"
    md_path = out_dir / "weekly-vs-biweekly.md"
    json_path.write_text(json.dumps(report, indent=2, default=str) + "\n")
    md_path.write_text(render_markdown(report))
    return json_path, md_path
