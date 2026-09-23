"""Cross-sectional factor tape: does each factor rank next weeks' returns?

The book adds one name a fortnight, so its P&L needs ~24 evaluations before it
says anything. This asks a smaller question hundreds of times per Friday: across
every scored name, does a higher factor percentile come with a higher forward
return? The answer per Friday is a Spearman rank correlation (the information
coefficient, IC). Averaged over Fridays, with a t-stat, it judges a scoring
switch long before the book can.

    python -m worker.backtest.factor_ic --dataset datasets/dataset-cadence.sqlite \\
        --standard --out-md backtests/experiments/factor-ic.md

Scores are recomputed in memory with `compute_scores` for each variant; nothing
is written unless `--rederive` is passed, which refreshes the derived PIT rows
(and therefore mutates the dataset — point it at a working copy).

Horizons are trading days. With weekly Fridays, horizons longer than 5 days
overlap, so consecutive ICs are not independent and the t-stat overstates
confidence. The report says so next to every number.
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from statistics import mean, stdev

from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS, ScoreSnapshot, StrategyParams
from outpick_strategy.signals import meets_buy_criteria

from app.db.models import PriceBar, UniverseMembership
from worker.backtest.store import open_dataset
from worker.services.scoring import ScoredTicker, compute_scores

log = logging.getLogger(__name__)

DEFAULT_HORIZONS = (5, 10, 20)

# Each research switch alone, plus the pairing the changelog queued first.
STANDARD_VARIANTS: dict[str, dict] = {
    "run118": {},
    "momentum_penalty_0": {"momentum_penalty": 0.0},
    "momentum_12_1": {"momentum_skip_days": 21},
    "momentum_12_1_penalty_0": {"momentum_skip_days": 21, "momentum_penalty": 0.0},
    "momentum_blend_6m": {"momentum_blend_6m": True},
    "revisions_price": {"revisions_eps_scaling": "price"},
    "revisions_min_14d": {"revision_min_lookback_days": 14},
    "revisions_fy2": {"revisions_fy2_blend": True},
    "valuation_penalize_losses": {"valuation_penalize_losses": True},
    "growth_drop_net_income": {"growth_drop_net_income": True},
    "surprise_0_10": {"weight_surprise": 0.10},
}

FACTORS = ("valuation", "growth", "profitability", "momentum", "revisions", "surprise")


# ── statistics ──────────────────────────────────────────────────────────────


def _ranks(values: list[float]) -> list[float]:
    """Average ranks (ties share the mean of their positions)."""
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        avg = (i + j) / 2.0
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 3:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if vx <= 0 or vy <= 0:
        return None
    return cov / math.sqrt(vx * vy)


def spearman(xs: list[float], ys: list[float]) -> float | None:
    """Rank correlation; None under 3 pairs or with no variation."""
    return _pearson(_ranks(xs), _ranks(ys))


@dataclass
class Summary:
    n: int
    mean: float | None
    t: float | None
    hit: float | None

    def to_dict(self) -> dict:
        return {"n": self.n, "mean": self.mean, "t": self.t, "hit": self.hit}


def summarize(values: list[float]) -> Summary:
    vals = [v for v in values if v is not None]
    if not vals:
        return Summary(0, None, None, None)
    m = mean(vals)
    t = None
    if len(vals) >= 2:
        sd = stdev(vals)
        t = m / (sd / math.sqrt(len(vals))) if sd > 0 else None
    return Summary(len(vals), m, t, sum(1 for v in vals if v > 0) / len(vals))


# ── prices ──────────────────────────────────────────────────────────────────


class ForwardReturns:
    """Close-to-close forward returns over trading-day horizons."""

    def __init__(self, db: Session, start: date, end: date | None = None):
        q = db.query(PriceBar.ticker, PriceBar.date, PriceBar.close).filter(
            PriceBar.date >= start
        )
        if end is not None:
            q = q.filter(PriceBar.date <= end)
        self.series: dict[str, tuple[list[date], list[float]]] = {}
        raw: dict[str, list[tuple[date, float]]] = {}
        for ticker, day, close in q.all():
            if close and close > 0:
                raw.setdefault(ticker, []).append((day, close))
        for ticker, bars in raw.items():
            bars.sort()
            self.series[ticker] = ([d for d, _ in bars], [c for _, c in bars])
        # The session calendar is every date any name printed. Not the
        # benchmark's: a dataset can carry only the last few weeks of SPY
        # (the cadence copy has 30 bars), which silently truncated the tape
        # to those weeks.
        self.sessions = sorted({d for dates, _ in self.series.values() for d in dates})

    def session_after(self, day: date, n: int) -> date | None:
        """The session `n` trading days after the last session on/before `day`."""
        i = bisect_right(self.sessions, day) - 1
        if i < 0 or i + n >= len(self.sessions):
            return None
        return self.sessions[i + n]

    def close_on_or_before(self, ticker: str, day: date) -> float | None:
        s = self.series.get(ticker)
        if not s:
            return None
        i = bisect_right(s[0], day) - 1
        return s[1][i] if i >= 0 else None

    def forward(self, ticker: str, day: date, horizon: int) -> float | None:
        end = self.session_after(day, horizon)
        if end is None:
            return None
        a = self.close_on_or_before(ticker, day)
        b = self.close_on_or_before(ticker, end)
        if not a or not b:
            return None
        return b / a - 1.0


# ── one Friday ──────────────────────────────────────────────────────────────


def _snapshot(s: ScoredTicker) -> ScoreSnapshot:
    return ScoreSnapshot(
        ticker=s.ticker,
        quant_rating=s.quant_rating,
        valuation_grade=s.grades.get("valuation", "F"),
        growth_grade=s.grades.get("growth", "F"),
        profitability_grade=s.grades.get("profitability", "F"),
        momentum_grade=s.grades.get("momentum", "F"),
        revisions_grade=s.grades.get("revisions", "F"),
        sector=s.sector,
    )


@dataclass
class FridayResult:
    as_of: date
    n_scored: int
    # horizon -> metric -> value
    by_horizon: dict[int, dict[str, float | None]] = field(default_factory=dict)
    # factor -> correlation with the composite (same Friday)
    composite_corr: dict[str, float | None] = field(default_factory=dict)
    top_pick: str | None = None
    n_gate_pass: int = 0


def evaluate_friday(
    scored: list[ScoredTicker],
    params: StrategyParams,
    fwd: ForwardReturns,
    as_of: date,
    horizons: tuple[int, ...],
) -> FridayResult:
    result = FridayResult(as_of=as_of, n_scored=len(scored))
    gate = [s for s in scored if meets_buy_criteria(_snapshot(s), params)[0]]
    result.n_gate_pass = len(gate)
    ranked_gate = sorted(gate, key=lambda s: s.quant_rating, reverse=True)
    result.top_pick = ranked_gate[0].ticker if ranked_gate else None

    for f in FACTORS:
        pairs = [
            (s.factor_pcts.get(f), s.composite)
            for s in scored
            if s.factor_pcts.get(f) is not None
        ]
        result.composite_corr[f] = (
            _pearson([p[0] for p in pairs], [p[1] for p in pairs]) if pairs else None
        )

    for h in horizons:
        rets = {s.ticker: fwd.forward(s.ticker, as_of, h) for s in scored}
        live = [s for s in scored if rets[s.ticker] is not None]
        metrics: dict[str, float | None] = {"n": float(len(live))}
        if len(live) < 20:
            result.by_horizon[h] = metrics
            continue
        r = [rets[s.ticker] for s in live]
        universe_mean = mean(r)
        metrics["ic_composite"] = spearman([s.composite for s in live], r)
        for f in FACTORS:
            pairs = [
                (s.factor_pcts.get(f), rets[s.ticker])
                for s in live
                if s.factor_pcts.get(f) is not None
            ]
            metrics[f"ic_{f}"] = (
                spearman([p[0] for p in pairs], [p[1] for p in pairs])
                if len(pairs) >= 20
                else None
            )
        by_comp = sorted(live, key=lambda s: s.composite)
        q = max(1, len(by_comp) // 5)
        metrics["q5_minus_q1"] = mean(rets[s.ticker] for s in by_comp[-q:]) - mean(
            rets[s.ticker] for s in by_comp[:q]
        )
        gate_rets = [rets[s.ticker] for s in gate if rets.get(s.ticker) is not None]
        metrics["gate_excess"] = (mean(gate_rets) - universe_mean) if gate_rets else None
        top = rets.get(result.top_pick) if result.top_pick else None
        metrics["top_pick_excess"] = (top - universe_mean) if top is not None else None
        result.by_horizon[h] = metrics
    return result


# ── driver ──────────────────────────────────────────────────────────────────


def dataset_fridays(db: Session, start: date | None, end: date | None) -> list[date]:
    q = db.query(UniverseMembership.as_of).distinct()
    if start:
        q = q.filter(UniverseMembership.as_of >= start)
    if end:
        q = q.filter(UniverseMembership.as_of <= end)
    return sorted(d for (d,) in q.all() if d.weekday() == 4)


def members_on(db: Session, friday: date) -> list[str]:
    return [
        t
        for (t,) in db.query(UniverseMembership.ticker)
        .filter(UniverseMembership.as_of == friday)
        .all()
    ]


def run_variants(
    db: Session,
    variants: dict[str, dict],
    fridays: list[date],
    horizons: tuple[int, ...] = DEFAULT_HORIZONS,
    base: StrategyParams = RUN118_PARAMS,
) -> dict:
    if not fridays:
        return {"fridays": [], "horizons": list(horizons), "variants": {}}
    fwd = ForwardReturns(db, min(fridays))
    members = {f: members_on(db, f) for f in fridays}
    out: dict = {
        "fridays": [f.isoformat() for f in fridays],
        "horizons": list(horizons),
        "last_session": fwd.sessions[-1].isoformat() if fwd.sessions else None,
        "variants": {},
    }
    for name, overrides in variants.items():
        params = base.with_overrides(**overrides)
        per_friday: list[FridayResult] = []
        for friday in fridays:
            scored, _missing, _considered = compute_scores(
                db, params, friday, universe=members[friday]
            )
            per_friday.append(evaluate_friday(scored, params, fwd, friday, horizons))
        out["variants"][name] = _aggregate(name, overrides, params, per_friday, horizons)
        log.info("factor_ic: %s done (%d Fridays)", name, len(per_friday))
    return out


def _aggregate(name, overrides, params, per_friday, horizons) -> dict:
    agg: dict = {
        "overrides": overrides,
        "params_version": params.version_hash(),
        "fridays": [
            {
                "as_of": r.as_of.isoformat(),
                "n_scored": r.n_scored,
                "n_gate_pass": r.n_gate_pass,
                "top_pick": r.top_pick,
                "by_horizon": {str(h): r.by_horizon.get(h, {}) for h in horizons},
            }
            for r in per_friday
        ],
        "composite_corr": {
            f: summarize([r.composite_corr.get(f) for r in per_friday]).mean
            for f in FACTORS
        },
        "horizons": {},
    }
    for h in horizons:
        rows = [r.by_horizon.get(h, {}) for r in per_friday]
        metrics = ["ic_composite", *[f"ic_{f}" for f in FACTORS], "q5_minus_q1",
                   "gate_excess", "top_pick_excess"]
        agg["horizons"][str(h)] = {
            m: summarize([row.get(m) for row in rows]).to_dict() for m in metrics
        }
    return agg


# ── report ──────────────────────────────────────────────────────────────────


def _pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:+.2f}%"


def _num(x: float | None, digits: int = 3) -> str:
    return "—" if x is None else f"{x:+.{digits}f}"


def render_markdown(result: dict) -> str:
    fridays = result["fridays"]
    lines = [
        "# Factor IC tape",
        "",
        f"Fridays: {len(fridays)} ({fridays[0] if fridays else '—'} → "
        f"{fridays[-1] if fridays else '—'}). Last price session: "
        f"{result.get('last_session') or '—'}.",
        "",
        "IC is the Spearman correlation between a score and the forward return "
        "across every scored name on a Friday, averaged over Fridays. `t` is "
        "mean / (sd / √n). Horizons past 5 sessions overlap week to week, so "
        "their t overstates confidence. Under ~24 Fridays, read direction, not "
        "size.",
        "",
    ]
    if result.get("base_overrides"):
        lines += [f"Every variant runs on top of `{result['base_overrides']}`.", ""]
    variants = result["variants"]
    for h in result["horizons"]:
        lines += [
            f"## {h}-session forward returns",
            "",
            "| Variant | IC | t | IC>0 | Q5−Q1 | Gate-pass excess | Top-pick excess | n |",
            "|---|---|---|---|---|---|---|---|",
        ]
        for name, v in variants.items():
            m = v["horizons"][str(h)]
            ic = m["ic_composite"]
            hit = "—" if ic["hit"] is None else f"{ic['hit']:.0%}"
            lines.append(
                f"| {name} | {_num(ic['mean'])} | {_num(ic['t'], 2)} | {hit} | "
                f"{_pct(m['q5_minus_q1']['mean'])} | {_pct(m['gate_excess']['mean'])} | "
                f"{_pct(m['top_pick_excess']['mean'])} | {ic['n']} |"
            )
        lines.append("")

    base = variants.get("run118")
    if base:
        lines += [
            "## Run 118 factor by factor",
            "",
            "| Factor | Weight | Corr with composite | "
            + " | ".join(f"IC {h}d (t)" for h in result["horizons"])
            + " |",
            "|---|---|---|" + "---|" * len(result["horizons"]),
        ]
        weights = RUN118_PARAMS.factor_weights()
        for f in FACTORS:
            if f not in weights:
                continue
            cells = []
            for h in result["horizons"]:
                s = base["horizons"][str(h)][f"ic_{f}"]
                cells.append(f"{_num(s['mean'])} ({_num(s['t'], 2)})")
            lines.append(
                f"| {f} | {weights[f]:.2f} | {_num(base['composite_corr'].get(f), 2)} | "
                + " | ".join(cells)
                + " |"
            )
        lines.append("")

    lines += ["## Top pick by Friday", "", "| Friday | " + " | ".join(variants) + " |",
              "|---|" + "---|" * len(variants)]
    for i, friday in enumerate(fridays):
        picks = [v["fridays"][i]["top_pick"] or "—" for v in variants.values()]
        if any(p != "—" for p in picks):
            lines.append(f"| {friday} | " + " | ".join(picks) + " |")
    lines.append("")
    return "\n".join(lines)


def _parse_variant(raw: str) -> tuple[str, dict]:
    """`name:key=value,key=value` with JSON-ish values."""
    name, _, body = raw.partition(":")
    overrides: dict = {}
    for part in filter(None, body.split(",")):
        key, _, value = part.partition("=")
        try:
            overrides[key.strip()] = json.loads(value)
        except json.JSONDecodeError:
            overrides[key.strip()] = value.strip()
    return name.strip(), overrides


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m worker.backtest.factor_ic")
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--from", dest="from_", default=None)
    ap.add_argument("--to", dest="to", default=None)
    ap.add_argument("--horizons", default=",".join(map(str, DEFAULT_HORIZONS)))
    ap.add_argument("--standard", action="store_true", help="Run every research switch")
    ap.add_argument("--variant", action="append", default=[], help="name:key=value,...")
    ap.add_argument(
        "--base",
        default="",
        help="key=value,... applied under every variant (e.g. weight_revisions=0 "
        "to measure the other factors before the consensus tape starts)",
    )
    ap.add_argument(
        "--rederive",
        action="store_true",
        help="Re-derive PIT rows first (writes to the dataset; use a copy)",
    )
    ap.add_argument("--out-json", default=None)
    ap.add_argument("--out-md", default=None)
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    db = open_dataset(args.dataset)
    start = date.fromisoformat(args.from_) if args.from_ else None
    end = date.fromisoformat(args.to) if args.to else None
    fridays = dataset_fridays(db, start, end)

    if args.rederive:
        # derive_universe, not score_dataset: history before the consensus tape
        # has no revisions, which score_dataset's degenerate-tape guard rejects
        # and which this report handles with `--base weight_revisions=0`.
        from worker.services.backtest_derive import derive_universe

        for friday in fridays:
            members = (
                db.query(UniverseMembership)
                .filter(UniverseMembership.as_of == friday)
                .all()
            )
            scope = members[0].universe_scope if members else None
            n = derive_universe(db, friday, [m.ticker for m in members], universe_scope=scope)
            log.info("factor_ic: derived %s (%d names)", friday.isoformat(), n)

    variants: dict[str, dict] = {"run118": {}}
    if args.standard:
        variants.update(STANDARD_VARIANTS)
    for raw in args.variant:
        name, overrides = _parse_variant(raw)
        variants[name] = overrides

    horizons = tuple(int(h) for h in args.horizons.split(","))
    _, base_overrides = _parse_variant(f"base:{args.base}")
    base = RUN118_PARAMS.with_overrides(**base_overrides)
    result = run_variants(db, variants, fridays, horizons, base=base)
    result["base_overrides"] = base_overrides
    md = render_markdown(result)
    if args.out_json:
        Path(args.out_json).write_text(json.dumps(result, indent=2, default=str))
    if args.out_md:
        Path(args.out_md).write_text(md)
    print(md)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
