"""Worker ingest / scoring regressions."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.db.models import CompositeScore, Fundamentals, PriceBar, Stock
from app.services.portfolio import load_latest_scores
from worker.services.ingest import (
    _forward_estimate,
    compute_estimate_revisions,
    refresh_marks,
    upsert_price_bar,
)


class FakeFMP:
    """Minimal stand-in for FMPClient."""

    def __init__(self, prices: dict[str, float]):
        self.prices = prices
        self.calls = 0

    def batch_quotes(self, tickers):
        self.calls += 1
        return [
            {"symbol": t, "price": self.prices[t]} for t in tickers if t in self.prices
        ]


# ---------------------------------------------------------------------------
# Bug 2: refresh_marks crashed on a second run in the same day
# ---------------------------------------------------------------------------


def test_upsert_price_bar_updates_instead_of_duplicating(db):
    today = date(2026, 7, 24)
    upsert_price_bar(db, "AAA", today, 10.0)
    db.commit()
    upsert_price_bar(db, "AAA", today, 12.5)
    db.commit()

    bars = db.query(PriceBar).filter(PriceBar.ticker == "AAA").all()
    assert len(bars) == 1
    assert bars[0].close == 12.5


def test_upsert_price_bar_keeps_separate_days(db):
    upsert_price_bar(db, "AAA", date(2026, 7, 23), 10.0)
    upsert_price_bar(db, "AAA", date(2026, 7, 24), 11.0)
    db.commit()
    assert db.query(PriceBar).filter(PriceBar.ticker == "AAA").count() == 2


def test_refresh_marks_twice_in_one_day_does_not_crash(db):
    """The 1st and 3rd Friday of every month: biweekly marks at 11:00 and daily
    marks again at 18:30. This used to raise IntegrityError on the second run.
    """
    db.add(Stock(ticker="AAA", last_price=10.0, sector="Technology"))
    db.add(Stock(ticker="SPY", last_price=500.0))
    db.commit()
    _score(db, "AAA", date(2026, 7, 24), 4.5)  # makes AAA a marked candidate

    fmp = FakeFMP({"AAA": 11.0, "SPY": 505.0})
    assert refresh_marks(db, fmp) == 2
    assert refresh_marks(db, fmp) == 2  # second run in the same day

    bars = db.query(PriceBar).filter(PriceBar.ticker == "AAA").all()
    assert len(bars) == 1
    assert bars[0].close == 11.0


# ---------------------------------------------------------------------------
# Bug 4: load_latest_scores mis-inferred "prior"
# ---------------------------------------------------------------------------


def _score(db, ticker, as_of, qr):
    row = CompositeScore(
        ticker=ticker,
        as_of=as_of,
        quant_rating=qr,
        valuation_grade="B",
        growth_grade="B",
        profitability_grade="B",
        momentum_grade="B",
        revisions_grade="B+",
        sector="Technology",
    )
    db.add(row)
    db.commit()
    return row


def test_prior_rating_comes_from_the_previous_scoring_date(db):
    _score(db, "AAA", date(2026, 6, 1), 4.5)
    _score(db, "AAA", date(2026, 7, 1), 2.0)

    scores = load_latest_scores(db)
    assert scores["AAA"].quant_rating == 2.0
    assert scores["AAA"].prior_quant_rating == 4.5


def test_prior_rating_is_none_on_the_first_scoring_date(db):
    _score(db, "AAA", date(2026, 7, 1), 4.5)
    scores = load_latest_scores(db)
    assert scores["AAA"].prior_quant_rating is None


def test_prior_rating_ignores_older_periods(db):
    _score(db, "AAA", date(2026, 5, 1), 1.0)
    _score(db, "AAA", date(2026, 6, 1), 4.5)
    _score(db, "AAA", date(2026, 7, 1), 2.0)

    scores = load_latest_scores(db)
    assert scores["AAA"].prior_quant_rating == 4.5


def test_prior_rating_skips_intervening_daily_runs(db):
    """"Prior" is a fixed span back, not "the run before this one".

    The universe is scored every trading day. Taking the second-most-recent
    as_of would make the QR velocity rule compare today against YESTERDAY — a
    one-day drop of a full rating point is close to unheard of, so the rule
    would stop firing without anyone having changed it.
    """
    _score(db, "AAA", date(2026, 7, 19), 4.5)
    _score(db, "AAA", date(2026, 7, 26), 4.4)  # yesterday's run
    _score(db, "AAA", date(2026, 7, 27), 2.0)

    scores = load_latest_scores(db)
    assert scores["AAA"].quant_rating == 2.0
    assert scores["AAA"].prior_quant_rating == 4.5


def test_prior_rating_includes_the_window_boundary(db):
    _score(db, "AAA", date(2026, 7, 20), 3.9)  # exactly the lookback back
    _score(db, "AAA", date(2026, 7, 27), 2.0)

    scores = load_latest_scores(db)
    assert scores["AAA"].prior_quant_rating == 3.9


def test_prior_rating_abstains_when_history_is_shorter_than_the_window(db):
    """Falling back to the nearest available date would compare over a window
    shorter than the rule means, so the velocity exit must simply not fire.
    """
    _score(db, "AAA", date(2026, 7, 25), 4.5)
    _score(db, "AAA", date(2026, 7, 27), 2.0)

    scores = load_latest_scores(db)
    assert scores["AAA"].quant_rating == 2.0
    assert scores["AAA"].prior_quant_rating is None


def test_same_day_rescore_does_not_become_its_own_prior(db):
    """Two scoring runs in one day used to make prior == today, which silently
    disabled the rating-drop exits.
    """
    _score(db, "AAA", date(2026, 6, 1), 4.5)
    row = _score(db, "AAA", date(2026, 7, 1), 2.0)
    row.quant_rating = 2.2  # a same-day re-score updates in place
    db.commit()

    scores = load_latest_scores(db)
    assert scores["AAA"].quant_rating == 2.2
    assert scores["AAA"].prior_quant_rating == 4.5


def test_composite_scores_unique_per_ticker_and_date(db):
    from sqlalchemy.exc import IntegrityError

    _score(db, "AAA", date(2026, 7, 1), 4.5)
    with pytest.raises(IntegrityError):
        _score(db, "AAA", date(2026, 7, 1), 3.0)
    db.rollback()


# ---------------------------------------------------------------------------
# Bug 5: revisions must measure change, not level
# ---------------------------------------------------------------------------


def test_forward_estimate_picks_the_next_fiscal_period():
    estimates = [
        {"date": "2025-12-31", "estimatedEpsAvg": 1.0, "estimatedRevenueAvg": 100.0},
        {"date": "2027-12-31", "estimatedEpsAvg": 3.0, "estimatedRevenueAvg": 300.0},
        {"date": "2026-12-31", "estimatedEpsAvg": 2.0, "estimatedRevenueAvg": 200.0},
    ]
    picked = _forward_estimate(estimates, date(2026, 7, 24))
    assert picked["estimatePeriod"] == "2026-12-31"
    assert picked["epsEstimateAvg"] == 2.0


def test_forward_estimate_handles_empty_and_malformed():
    assert _forward_estimate([], date(2026, 7, 24)) is None
    assert _forward_estimate([{"estimatedEpsAvg": 1.0}], date(2026, 7, 24)) is None


def _store(db, ticker, as_of, period, eps, revenue):
    db.add(
        Fundamentals(
            ticker=ticker,
            as_of=as_of,
            data={
                "estimatePeriod": period,
                "epsEstimateAvg": eps,
                "revenueEstimateAvg": revenue,
            },
        )
    )
    db.commit()


def test_revision_is_the_change_in_consensus_not_the_level(db):
    today = date(2026, 7, 24)
    _store(db, "AAA", today - timedelta(days=30), "2026-12-31", 2.00, 1000.0)

    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.20,
        "revenueEstimateAvg": 1100.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.10)
    assert out["revenueRevisionPct"] == pytest.approx(0.10)
    assert out["revisionLookbackDays"] == 30

    # A much larger company with an identical +10% revision scores identically,
    # which is the whole point — level is not a revision.
    big = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 22.0,
        "revenueEstimateAvg": 11_000.0,
    }
    _store(db, "BBB", today - timedelta(days=30), "2026-12-31", 20.0, 10_000.0)
    assert compute_estimate_revisions(db, "BBB", big, today)["epsRevisionPct"] == (
        pytest.approx(0.10)
    )


def test_downward_revision_is_negative(db):
    today = date(2026, 7, 24)
    _store(db, "AAA", today - timedelta(days=30), "2026-12-31", 2.00, 1000.0)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 1.60,
        "revenueEstimateAvg": 900.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(-0.20)


def test_narrowing_loss_is_an_upward_revision(db):
    today = date(2026, 7, 24)
    _store(db, "AAA", today - timedelta(days=30), "2026-12-31", -2.00, 1000.0)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": -1.00,
        "revenueEstimateAvg": 1000.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.5)


def test_no_revision_without_history_or_across_period_rollover(db):
    today = date(2026, 7, 24)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.20,
        "revenueEstimateAvg": 1100.0,
    }
    # No prior snapshot at all.
    assert compute_estimate_revisions(db, "AAA", current, today) == {}

    # Prior snapshot exists but for a different fiscal period.
    _store(db, "AAA", today - timedelta(days=30), "2025-12-31", 1.80, 900.0)
    assert compute_estimate_revisions(db, "AAA", current, today) == {}


def test_revision_falls_back_to_oldest_snapshot_when_history_is_young(db):
    today = date(2026, 7, 24)
    # Only 7 days of history, shorter than REVISION_LOOKBACK_DAYS.
    _store(db, "AAA", today - timedelta(days=7), "2026-12-31", 2.00, 1000.0)
    current = {
        "estimatePeriod": "2026-12-31",
        "epsEstimateAvg": 2.10,
        "revenueEstimateAvg": 1000.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.05)
    assert out["revisionLookbackDays"] == 7


# ---------------------------------------------------------------------------
# Manually entered positions have no Stock row
# ---------------------------------------------------------------------------


def test_refresh_marks_prices_a_position_with_no_stock_row(db, portfolio):
    """Hand-entered positions never pass through refresh_universe.

    refresh_marks used to write the price only when a Stock row already
    existed, so a manually entered book stayed marked at its entry price
    forever — every holding showed 0.00% P&L and the equity curve was flat,
    while the job still reported a successful run.
    """
    from app.db.models import Position

    db.add(
        Position(
            portfolio_id=portfolio.id,
            ticker="ZZZ",
            shares=10.0,
            avg_cost=100.0,
            current_price=100.0,
            initial_investment=1000.0,
        )
    )
    db.commit()
    assert db.get(Stock, "ZZZ") is None

    refresh_marks(db, FakeFMP({"ZZZ": 150.0, "SPY": 500.0}))

    pos = db.query(Position).filter(Position.ticker == "ZZZ").one()
    assert pos.current_price == 150.0
    assert pos.market_value == 1500.0
    # And the Stock row is created so later runs have somewhere to write.
    assert db.get(Stock, "ZZZ").last_price == 150.0


def test_revisions_need_a_meaningful_window(db):
    """A one-day comparison must yield no revision, not a fabricated 0.0%."""
    from datetime import date, timedelta

    from app.db.models import Fundamentals
    from worker.services.ingest import compute_estimate_revisions

    today = date.today()
    current = {"estimatePeriod": "2026-12-31", "epsEstimateAvg": 2.10,
               "revenueEstimateAvg": 1000.0}

    db.add(Fundamentals(ticker="AAA", as_of=today - timedelta(days=1),
                        data={**current, "epsEstimateAvg": 2.00}))
    db.commit()
    assert compute_estimate_revisions(db, "AAA", current, today) == {}

    # Same data, a window long enough to mean something.
    db.query(Fundamentals).delete()
    db.add(Fundamentals(ticker="AAA", as_of=today - timedelta(days=7),
                        data={**current, "epsEstimateAvg": 2.00}))
    db.commit()
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.05)
    assert out["revisionLookbackDays"] == 7


def test_refresh_marks_backfills_market_cap_so_held_names_can_be_scored(db):
    """A hand-entered position was invisible to the scorer, forever.

    compute_scores filters on `Stock.market_cap >= min_universe_market_cap`.
    NULL fails that comparison in SQL, so a Stock row created by refresh_marks
    (which never set market_cap) was not scored, not rated on the dashboard,
    and — because _removal_signals skips holdings with no score — not eligible
    for any exit rule either.
    """
    from app.db.models import Portfolio, Position

    db.add(Portfolio(id=1, name="Test", cash=1000.0))
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.commit()

    class CapFMP:
        def batch_quotes(self, tickers):
            return [
                {"symbol": t, "price": 11.0, "marketCap": 4_200_000_000}
                for t in tickers
            ]

    refresh_marks(db, CapFMP())

    stock = db.get(Stock, "AAA")
    assert stock is not None
    assert stock.market_cap == 4_200_000_000


def test_refresh_marks_leaves_a_known_market_cap_alone(db):
    """The screener is authoritative; marks must not overwrite it."""
    from app.db.models import Portfolio, Position

    db.add(Portfolio(id=1, name="Test", cash=1000.0))
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.add(Stock(ticker="AAA", is_active=True, market_cap=9_000_000_000))
    db.commit()

    class CapFMP:
        def batch_quotes(self, tickers):
            return [{"symbol": t, "price": 11.0, "marketCap": 1} for t in tickers]

    refresh_marks(db, CapFMP())
    assert db.get(Stock, "AAA").market_cap == 9_000_000_000
