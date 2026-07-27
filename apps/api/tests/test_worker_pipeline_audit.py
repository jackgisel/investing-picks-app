"""Data-pipeline audit: refresh_universe -> refresh_fundamentals -> score_universe
-> refresh_marks.

Every test names the production failure it prevents. Tests marked xfail(strict)
assert the CORRECT behaviour and pin a live bug; production code is unchanged.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from outpick_strategy import RUN118_PARAMS

from app.db.models import CompositeScore, Fundamentals, PriceBar, Stock
from worker.services.fmp import FMPAccessError
from worker.services.ingest import (
    _forward_estimate,
    backfill_price_history,
    bulk_insert_price_bars,
    compute_ttm_growth,
    refresh_fundamentals,
    refresh_marks,
    refresh_universe,
    upsert_price_bar,
)
from worker.services.scoring import _momentum_12m, compute_scores, score_universe

TODAY = date.today()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


def _full_fundamentals(**overrides) -> dict:
    """A snapshot carrying every key the five factors read.

    Mirrors VALUATION_KEYS / GROWTH_KEYS / PROFIT_KEYS / REVISION_KEYS exactly.
    If a field name in scoring.py is renamed without updating this dict, the
    tests that require full factor coverage stop covering and start failing —
    which is the point: a silently-None factor is invisible in production.
    """
    data = {
        # valuation (lower is better)
        "priceToEarningsRatioTTM": 20.0,
        "priceToEarningsGrowthRatioTTM": 2.0,
        "evToEBITDATTM": 15.0,
        "priceToBookRatioTTM": 4.0,
        "priceToSalesRatioTTM": 5.0,
        # growth (higher is better)
        "revenueGrowthTTM": 0.10,
        "epsGrowthTTM": 0.10,
        "netIncomeGrowthTTM": 0.10,
        # profitability (higher is better)
        "grossProfitMarginTTM": 0.40,
        "operatingProfitMarginTTM": 0.20,
        "netProfitMarginTTM": 0.15,
        "returnOnEquityTTM": 0.20,
        "returnOnAssetsTTM": 0.10,
        "returnOnCapitalEmployedTTM": 0.18,
        # revisions (higher is better)
        "epsRevisionPct": 0.05,
        "revenueRevisionPct": 0.05,
    }
    data.update(overrides)
    return data


def _stock(db, ticker, sector="Technology", cap=5e9, **kw):
    db.add(
        Stock(
            ticker=ticker,
            sector=sector,
            market_cap=cap,
            is_active=kw.pop("is_active", True),
            is_etf=kw.pop("is_etf", False),
            **kw,
        )
    )


def _momentum_bars(db, ticker, latest_close, anchor_close=100.0, latest_age_days=0):
    """Two bars: today's (or `latest_age_days` old) close and the 12m anchor."""
    db.add(
        PriceBar(
            ticker=ticker,
            date=TODAY - timedelta(days=latest_age_days),
            close=latest_close,
        )
    )
    db.add(PriceBar(ticker=ticker, date=TODAY - timedelta(days=365), close=anchor_close))


def _quarters(n=8, revenue=100.0, net_income=10.0, shares=1000.0, growth=1.0):
    """`n` quarterly income statements, newest first.

    The oldest four carry `revenue`/`net_income`; the newest four are scaled by
    `growth` so compute_ttm_growth has something to measure.
    """
    rows = []
    for i in range(n):
        recent = i < 4
        rows.append(
            {
                "date": (date(2026, 6, 30) - timedelta(days=91 * i)).isoformat(),
                "revenue": revenue * (growth if recent else 1.0),
                "netIncome": net_income * (growth if recent else 1.0),
                "weightedAverageShsOutDil": shares,
            }
        )
    return rows


class RecordingQuoteFMP:
    """batch_quotes stand-in that records exactly which symbols were asked for."""

    def __init__(self, price=10.0, market_cap=4e9):
        self.requested: list[str] = []
        self.price = price
        self.market_cap = market_cap

    def batch_quotes(self, tickers):
        self.requested = list(tickers)
        return [
            {"symbol": t, "price": self.price, "marketCap": self.market_cap}
            for t in tickers
        ]


class FundamentalsFMP:
    """Stand-in for the endpoints refresh_fundamentals touches."""

    def __init__(self, quarters=None, income_raises=False):
        self._quarters = _quarters() if quarters is None else quarters
        self.income_raises = income_raises

    def key_metrics_ttm(self, ticker):
        return {
            "evToEBITDATTM": 15.0,
            "returnOnEquityTTM": 0.2,
            "returnOnAssetsTTM": 0.1,
            "returnOnCapitalEmployedTTM": 0.18,
        }

    def ratios_ttm(self, ticker):
        return {
            "priceToEarningsRatioTTM": 20.0,
            "priceToEarningsGrowthRatioTTM": 2.0,
            "priceToBookRatioTTM": 4.0,
            "priceToSalesRatioTTM": 5.0,
            "grossProfitMarginTTM": 0.4,
            "operatingProfitMarginTTM": 0.2,
            "netProfitMarginTTM": 0.15,
        }

    def income_statement_quarterly(self, ticker, limit=8):
        if self.income_raises:
            raise FMPAccessError("income-statement not on this plan")
        return self._quarters

    def analyst_estimates(self, ticker):
        return [{"date": "2099-12-31", "epsAvg": 2.0, "revenueAvg": 200.0}]

    def profile(self, ticker):
        return {"sector": "Technology", "industry": "Software", "marketCap": 5e9}


# ---------------------------------------------------------------------------
# BUG-W1 — refresh_marks picks "top candidates" by row id, not by rating
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W1: refresh_marks orders candidates by CompositeScore.id DESC, not "
        "by quant_rating, so the highest-rated names never get a fresh quote"
    ),
    strict=True,
)
def test_refresh_marks_quotes_the_highest_rated_candidates(db):
    """The picks the product publishes must be the ones that get a fresh price.

    refresh_marks' docstring says "top scored candidates" but it selects
    `ORDER BY composite_scores.id DESC LIMIT 100`. score_universe UPDATES rows
    in place for tickers it has seen before and only INSERTs for new ones, so
    ids are frozen at first sight: the 100 rows selected are whichever tickers
    happened to be inserted last on the very first scoring run, forever. The
    #1-rated name — the one shown on the dashboard and the one evaluate() buys
    — can sit outside that slice permanently, so its Stock.last_price and its
    daily PriceBar go stale, feeding a stale mark into the momentum factor and
    into the published equity curve.
    """
    for i in range(120):
        ticker = f"T{i:03d}"
        _stock(db, ticker)
        db.add(
            CompositeScore(
                ticker=ticker,
                as_of=TODAY,
                # T000 is inserted first (lowest id) and is the best-rated name.
                quant_rating=5.0 if i == 0 else 1.0,
                sector="Technology",
            )
        )
    db.commit()

    fmp = RecordingQuoteFMP()
    refresh_marks(db, fmp)

    assert "T000" in fmp.requested


# ---------------------------------------------------------------------------
# BUG-W2 — momentum is computed off a stale "latest" bar
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W2: _momentum_12m accepts any newest bar as 'today', so a ticker "
        "whose price feed stopped months ago reports a stale 12-month return"
    ),
    strict=True,
)
def test_momentum_refuses_a_stale_latest_bar():
    """A months-old close must not be ranked as a current 12-month return.

    Only held positions, an id-ordered slice of 100 candidates and SPY get a
    fresh bar from refresh_marks; backfill_price_history is unscheduled and
    skips any ticker that already has 200 bars. So for most of the universe the
    newest PriceBar is frozen at the backfill date while `as_of - 365d` keeps
    advancing. _momentum_12m divides that frozen close by a bar 365 days before
    TODAY and calls the result a 12-month return, then percentile-ranks it
    against candidates whose newest bar really is today. A name that doubled
    into its last recorded close and has since halved still ranks top of sector
    on momentum and gets bought.
    """
    history = {
        "STALE": [
            (TODAY - timedelta(days=90), 200.0),  # feed stopped 90 days ago
            (TODAY - timedelta(days=365), 100.0),
        ]
    }
    assert _momentum_12m(history, "STALE", TODAY) is None


def test_momentum_accepts_a_current_latest_bar():
    """Control for the test above: a fresh feed must still produce a return."""
    history = {
        "FRESH": [(TODAY, 200.0), (TODAY - timedelta(days=365), 100.0)],
    }
    assert _momentum_12m(history, "FRESH", TODAY) == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# BUG-W3 — a NULL sector deletes a ticker from the pipeline with no trace
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W3: compute_scores' `if s.ticker in funds and s.sector` drops "
        "sector-less stocks before `considered` is incremented, so they are "
        "invisible to every count and log line"
    ),
    strict=True,
)
def test_a_stock_with_no_sector_is_not_silently_dropped(db):
    """Same failure class as the NULL market_cap bug, via a different column.

    refresh_marks creates a Stock row for a hand-entered position from a quote,
    which carries no sector. market_cap is now backfilled so the row survives
    the SQL universe filter, but `by_sector` is built with a truthiness test on
    s.sector, so the ticker is skipped before `considered` is incremented and
    before missing_factor is touched. It is therefore never scored, never rated
    on the dashboard, never eligible for an exit rule (_removal_signals skips
    holdings with no score) — and it does not appear in the "N candidates
    failed the coverage floor" warning either, so nothing anywhere says it
    exists. Whatever the fix, the ticker must at minimum be accounted for.
    """
    _stock(db, "NOSEC", sector=None)
    db.add(Fundamentals(ticker="NOSEC", as_of=TODAY, data=_full_fundamentals()))
    _momentum_bars(db, "NOSEC", 150.0)
    db.commit()

    _scored, _missing, considered = compute_scores(db, RUN118_PARAMS, TODAY)

    assert considered == 1


def test_a_stock_with_a_sector_is_considered(db):
    """Control: the same fixture with a sector does reach the scorer."""
    _stock(db, "HASSEC", sector="Technology")
    db.add(Fundamentals(ticker="HASSEC", as_of=TODAY, data=_full_fundamentals()))
    _momentum_bars(db, "HASSEC", 150.0)
    db.commit()

    _scored, _missing, considered = compute_scores(db, RUN118_PARAMS, TODAY)
    assert considered == 1


# ---------------------------------------------------------------------------
# BUG-W4 — a two-name sector manufactures a perfect, unconditional buy
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W4: no minimum sector population, so with n=2 the better name "
        "scores 100th percentile on all five factors -> quant_rating 5.0 and "
        "A+ on every buy gate, regardless of absolute quality"
    ),
    strict=True,
)
def test_a_two_ticker_sector_cannot_manufacture_a_perfect_rating(db):
    """Rank within a population of two is not evidence, but it grades like it.

    factor_percentile_score maps the better of two values to 100.0 and the
    worse to 0.0. With five factors that makes the better name composite 100 ->
    quant_rating 5.0 with A+ on valuation, growth, profitability, momentum and
    revisions — clearing min_quant_rating 4.0 and every grade floor in
    BuyCriteria simultaneously. min_factor_coverage = 1.0 makes tiny covered
    sectors ordinary (the revisions factor alone needs two fundamentals
    snapshots spanning 5+ days), so the strategy can be handed a guaranteed
    "perfect" pick that is merely the less-bad of two mediocre names. Here both
    names are mediocre in absolute terms and AAA is only marginally better.
    """
    for ticker, mult in (("AAA", 1.0), ("BBB", 0.9)):
        _stock(db, ticker, sector="Utilities")
        db.add(
            Fundamentals(
                ticker=ticker,
                as_of=TODAY,
                data=_full_fundamentals(
                    priceToEarningsRatioTTM=20.0 / mult,
                    priceToEarningsGrowthRatioTTM=2.0 / mult,
                    evToEBITDATTM=15.0 / mult,
                    priceToBookRatioTTM=4.0 / mult,
                    priceToSalesRatioTTM=5.0 / mult,
                    revenueGrowthTTM=0.02 * mult,
                    epsGrowthTTM=0.02 * mult,
                    netIncomeGrowthTTM=0.02 * mult,
                    grossProfitMarginTTM=0.10 * mult,
                    operatingProfitMarginTTM=0.03 * mult,
                    netProfitMarginTTM=0.02 * mult,
                    returnOnEquityTTM=0.04 * mult,
                    returnOnAssetsTTM=0.02 * mult,
                    returnOnCapitalEmployedTTM=0.03 * mult,
                    epsRevisionPct=0.001 * mult,
                    revenueRevisionPct=0.001 * mult,
                ),
            )
        )
    _momentum_bars(db, "AAA", 102.0)
    _momentum_bars(db, "BBB", 101.0)
    db.commit()

    scored, _missing, _considered = compute_scores(db, RUN118_PARAMS, TODAY)
    top = next((s for s in scored if s.ticker == "AAA"), None)

    assert top is None or top.quant_rating < 5.0


def test_a_one_ticker_sector_gets_the_neutral_midpoint(db):
    """Documents the n=1 case, which is safe and must stay safe.

    A lone name in its sector is given 50.0 on every factor -> composite 50 ->
    quant_rating 3.0, below min_quant_rating 4.0, so it cannot be bought. If
    someone "fixes" the n=1 tie handling to award 100.0 the way n=2 does, every
    sector-of-one becomes an automatic buy.
    """
    _stock(db, "LONE", sector="Energy")
    db.add(Fundamentals(ticker="LONE", as_of=TODAY, data=_full_fundamentals()))
    _momentum_bars(db, "LONE", 150.0)
    db.commit()

    scored, _missing, considered = compute_scores(db, RUN118_PARAMS, TODAY)

    assert considered == 1
    assert len(scored) == 1
    assert scored[0].composite == pytest.approx(50.0)
    assert scored[0].quant_rating == pytest.approx(3.0)
    assert scored[0].quant_rating < RUN118_PARAMS.buy_criteria.min_quant_rating


# ---------------------------------------------------------------------------
# BUG-W5 — a degraded re-run destroys a good fundamentals snapshot
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W5: refresh_fundamentals replaces row.data wholesale, so a re-run "
        "in which one endpoint is unavailable erases the factors the earlier "
        "run stored"
    ),
    strict=True,
)
def test_a_degraded_rerun_does_not_erase_stored_growth(db):
    """A retry during a partial FMP outage must not be worse than not retrying.

    refresh_fundamentals writes `row.data = data` for the (ticker, as_of) row.
    If income-statement is unavailable on the second run — the exact case the
    growth breaker exists to survive — `data` comes back without
    revenueGrowthTTM/epsGrowthTTM/netIncomeGrowthTTM and overwrites the good
    snapshot. Because min_factor_coverage is 1.0, every affected ticker becomes
    unscoreable, and score_universe then DELETES its CompositeScore row for
    today (the existing_today sweep). Net result of re-running a job: the book
    loses the ratings and the sell-side coverage it had an hour earlier, for up
    to a week until the next weekly refresh.
    """
    _stock(db, "AAA")
    db.commit()

    refresh_fundamentals(db, FundamentalsFMP())
    stored = db.query(Fundamentals).filter(Fundamentals.ticker == "AAA").one()
    assert "revenueGrowthTTM" in stored.data, "precondition: run 1 stored growth"

    refresh_fundamentals(db, FundamentalsFMP(income_raises=True))
    db.expire_all()
    stored = db.query(Fundamentals).filter(Fundamentals.ticker == "AAA").one()

    assert "revenueGrowthTTM" in stored.data


# ---------------------------------------------------------------------------
# BUG-W6 — an unknown share price bypasses the only min_share_price gate
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W6: `if price and price < min_share_price` — a missing or zero "
        "screener price is falsy, so the sub-$5 filter never fires"
    ),
    strict=True,
)
def test_a_screener_row_with_no_price_is_not_admitted_to_the_universe(db):
    """min_share_price is enforced in exactly one place, and None defeats it.

    refresh_universe is the only code path in the repo that reads
    params.min_share_price. It computes `price = row.get("price") or 0` and
    then skips on `price and price < min_share_price` — so a row where FMP
    omits `price` (or reports 0, which happens for halted and thinly-traded
    names) sails through the $5 floor and enters the universe permanently:
    nothing ever re-applies the filter to an existing Stock row. The ticker
    then collects fundamentals, gets scored, and is buyable at $0.80. An
    unverifiable price is not the same as an acceptable one.
    """

    class ScreenerFMP:
        def stock_screener(self, min_market_cap, limit):
            return [
                {
                    "symbol": "PENNY",
                    "companyName": "Penny Co",
                    "sector": "Technology",
                    "industry": "Software",
                    "marketCap": 4e8,
                    # no "price" key at all
                },
                {
                    "symbol": "GOOD",
                    "companyName": "Good Co",
                    "sector": "Technology",
                    "industry": "Software",
                    "marketCap": 9e9,
                    "price": 42.0,
                },
            ]

    refresh_universe(db, ScreenerFMP())

    assert db.get(Stock, "GOOD") is not None
    assert db.get(Stock, "PENNY") is None


def test_a_screener_row_priced_below_the_floor_is_rejected(db):
    """Control: a *known* sub-$5 price is correctly excluded."""

    class ScreenerFMP:
        def stock_screener(self, min_market_cap, limit):
            return [
                {
                    "symbol": "CHEAP",
                    "sector": "Technology",
                    "marketCap": 4e8,
                    "price": 1.5,
                },
                {
                    "symbol": "GOOD",
                    "sector": "Technology",
                    "marketCap": 9e9,
                    "price": 42.0,
                },
            ]

    refresh_universe(db, ScreenerFMP())

    assert db.get(Stock, "CHEAP") is None
    assert db.get(Stock, "GOOD") is not None


# ---------------------------------------------------------------------------
# BUG-W7 — dict.get(key, fallback) does not fall back on a present-but-null key
# ---------------------------------------------------------------------------


@pytest.mark.xfail(
    reason=(
        "BUG-W7: backfill_price_history uses row.get('adjClose', row.get('close')), "
        "so a row where FMP sends adjClose: null drops the bar entirely instead "
        "of using the unadjusted close that is right there"
    ),
    strict=True,
)
def test_a_null_adjclose_falls_back_to_the_unadjusted_close(db):
    """A present-but-null key silently defeats the fallback.

    `d.get(a, d.get(b))` returns None when `a` exists with value None — the
    default is only used when the key is ABSENT. FMP sends explicit nulls for
    fields it has no value for, so a payload of {"date": ..., "adjClose": null,
    "close": 100.0} is discarded by the `close is None` guard even though a
    usable close is in the same row. Every such day becomes a hole in the price
    history; a hole at the 12-month anchor makes _momentum_12m return None,
    which under min_factor_coverage 1.0 makes the whole ticker unscoreable —
    so it is neither buyable nor sellable. The same `.get(a, .get(b))` shape is
    used for the analyst-estimate aliases in _forward_estimate.
    """
    _stock(db, "AAA")
    db.commit()

    class HistoryFMP:
        def historical_prices(self, ticker, from_date=None):
            return [
                {
                    "date": (TODAY - timedelta(days=10)).isoformat(),
                    "adjClose": None,
                    "close": 100.0,
                }
            ]

    backfill_price_history(db, HistoryFMP())

    assert db.query(PriceBar).filter(PriceBar.ticker == "AAA").count() == 1


@pytest.mark.xfail(
    reason=(
        "BUG-W8: the two writers of price_bars disagree on which FMP close "
        "wins — backfill_price_history prefers adjClose, backfill._parse_series "
        "prefers close — so the same day can hold either an adjusted or an "
        "unadjusted price depending on which job wrote last"
    ),
    strict=True,
)
def test_both_price_writers_agree_on_which_close_field_wins(db):
    """One table, two parsers, opposite field priority.

    `backfill_price_history` (ingest.py) reads adjClose first and falls back to
    close. `backfill._parse_series`, which feeds `apply_plan` ->
    `upsert_price_bar` for the equity-curve reconstruction, reads close first
    and falls back to adjClose — and upsert_price_bar OVERWRITES on conflict,
    so whichever job ran last decides. A ticker that split 3-for-1 therefore
    has a price series that jumps by 3x at the boundary between the days each
    job happened to write, which _momentum_12m reads as a -67% or +200% annual
    return: bottom-of-sector momentum plus the 20-point momentum_penalty, or a
    top-percentile momentum grade, on a stock whose price never moved.
    """
    from worker.services.backfill import _parse_series

    day = TODAY - timedelta(days=10)
    row = {"date": day.isoformat(), "close": 100.0, "adjClose": 50.0}

    _stock(db, "AAA")
    db.commit()

    class HistoryFMP:
        def historical_prices(self, ticker, from_date=None):
            return [dict(row)]

    backfill_price_history(db, HistoryFMP())
    bar = db.query(PriceBar).filter(PriceBar.ticker == "AAA").one()
    series = _parse_series("AAA", [dict(row)])

    assert bar.close == series.at(day)


def test_an_absent_adjclose_falls_back_to_the_unadjusted_close(db):
    """Control: when the key is simply missing, the fallback does work."""
    _stock(db, "AAA")
    db.commit()

    class HistoryFMP:
        def historical_prices(self, ticker, from_date=None):
            return [
                {"date": (TODAY - timedelta(days=10)).isoformat(), "close": 100.0}
            ]

    backfill_price_history(db, HistoryFMP())

    bar = db.query(PriceBar).filter(PriceBar.ticker == "AAA").one()
    assert bar.close == 100.0


# ---------------------------------------------------------------------------
# Partial-failure and idempotency guards (current behaviour is correct)
# ---------------------------------------------------------------------------


class _Screener:
    def __init__(self, rows):
        self.rows = rows

    def stock_screener(self, min_market_cap, limit):
        return self.rows


def _row(sym, cap=1e9, price=50.0):
    return {
        "symbol": sym,
        "companyName": f"{sym} Inc",
        "sector": "Technology",
        "industry": "Software",
        "marketCap": cap,
        "price": price,
    }


def test_a_truncated_screener_response_does_not_shrink_the_universe(db):
    """FMP can return 200 with a short list; that must not delist the book.

    refresh_universe only ever sets is_active=True and never False. That is a
    deliberate asymmetry: a truncated screener page (a plan throttle, a partial
    upstream outage) would otherwise deactivate most of the universe in one
    pass, and compute_scores filters on is_active — every affected holding
    would go unscored, and therefore unsellable, in a single job run.
    """
    refresh_universe(db, _Screener([_row("AAA"), _row("BBB"), _row("CCC")]))
    assert db.query(Stock).filter(Stock.is_active == True).count() == 3  # noqa: E712

    refresh_universe(db, _Screener([_row("AAA")]))  # truncated response

    assert db.query(Stock).count() == 3
    assert db.query(Stock).filter(Stock.is_active == True).count() == 3  # noqa: E712


def test_an_empty_screener_response_is_a_no_op(db):
    """FMPClient swallows a non-2xx into []; that must not wipe the universe."""
    refresh_universe(db, _Screener([_row("AAA"), _row("BBB")]))
    assert refresh_universe(db, _Screener([])) == 0
    assert db.query(Stock).count() == 2


def test_refresh_universe_reruns_update_in_place(db):
    """Re-running the job must not duplicate rows."""
    refresh_universe(db, _Screener([_row("AAA", cap=1e9, price=50.0)]))
    refresh_universe(db, _Screener([_row("AAA", cap=2e9, price=60.0)]))

    rows = db.query(Stock).all()
    assert len(rows) == 1
    assert rows[0].market_cap == 2e9
    assert rows[0].last_price == 60.0


def test_score_universe_rerun_in_one_day_updates_in_place(db):
    """Two scoring runs on one date must leave exactly one row per ticker.

    The (ticker, as_of) unique index makes a blind insert an IntegrityError,
    and before the index existed a duplicate row made load_latest_scores treat
    today as its own "prior", disabling the rating-drop exits.
    """
    for ticker, pe in (("AAA", 10.0), ("BBB", 20.0), ("CCC", 30.0)):
        _stock(db, ticker)
        db.add(
            Fundamentals(
                ticker=ticker,
                as_of=TODAY,
                data=_full_fundamentals(priceToEarningsRatioTTM=pe),
            )
        )
        _momentum_bars(db, ticker, 100.0 + pe)
    db.commit()

    first = score_universe(db)
    second = score_universe(db)

    assert first == second == 3
    assert db.query(CompositeScore).filter(CompositeScore.as_of == TODAY).count() == 3


def test_score_universe_with_nothing_to_score_leaves_prior_rows_alone(db):
    """`considered == 0` must return before the existing_today sweep.

    Otherwise an upstream outage that empties the universe would also delete
    today's already-written scores, and load_latest_scores keys on max(as_of) —
    the whole book would go unrated and unsellable off the back of one bad
    screener call.
    """
    db.add(
        CompositeScore(ticker="AAA", as_of=TODAY, quant_rating=4.5, sector="Technology")
    )
    db.commit()

    assert score_universe(db) == 0
    assert db.query(CompositeScore).count() == 1


def test_a_backfilled_eod_bar_never_overwrites_a_live_mark(db):
    """refresh_marks writes today's quote; the history backfill must not undo it.

    bulk_insert_price_bars uses ON CONFLICT DO NOTHING rather than DO UPDATE
    precisely so a re-run of the price backfill cannot replace a live mark with
    a stale EOD close (and so a killed backfill can simply be re-run).
    """
    upsert_price_bar(db, "AAA", TODAY, 123.0)
    db.commit()

    bulk_insert_price_bars(db, [{"ticker": "AAA", "date": TODAY, "close": 99.0}])

    bars = db.query(PriceBar).filter(PriceBar.ticker == "AAA").all()
    assert len(bars) == 1
    assert bars[0].close == 123.0


# ---------------------------------------------------------------------------
# FMP field-name guards — a rename here silently nulls a factor
# ---------------------------------------------------------------------------


def test_valuation_falls_back_to_the_legacy_field_name(db):
    """Snapshots written under either FMP shape must still produce a valuation.

    /stable renamed peRatioTTM -> priceToEarningsRatioTTM,
    pegRatioTTM -> priceToEarningsGrowthRatioTTM and
    enterpriseValueOverEBITDATTM -> evToEBITDATTM. The alias tuples in
    VALUATION_KEYS collapse both names into ONE percentile column; listing them
    as separate metrics would rank two disjoint populations and average across
    them. A ticker holding only legacy names must score, not silently drop to a
    null valuation factor — which, at min_factor_coverage 1.0, drops it outright.
    """
    legacy = _full_fundamentals()
    legacy["peRatioTTM"] = legacy.pop("priceToEarningsRatioTTM")
    legacy["enterpriseValueOverEBITDATTM"] = legacy.pop("evToEBITDATTM")
    legacy["pegRatioTTM"] = legacy.pop("priceToEarningsGrowthRatioTTM")

    for ticker, data in (
        ("OLD", legacy),
        ("NEW", _full_fundamentals()),
        ("MID", _full_fundamentals()),
    ):
        _stock(db, ticker)
        db.add(Fundamentals(ticker=ticker, as_of=TODAY, data=data))
        _momentum_bars(db, ticker, 150.0)
    db.commit()

    scored, _missing, _considered = compute_scores(db, RUN118_PARAMS, TODAY)
    by_ticker = {s.ticker: s for s in scored}

    assert set(by_ticker) == {"OLD", "NEW", "MID"}
    assert by_ticker["OLD"].factor_pcts["valuation"] is not None


def test_an_unknown_valuation_field_name_makes_the_ticker_unscoreable(db):
    """The canary for a missed FMP rename.

    If FMP renames a valuation metric and the alias tuple is not updated, every
    value resolves to None. At min_factor_coverage 1.0 that is at least LOUD —
    the ticker is not scored at all and score_universe logs the missing-factor
    breakdown. This test pins that loudness: if the coverage floor is lowered or
    the factor is made to degrade gracefully, a universe-wide rename becomes
    silent instead, and the model is re-weighted with no error anywhere.
    """
    renamed = _full_fundamentals()
    for key in (
        "priceToEarningsRatioTTM",
        "priceToEarningsGrowthRatioTTM",
        "evToEBITDATTM",
        "priceToBookRatioTTM",
        "priceToSalesRatioTTM",
    ):
        renamed[f"{key}V2"] = renamed.pop(key)

    _stock(db, "RENAMED")
    db.add(Fundamentals(ticker="RENAMED", as_of=TODAY, data=renamed))
    _momentum_bars(db, "RENAMED", 150.0)
    db.commit()

    scored, missing, considered = compute_scores(db, RUN118_PARAMS, TODAY)

    assert considered == 1
    assert scored == []
    assert missing["valuation"] == 1


def test_forward_estimate_reads_the_stable_field_names():
    """/stable dropped the `estimated` prefix: estimatedEpsAvg -> epsAvg.

    Reading only the legacy names would leave epsEstimateAvg None, which makes
    compute_estimate_revisions return {} for every ticker forever — and
    revisions carries weight 0.30 and gates every buy via min_revisions_grade.
    """
    picked = _forward_estimate(
        [{"date": "2099-12-31", "epsAvg": 2.0, "revenueAvg": 200.0}], TODAY
    )
    assert picked["epsEstimateAvg"] == 2.0
    assert picked["revenueEstimateAvg"] == 200.0


def test_forward_estimate_still_reads_the_legacy_field_names():
    """Stored snapshots taken under the v3 shape must stay comparable."""
    picked = _forward_estimate(
        [{"date": "2099-12-31", "estimatedEpsAvg": 3.0, "estimatedRevenueAvg": 300.0}],
        TODAY,
    )
    assert picked["epsEstimateAvg"] == 3.0
    assert picked["revenueEstimateAvg"] == 300.0


def test_ttm_growth_reads_the_income_statement_field_names():
    """revenue / netIncome / weightedAverageShsOutDil on /stable income-statement.

    Growth carries weight 0.35 and, under min_factor_coverage 1.0, a null
    growth value makes the ticker unscoreable outright. A rename of any of
    these three silently empties the factor for the whole universe.
    """
    out = compute_ttm_growth(_quarters(growth=1.2))

    assert out["revenueGrowthTTM"] == pytest.approx(0.2)
    assert out["netIncomeGrowthTTM"] == pytest.approx(0.2)
    assert out["epsGrowthTTM"] == pytest.approx(0.2)
    assert out["growthBasisPeriod"] == "2026-06-30"


def test_ttm_growth_needs_eight_full_quarters():
    """A truncated income-statement list must yield no growth, not a short one.

    FMP answers 200 with fewer rows for recent IPOs and occasionally under
    load. Comparing three quarters against four would be percentile-ranked
    against real TTM figures; refusing makes the ticker unscoreable, which the
    coverage-floor warning reports.
    """
    assert compute_ttm_growth(_quarters(n=7)) == {}
    assert compute_ttm_growth([]) == {}


def test_ttm_growth_drops_a_metric_when_one_quarter_omits_the_field():
    """A single missing `netIncome` must not be summed as zero.

    _sum_field returns None the moment any quarter lacks the field, so
    netIncomeGrowthTTM and epsGrowthTTM are omitted rather than computed off an
    understated four-quarter total. Revenue, which is complete, still computes.
    """
    rows = _quarters(growth=1.2)
    del rows[1]["netIncome"]

    out = compute_ttm_growth(rows)

    assert out["revenueGrowthTTM"] == pytest.approx(0.2)
    assert "netIncomeGrowthTTM" not in out
    assert "epsGrowthTTM" not in out


def test_refresh_marks_reads_the_quote_price_field(db):
    """`price`, with `previousClose` as the after-hours fallback.

    A rename here is total: every position mark, every PriceBar and every
    equity-curve point stops updating while the job still reports success.
    """

    class QuoteFMP:
        def batch_quotes(self, tickers):
            return [
                {"symbol": "AAA", "price": 11.0},
                {"symbol": "BBB", "previousClose": 22.0},  # no live price
                {"symbol": "CCC", "lastPrice": 33.0},  # neither field
            ]

    for t in ("AAA", "BBB", "CCC"):
        _stock(db, t)
        db.add(
            CompositeScore(ticker=t, as_of=TODAY, quant_rating=4.0, sector="Technology")
        )
    db.commit()

    refresh_marks(db, QuoteFMP())

    assert db.get(Stock, "AAA").last_price == 11.0
    assert db.get(Stock, "BBB").last_price == 22.0
    assert db.get(Stock, "CCC").last_price is None
