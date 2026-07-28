"""Ingest universe + fundamentals + marks via FMP."""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from outpick_strategy import RUN118_PARAMS

from app.db.models import Fundamentals, Portfolio, PortfolioSnapshot, Position, PriceBar, Stock
from app.services.portfolio import ensure_default_portfolio
from worker.services.fmp import FMPAccessError, FMPClient
from worker.services.market_calendar import last_trading_day_on_or_before

log = logging.getLogger(__name__)

# How far back to look for the consensus estimate we compare against. Weekly
# fundamentals refreshes mean roughly one snapshot per 7 days, so ~3 weeks
# approximates the conventional 1-month revision window.
REVISION_LOOKBACK_DAYS = 21

# Shortest window that can carry a real revision signal. Consensus estimates
# barely move day to day, so comparing snapshots a day apart returns 0.0% for
# most of the universe — not "no change worth noting" but a tie block that
# percentile ranking then has to resolve. Below this we report NO revision,
# which under the factor-coverage floor leaves the ticker unscored rather than
# scored on a fabricated factor. A weekly refresh clears it comfortably.
MIN_REVISION_LOOKBACK_DAYS = 5


def first_present(row: dict, *keys):
    """First key in `keys` carrying a non-None value, else None.

    `row.get(a, row.get(b))` is NOT this: the default is only consulted when `a`
    is ABSENT, so a payload that sends `a` explicitly as null returns None and
    never looks at `b`. FMP does send explicit nulls for fields it has no value
    for, so every such row was discarded even though a usable value sat beside
    it — a hole in the price history at the 12-month anchor makes `_momentum_12m`
    return None, which under `min_factor_coverage = 1.0` makes the whole ticker
    unscoreable, hence neither buyable NOR sellable.
    """
    for key in keys:
        value = row.get(key)
        if value is not None:
            return value
    return None


#: Field priority for a daily close, shared by BOTH writers of `price_bars`
#: (`backfill_price_history` here and `backfill._parse_series`). They used to
#: disagree — ingest read adjClose first, _parse_series read close first — and
#: `upsert_price_bar` overwrites on conflict, so for a ticker that split, the
#: series jumped by the split ratio at whatever date boundary the two jobs
#: happened to divide, which `_momentum_12m` reads as a fabricated -67%/+200%
#: annual return on a stock whose price never moved.
#:
#: adjClose wins where FMP supplies it. It is expressed in TODAY's share terms,
#: which is the only basis consistent with the two things it is compared
#: against: the live unadjusted quote `refresh_marks` writes for today, and the
#: CURRENT `Position.shares` count `backfill` multiplies it by. An unadjusted
#: pre-split close is neither. Where FMP omits adjClose (or sends it null) this
#: degrades to `close`, which is exactly the previous behaviour — so this is
#: safe whether or not `/stable/historical-price-eod/full` carries the field.
CLOSE_FIELDS = ("adjClose", "close")


def upsert_price_bar(db: Session, ticker: str, bar_date: date, close: float) -> PriceBar:
    """Insert-or-update one daily bar.

    `db.merge(PriceBar(...))` does NOT work here: with no primary key set, merge
    treats the object as pending and emits an INSERT, which the
    UniqueConstraint("ticker", "date") then rejects. That crashed any second
    marks run in the same day — which is exactly what happens on evaluation
    Fridays, when the biweekly job marks at 11:00 and the daily job marks again
    at 18:30.
    """
    existing = (
        db.query(PriceBar)
        .filter(PriceBar.ticker == ticker, PriceBar.date == bar_date)
        .one_or_none()
    )
    if existing:
        existing.close = close
        return existing
    bar = PriceBar(ticker=ticker, date=bar_date, close=close)
    db.add(bar)
    db.flush()
    return bar


def bulk_insert_price_bars(db: Session, rows: list[dict], chunk_size: int = 2000) -> int:
    """Insert many bars, skipping any that already exist. Returns rows attempted.

    `upsert_price_bar` is correct for the update-in-place case but does a
    SELECT + INSERT + flush per bar — unusable for a history backfill of ~160k
    rows. Reading the existing keys first and inserting the difference would be
    check-then-act: `refresh_marks` writes bars for the same tickers on its own
    schedule, and on Postgres one unique violation aborts the whole statement
    AND transaction, losing every other row in the batch.

    ON CONFLICT DO NOTHING pushes the race to the database, which makes this
    both concurrency-safe and idempotent — a killed run resumes by simply being
    re-run. Both Postgres and SQLite support it (SQLite since 3.24).

    DO NOTHING rather than DO UPDATE is deliberate: `refresh_marks` stores a
    live quote for today, and this must never overwrite it with an EOD bar.
    """
    if not rows:
        return 0

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _insert
    elif dialect == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as _insert
    else:  # pragma: no cover - only these two are ever deployed
        for row in rows:
            upsert_price_bar(db, row["ticker"], row["date"], row["close"])
        db.commit()
        return len(rows)

    written = 0
    for start in range(0, len(rows), chunk_size):
        chunk = rows[start : start + chunk_size]
        stmt = _insert(PriceBar.__table__).values(chunk)
        db.execute(stmt.on_conflict_do_nothing(index_elements=["ticker", "date"]))
        # Commit per chunk so a killed job leaves durable progress rather than
        # rolling back the entire backfill.
        db.commit()
        written += len(chunk)
    return written


def refresh_universe(db: Session, fmp: FMPClient, limit: int = 800) -> int:
    params = RUN118_PARAMS
    rows = fmp.stock_screener(min_market_cap=params.min_universe_market_cap, limit=limit)
    count = 0
    for row in rows:
        ticker = (row.get("symbol") or "").upper()
        if not ticker or "." in ticker:
            continue
        # An unverifiable price is not an acceptable one. This was
        # `price = row.get("price") or 0` followed by
        # `if price and price < min_share_price` — a missing or zero price
        # (halted names, thinly-traded shells) is falsy, so the $5 floor was
        # skipped entirely and the ticker was admitted. `refresh_universe` is
        # the ONLY code path in the repo that reads `min_share_price` and
        # nothing ever re-applies it to an existing Stock row, so that
        # admission was permanent: the name then collected fundamentals, got
        # scored, and was buyable at $0.80.
        raw_price = row.get("price")
        try:
            price = float(raw_price) if raw_price is not None else None
        except (TypeError, ValueError):
            price = None
        if price is None or price < params.min_share_price:
            continue
        stock = db.get(Stock, ticker)
        if not stock:
            stock = Stock(ticker=ticker)
            db.add(stock)
        stock.name = row.get("companyName") or stock.name
        stock.sector = row.get("sector") or stock.sector
        stock.industry = row.get("industry") or stock.industry
        stock.market_cap = row.get("marketCap") or stock.market_cap
        stock.is_etf = False
        stock.is_active = True
        stock.last_price = price or stock.last_price
        stock.updated_at = datetime.now(timezone.utc)
        count += 1
    db.commit()
    log.info("Universe refresh: %s tickers", count)
    return count


def _forward_estimate(estimates: list[dict], as_of: date) -> dict | None:
    """The consensus row for the nearest fiscal period ending on/after `as_of`.

    FMP returns one row per fiscal year, past and future, unordered in practice.
    Revisions must always be measured against the *same* fiscal period, so we
    pin the period explicitly rather than trusting list position.
    """
    rows: list[tuple[date, dict]] = []
    for e in estimates or []:
        raw = e.get("date")
        if not raw:
            continue
        try:
            period = date.fromisoformat(str(raw)[:10])
        except ValueError:
            continue
        rows.append((period, e))
    if not rows:
        return None
    upcoming = sorted([r for r in rows if r[0] >= as_of], key=lambda r: r[0])
    period, row = upcoming[0] if upcoming else max(rows, key=lambda r: r[0])
    return {
        "estimatePeriod": period.isoformat(),
        # `/stable` dropped the `estimated` prefix the legacy API used; accept
        # both so stored snapshots taken under either shape stay comparable.
        # `first_present`, not `row.get(a, row.get(b))`: an explicit
        # `"epsAvg": null` would otherwise shadow a usable `estimatedEpsAvg` in
        # the same row, leaving epsEstimateAvg None — and a null estimate makes
        # compute_estimate_revisions return {}, which nulls the revisions factor
        # (weight 0.30, gates every buy via min_revisions_grade).
        "epsEstimateAvg": first_present(row, "epsAvg", "estimatedEpsAvg"),
        "revenueEstimateAvg": first_present(
            row, "revenueAvg", "estimatedRevenueAvg"
        ),
    }


def _prior_estimate_snapshot(db: Session, ticker: str, as_of: date) -> Fundamentals | None:
    """Most recent stored fundamentals at least REVISION_LOOKBACK_DAYS old.

    Falls back to the oldest snapshot strictly before `as_of` so that a young
    history still yields a (shorter-window) revision rather than nothing.
    """
    cutoff = as_of - timedelta(days=REVISION_LOOKBACK_DAYS)
    row = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of <= cutoff)
        .order_by(Fundamentals.as_of.desc(), Fundamentals.id.desc())
        .first()
    )
    if row:
        return row
    return (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == ticker, Fundamentals.as_of < as_of)
        .order_by(Fundamentals.as_of.asc(), Fundamentals.id.asc())
        .first()
    )


def _pct_change(current, prior) -> float | None:
    try:
        cur = float(current)
        old = float(prior)
    except (TypeError, ValueError):
        return None
    if old == 0:
        return None
    # abs() in the denominator keeps the sign meaningful when consensus is
    # negative (a loss-making name whose estimated loss narrows is an upward
    # revision).
    return (cur - old) / abs(old)


def compute_estimate_revisions(
    db: Session, ticker: str, current: dict, as_of: date
) -> dict:
    """Period-over-period change in consensus estimates — a real revision.

    The previous implementation stored `estimatedEpsAvg` / `estimatedRevenueAvg`
    directly, i.e. estimate *levels*. Percentile-ranked within a sector that is
    largely a company-size factor, not a revisions factor, and it carries weight
    0.30 and gates every buy via `min_revisions_grade`.

    KNOWN GAP: FMP's v3 `analyst-estimates` endpoint only exposes the *current*
    consensus, not a consensus history, so a genuine revision cannot be computed
    on the very first fundamentals refresh for a ticker. We derive it from our
    own stored `Fundamentals` history instead, which means the factor is null
    (grade "F") until a ticker has two snapshots spanning the lookback, and null
    again for one cycle when the forward fiscal period rolls over. Null revisions
    fail `min_revisions_grade: "B+"`, so buys are blocked rather than made on a
    factor the backtest never used. `score_universe` logs coverage each run.
    """
    period = current.get("estimatePeriod")
    if not period:
        return {}
    prior_row = _prior_estimate_snapshot(db, ticker, as_of)
    prior = (prior_row.data or {}) if prior_row else {}
    if not prior or prior.get("estimatePeriod") != period:
        return {}
    if (as_of - prior_row.as_of).days < MIN_REVISION_LOOKBACK_DAYS:
        return {}
    out: dict = {}
    eps_rev = _pct_change(current.get("epsEstimateAvg"), prior.get("epsEstimateAvg"))
    rev_rev = _pct_change(
        current.get("revenueEstimateAvg"), prior.get("revenueEstimateAvg")
    )
    if eps_rev is not None:
        out["epsRevisionPct"] = eps_rev
    if rev_rev is not None:
        out["revenueRevisionPct"] = rev_rev
    if out:
        out["revisionBasisDate"] = prior_row.as_of.isoformat()
        out["revisionLookbackDays"] = (as_of - prior_row.as_of).days
    return out


def _sum_field(rows: list[dict], field: str) -> float | None:
    total = 0.0
    for row in rows:
        value = row.get(field)
        if value is None:
            return None
        try:
            total += float(value)
        except (TypeError, ValueError):
            return None
    return total


def compute_ttm_growth(rows: list[dict]) -> dict:
    """Trailing-twelve-month growth from eight quarterly income statements.

    Latest four quarters against the four before them. This reproduces what the
    `*GrowthTTM` metric names have always implied, and it is calendar-aligned
    across companies — unlike FMP's fiscal-year `financial-growth`, where a
    December filer and a June filer end up percentile-ranked against windows
    almost a year apart.

    `abs()` in the denominator, matching `_pct_change`: a company whose net
    income goes from -$10m to +$5m has improved, and a signed denominator would
    score that as -150% and bury the turnaround at the bottom of the factor.

    EPS is derived from TTM net income over the latest diluted share count
    rather than by summing quarterly EPS, which drifts when the count changes
    mid-year.
    """
    dated = [r for r in rows if r.get("date")]
    if len(dated) < 8:
        return {}
    dated.sort(key=lambda r: str(r["date"]), reverse=True)
    recent, prior = dated[:4], dated[4:8]

    out: dict = {}
    for field, key in (
        ("revenue", "revenueGrowthTTM"),
        ("netIncome", "netIncomeGrowthTTM"),
    ):
        cur = _sum_field(recent, field)
        old = _sum_field(prior, field)
        if cur is None or old is None or old == 0:
            continue
        out[key] = (cur - old) / abs(old)

    cur_ni = _sum_field(recent, "netIncome")
    old_ni = _sum_field(prior, "netIncome")
    cur_sh = recent[0].get("weightedAverageShsOutDil")
    old_sh = prior[0].get("weightedAverageShsOutDil")
    try:
        cur_sh = float(cur_sh) if cur_sh else None
        old_sh = float(old_sh) if old_sh else None
    except (TypeError, ValueError):
        cur_sh = old_sh = None
    if cur_ni is not None and old_ni is not None and cur_sh and old_sh:
        cur_eps, old_eps = cur_ni / cur_sh, old_ni / old_sh
        if old_eps != 0:
            out["epsGrowthTTM"] = (cur_eps - old_eps) / abs(old_eps)

    if out:
        out["growthBasisPeriod"] = str(recent[0]["date"])[:10]
    return out


def refresh_fundamentals(db: Session, fmp: FMPClient, max_tickers: int = 400) -> int:
    # Held positions are ALWAYS refreshed, whatever their size. Ranking by market
    # cap alone dropped 7 of 8 real holdings outside the cut, and an unscored
    # holding is invisible to `_removal_signals` (it skips any position with no
    # score) — the book would silently stop being evaluated for sells.
    held = {
        row[0]
        for row in db.query(Position.ticker).filter(Position.portfolio_id == 1).all()
    }
    # NULLS LAST matters: Postgres sorts NULL first on DESC, so unpriced shells
    # would otherwise consume the budget ahead of the largest real companies.
    ranked = (
        db.query(Stock)
        .filter(Stock.is_active == True)  # noqa: E712
        .order_by(Stock.market_cap.desc().nullslast())
        .limit(max_tickers)
        .all()
    )
    stocks = list(ranked)
    seen = {s.ticker for s in stocks}
    for ticker in sorted(held - seen):
        stock = db.get(Stock, ticker)
        if stock is not None:
            stocks.append(stock)
    as_of = date.today()
    n = 0
    revisions_available = 0
    growth_available = 0
    # Growth is one endpoint among several here. `_get` raises FMPAccessError on
    # 401/402/403 so a plan restriction can never masquerade as "no data" — but
    # unhandled that would abort refresh_fundamentals and take the rest of
    # weekly_refresh with it, including refresh_marks. Losing marks means stale
    # position prices and a hole in the published equity curve, which is far
    # worse than losing one factor for a day. Trip a breaker instead.
    growth_supported = True
    for s in stocks:
        metrics = fmp.key_metrics_ttm(s.ticker) or {}
        ratios = fmp.ratios_ttm(s.ticker) or {}
        data = {**metrics, **ratios}
        if growth_supported:
            try:
                growth = compute_ttm_growth(fmp.income_statement_quarterly(s.ticker))
            except FMPAccessError:
                log.exception(
                    "income-statement is not available on this FMP plan; growth "
                    "will be null for the rest of this run, which blocks every "
                    "buy via min_growth_grade. Continuing so marks still update."
                )
                growth_supported = False
                growth = {}
            if growth:
                growth_available += 1
                data.update(growth)
        estimate = _forward_estimate(fmp.analyst_estimates(s.ticker), as_of)
        if estimate:
            data.update(estimate)
            revision = compute_estimate_revisions(db, s.ticker, estimate, as_of)
            if revision:
                revisions_available += 1
            data.update(revision)
        if not data:
            continue
        # Update in place: (ticker, as_of) is unique, so a second run on the
        # same day must overwrite rather than insert alongside.
        row = (
            db.query(Fundamentals)
            .filter(Fundamentals.ticker == s.ticker, Fundamentals.as_of == as_of)
            .one_or_none()
        )
        if row is None:
            db.add(Fundamentals(ticker=s.ticker, as_of=as_of, data=data))
        else:
            row.data = data
        profile = fmp.profile(s.ticker)
        if profile:
            s.sector = profile.get("sector") or s.sector
            s.industry = profile.get("industry") or s.industry
            # `/stable` renamed this from the legacy `mktCap`. Reading only the
            # old name left market_cap NULL for every stock not in the screener
            # (i.e. the hand-seeded holdings), and score_universe filters on
            # `market_cap >= min_universe_market_cap` — so those names were
            # dropped from scoring entirely. Accept both, newest name first.
            s.market_cap = (
                profile.get("marketCap") or profile.get("mktCap") or s.market_cap
            )
            s.name = profile.get("companyName") or s.name
        n += 1
        if n % 25 == 0:
            db.commit()
            log.info("Fundamentals progress: %s", n)
    db.commit()
    if n and not revisions_available:
        log.warning(
            "Fundamentals refresh stored %s tickers but computed 0 estimate "
            "revisions — not enough consensus history yet. The revisions factor "
            "(weight 0.30) will grade F and block all buys until a second "
            "snapshot exists.",
            n,
        )
    else:
        log.info("Estimate revisions computed for %s/%s tickers", revisions_available, n)
    if n and not growth_available:
        log.warning(
            "Fundamentals refresh stored %s tickers but computed 0 TTM growth "
            "values. Growth carries weight 0.35 and gates every buy via "
            "min_growth_grade, and under the factor-coverage floor a null growth "
            "value makes the ticker unscoreable outright.",
            n,
        )
    else:
        log.info("TTM growth computed for %s/%s tickers", growth_available, n)
    return n


def backfill_price_history(
    db: Session,
    fmp: FMPClient,
    lookback_days: int = 430,
    min_bars: int = 200,
    max_tickers: int | None = None,
) -> dict:
    """Fetch daily closes so the 12-month momentum factor can be computed.

    Momentum needs a bar at or before `as_of - 365d`. Fetching exactly 365 days
    lands the first bar *after* the target once weekends and holidays are
    accounted for, so the lookup finds nothing — hence 430.

    Tickers that already have `min_bars` are skipped, which makes this cheap to
    re-run and lets it double as top-up for names that entered the universe
    later. Today is excluded so this never contends with `refresh_marks`.
    """
    start = date.today() - timedelta(days=lookback_days)
    cutoff = date.today()

    counts = dict(
        db.query(PriceBar.ticker, func.count(PriceBar.id)).group_by(PriceBar.ticker).all()
    )
    universe = (
        db.query(Stock.ticker)
        .filter(Stock.is_active == True)  # noqa: E712
        .order_by(Stock.market_cap.desc().nullslast())
        .all()
    )
    held = {
        row[0]
        for row in db.query(Position.ticker).filter(Position.portfolio_id == 1).all()
    }
    tickers = [t for (t,) in universe if counts.get(t, 0) < min_bars]
    for ticker in sorted(held):
        if ticker not in tickers and counts.get(ticker, 0) < min_bars:
            tickers.append(ticker)
    if max_tickers is not None:
        tickers = tickers[:max_tickers]

    fetched = 0
    inserted = 0
    rows_seen = 0
    rows_adjusted = 0
    for ticker in tickers:
        try:
            rows = fmp.historical_prices(ticker, start)
        except FMPAccessError:
            log.exception("historical prices unavailable on this plan; stopping")
            break
        bars: list[dict] = []
        for row in rows or []:
            raw_date = row.get("date")
            # CLOSE_FIELDS, resolved with first_present rather than
            # `row.get("adjClose", row.get("close"))`: the latter returns None
            # for a row that carries `"adjClose": null` alongside a perfectly
            # usable `close`, and the `close is None` guard below then drops the
            # bar outright.
            close = first_present(row, *CLOSE_FIELDS)
            rows_seen += 1
            if row.get("adjClose") is not None:
                rows_adjusted += 1
            if not raw_date or close is None:
                continue
            try:
                bar_date = date.fromisoformat(str(raw_date)[:10])
                close = float(close)
            except (TypeError, ValueError):
                continue
            if bar_date >= cutoff or bar_date < start:
                continue
            bars.append({"ticker": ticker, "date": bar_date, "close": close})
        if bars:
            # Dedupe within the payload; ON CONFLICT cannot resolve two rows
            # with the same key inside a single statement.
            unique = {(b["ticker"], b["date"]): b for b in bars}
            inserted += bulk_insert_price_bars(db, list(unique.values()))
        fetched += 1
        if fetched % 25 == 0:
            log.info("Price backfill progress: %s/%s tickers", fetched, len(tickers))

    log.info("Price backfill: %s tickers, %s bars attempted", fetched, inserted)
    # Settles, from live data, a question the code cannot answer offline: does
    # `/stable/historical-price-eod/full` actually carry adjClose? If it does
    # not, the whole series is unadjusted and EVERY recent split fabricates a
    # large negative 12-month return for the affected ticker. Momentum is 15% of
    # the composite and drags a further momentum_penalty when negative, so this
    # is not a rounding concern. Log it either way rather than assuming.
    if rows_seen and not rows_adjusted:
        log.warning(
            "Price backfill: 0/%s FMP rows carried adjClose — the stored series "
            "is UNADJUSTED, so any split in the last 12 months fabricates a "
            "large negative momentum reading for that ticker",
            rows_seen,
        )
    else:
        log.info("Price backfill: %s/%s rows carried adjClose", rows_adjusted, rows_seen)
    return {
        "tickers": fetched,
        "bars": inserted,
        "candidates": len(tickers),
        "rows_seen": rows_seen,
        "rows_adjusted": rows_adjusted,
    }


def refresh_marks(db: Session, fmp: FMPClient) -> int:
    """Update marks for open positions + recent candidates only (lean)."""
    portfolio = ensure_default_portfolio(db)
    pos_tickers = [
        p.ticker
        for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    ]
    # Top scored candidates, by RATING, from the latest scoring date.
    #
    # This was `ORDER BY composite_scores.id DESC LIMIT 100` with no as_of
    # filter, which is neither. `score_universe` UPDATEs rows in place and only
    # INSERTs for tickers it has never seen, so ids are frozen at first sight:
    # the 100 rows selected were whichever tickers happened to be written last
    # on the very FIRST scoring run, permanently. With no as_of bound one
    # ticker's rows from several dates could also occupy several of the 100
    # slots, shrinking the set further. The #1-rated name — the one on the
    # dashboard, the one evaluate() buys — could sit outside that slice forever,
    # so its Stock.last_price and its daily PriceBar simply stopped updating,
    # feeding a stale mark into momentum and into the published price.
    #
    # Ticker is the tie-break so the cut is deterministic across runs rather
    # than dependent on row order.
    from app.db.models import CompositeScore

    latest_as_of = db.query(func.max(CompositeScore.as_of)).scalar()
    candidates = (
        db.query(CompositeScore.ticker)
        .filter(CompositeScore.as_of == latest_as_of)
        .order_by(CompositeScore.quant_rating.desc().nullslast(), CompositeScore.ticker.asc())
        .limit(100)
        .all()
        if latest_as_of is not None
        else []
    )
    held_tickers = set(pos_tickers)
    tickers = list({*pos_tickers, *[c[0] for c in candidates], "SPY"})
    quotes = fmp.batch_quotes(tickers)
    # Date the bar to the session it actually belongs to. FMP returns the last
    # close when the market is shut, so stamping it with date.today() invented a
    # Saturday bar carrying Friday's price — 115 such phantom rows accumulated.
    # They distort any date-windowed price lookup and put flat points on the
    # curve. job_daily_marks already guards this by skipping non-trading days;
    # weekly_refresh calls refresh_marks directly and did not.
    today = last_trading_day_on_or_before(date.today())
    n = 0
    by_sym = {q.get("symbol"): q for q in quotes if q.get("symbol")}
    for ticker in tickers:
        q = by_sym.get(ticker)
        if not q:
            continue
        price = q.get("price") or q.get("previousClose")
        if not price:
            continue
        stock = db.get(Stock, ticker)
        if not stock:
            # A ticker can be held without ever having come through
            # refresh_universe — manually entered positions are the common
            # case. Skipping them here silently left every hand-entered
            # position marked at its entry price forever.
            stock = Stock(ticker=ticker, name=q.get("name"), is_active=True, is_etf=False)
            db.add(stock)
        # Backfill market cap whenever it is unknown, including on rows this
        # function created earlier.
        #
        # compute_scores filters the universe with
        # `Stock.market_cap >= min_universe_market_cap`, and in SQL a NULL fails
        # that comparison. A hand-entered position therefore was not merely
        # unscored, it was never CONSIDERED — permanently "unrated" on the
        # dashboard no matter how often scoring ran. Worse, `_removal_signals`
        # skips holdings with no score, so no exit rule could ever fire on one
        # either. Unknown is not the same as small, and it must not be resolved
        # by silently dropping the row.
        if stock.market_cap is None:
            raw_cap = q.get("marketCap") or q.get("marketCapitalization")
            if raw_cap:
                try:
                    stock.market_cap = float(raw_cap)
                except (TypeError, ValueError):
                    pass
        # Sector is the second gate, and clearing market_cap alone does not get
        # a ticker scored. `compute_scores` builds its peer groups with
        # `if s.ticker in funds and s.sector` — a NULL sector drops the row
        # before `considered` is even incremented, so it appears in no count and
        # no log line. Sector is not on the quote payload, so fetch the profile,
        # but only for rows that lack one: this is a per-ticker call and the
        # gap it closes is rare and permanent, not recurring.
        #
        # `refresh_fundamentals` also resolves sector from the same endpoint,
        # but only on the weekly refresh. A held position that cannot be scored
        # is not merely unrated on the dashboard — `_removal_signals` skips
        # holdings with no score, so no exit rule can fire on it. Waiting until
        # Saturday for that is too long.
        #
        # Scoped to HELD tickers. Candidates arrive via refresh_universe with a
        # sector already set, and SPY is a benchmark that legitimately has none
        # — looking it up every run would spend a call and log a warning
        # forever for a row that is not a candidate for anything.
        if not stock.sector and ticker in held_tickers:
            try:
                profile = fmp.profile(ticker)
            except Exception:  # never let a marks run die on one lookup
                profile = None
            if profile:
                stock.sector = profile.get("sector") or stock.sector
                stock.industry = profile.get("industry") or stock.industry
                stock.name = stock.name or profile.get("companyName")
            if not stock.sector:
                log.warning(
                    "%s has no sector; it cannot be scored, rated, or exited "
                    "by any rule until one is resolved",
                    ticker,
                )
        stock.last_price = float(price)
        stock.updated_at = datetime.now(timezone.utc)
        upsert_price_bar(db, ticker, today, float(price))
        n += 1

    db.flush()

    # Update open position marks
    marked = 0
    for p in db.query(Position).filter(Position.portfolio_id == portfolio.id).all():
        stock = db.get(Stock, p.ticker)
        if stock and stock.last_price:
            p.current_price = stock.last_price
            marked += 1
        else:
            log.warning("No mark available for held position %s", p.ticker)
    log.info("Marked %s/%s open positions", marked, len(pos_tickers))

    # Snapshot
    positions = db.query(Position).filter(Position.portfolio_id == portfolio.id).all()
    invested = sum(p.market_value for p in positions)
    spy = db.get(Stock, "SPY")
    existing = (
        db.query(PortfolioSnapshot)
        .filter(PortfolioSnapshot.portfolio_id == portfolio.id, PortfolioSnapshot.date == today)
        .first()
    )
    if existing:
        existing.cash = portfolio.cash
        existing.invested_value = invested
        existing.total_value = portfolio.cash + invested
        existing.position_count = len(positions)
        existing.spy_value = spy.last_price if spy else None
    else:
        db.add(
            PortfolioSnapshot(
                portfolio_id=portfolio.id,
                date=today,
                cash=portfolio.cash,
                invested_value=invested,
                total_value=portfolio.cash + invested,
                spy_value=spy.last_price if spy else None,
                position_count=len(positions),
            )
        )
    db.commit()
    log.info("Updated %s marks", n)
    return n
