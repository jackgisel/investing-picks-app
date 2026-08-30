"""Worker ingest / scoring regressions."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import CompositeScore, Fundamentals, Position, PriceBar, Stock, StockNews
from app.services.portfolio import load_latest_scores
from conftest import make_position
from worker.services.ingest import (
    NEWS_RETENTION_DAYS,
    _forward_estimate,
    _latest_reported_earnings,
    _parse_fmp_news_date,
    backfill_holding_earnings,
    compute_estimate_revisions,
    news_universe_tickers,
    periods_match,
    recompute_latest_revisions,
    refresh_marks,
    refresh_news,
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


def test_refresh_marks_quotes_every_comparison_etf(db):
    """MAGS/VTI were snapshot-backfill only, so Mag 7 froze mid-chart."""
    from app.services.benchmarks import BENCHMARKS

    class RecordingFMP(FakeFMP):
        def __init__(self):
            super().__init__({t: 100.0 for t in BENCHMARKS})
            self.requested: list[str] = []

        def batch_quotes(self, tickers):
            self.requested = list(tickers)
            return super().batch_quotes(tickers)

    fmp = RecordingFMP()
    n = refresh_marks(db, fmp)

    assert set(BENCHMARKS).issubset(fmp.requested)
    assert n == len(BENCHMARKS)
    for ticker in BENCHMARKS:
        stock = db.get(Stock, ticker)
        assert stock is not None
        assert stock.is_etf is True
        assert db.query(PriceBar).filter(PriceBar.ticker == ticker).one().close == 100.0
    assert "VOO" in fmp.requested


def test_refresh_marks_marks_every_book(db):
    """A VOO lot on the DCA book used to stay stuck at its entry price."""
    from app.db.models import Portfolio
    from app.services.dca import KIND_DCA_VOO, ensure_dca_portfolios

    ensure_dca_portfolios(db)
    voo = db.query(Portfolio).filter(Portfolio.kind == KIND_DCA_VOO).one()
    db.add(
        Position(
            portfolio_id=voo.id,
            ticker="VOO",
            shares=2.0,
            avg_cost=500.0,
            current_price=500.0,
        )
    )
    db.commit()

    fmp = FakeFMP({"VOO": 510.0, "SPY": 500.0})
    refresh_marks(db, fmp)
    pos = (
        db.query(Position)
        .filter(Position.portfolio_id == voo.id, Position.ticker == "VOO")
        .one()
    )
    assert pos.current_price == 510.0


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


def test_latest_reported_earnings_ignores_upcoming_and_malformed_rows():
    reports = [
        {
            "date": "2026-08-15",
            "epsActual": None,
            "epsEstimated": 2.2,
            "revenueActual": None,
            "revenueEstimated": 1_200,
        },
        {"date": "not-a-date", "epsActual": 9.9},
        {
            "date": "2026-07-20",
            "epsActual": 2.4,
            "epsEstimated": 2.0,
            "revenueActual": 1_100,
            "revenueEstimated": 1_000,
        },
        {"date": "2026-04-20", "epsActual": 1.8, "epsEstimated": 1.7},
    ]
    assert _latest_reported_earnings(reports, date(2026, 7, 31)) == {
        "earningsReportDate": "2026-07-20",
        "epsActual": 2.4,
        "epsEstimated": 2.0,
        "revenueActual": 1_100,
        "revenueEstimated": 1_000,
    }


def test_latest_reported_earnings_requires_an_actual():
    assert _latest_reported_earnings(
        [{"date": "2026-07-20", "epsActual": None, "epsEstimated": 2.0}],
        date(2026, 7, 31),
    ) == {}


class FakeEarningsFMP:
    def __init__(self, reports):
        self.reports = reports
        self.calls = []

    def earnings(self, ticker):
        self.calls.append(ticker)
        return self.reports.get(ticker, [])


def test_backfill_holding_earnings_updates_latest_snapshot_only(db, portfolio):
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.add(
        Fundamentals(
            ticker="AAA",
            as_of=date(2026, 7, 1),
            data={"revenueGrowthTTM": 0.2},
        )
    )
    latest = Fundamentals(
        ticker="AAA",
        as_of=date(2026, 7, 31),
        data={"revenueGrowthTTM": 0.3},
    )
    db.add(latest)
    db.commit()
    fmp = FakeEarningsFMP(
        {
            "AAA": [
                {
                    "date": "2026-07-20",
                    "epsActual": 1.2,
                    "epsEstimated": 1.0,
                    "revenueActual": 120,
                    "revenueEstimated": 100,
                }
            ]
        }
    )

    result = backfill_holding_earnings(db, fmp, as_of=date(2026, 7, 31))

    assert result == {
        "holdings": 1,
        "updated": 1,
        "unchanged": 0,
        "missing_report": 0,
        "missing_snapshot": 0,
    }
    assert fmp.calls == ["AAA"]
    assert latest.data["epsActual"] == 1.2
    assert latest.data["revenueGrowthTTM"] == 0.3
    older = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == "AAA", Fundamentals.as_of == date(2026, 7, 1))
        .one()
    )
    assert "epsActual" not in older.data


def test_backfill_holding_earnings_is_idempotent(db, portfolio):
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.add(Fundamentals(ticker="AAA", as_of=date(2026, 7, 31), data={}))
    db.commit()
    fmp = FakeEarningsFMP(
        {"AAA": [{"date": "2026-07-20", "epsActual": 1.2, "epsEstimated": 1.0}]}
    )

    first = backfill_holding_earnings(db, fmp, as_of=date(2026, 7, 31))
    second = backfill_holding_earnings(db, fmp, as_of=date(2026, 7, 31))

    assert first["updated"] == 1
    assert second["updated"] == 0
    assert second["unchanged"] == 1


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


def test_year_end_date_jitter_is_not_a_period_rollover():
    assert periods_match("2027-07-03", "2027-07-03")
    assert periods_match("2027-07-03", "2027-06-27")
    assert not periods_match("2026-12-31", "2025-12-31")
    assert not periods_match("2027-07-03", None)


def test_revision_survives_fmp_year_end_date_restatement(db):
    """Western Digital 21 Aug 2026: same FY, year-end moved by six days."""
    today = date(2026, 8, 21)
    _store(db, "WDC", date(2026, 7, 31), "2027-06-27", 18.70, 1_000.0)
    current = {
        "estimatePeriod": "2027-07-03",
        "epsEstimateAvg": 20.21,
        "revenueEstimateAvg": 1_100.0,
    }
    out = compute_estimate_revisions(db, "WDC", current, today)
    assert out["epsRevisionPct"] == pytest.approx((20.21 - 18.70) / 18.70)
    assert out["revisionLookbackDays"] == 21
    assert out["revisionBasisDate"] == "2026-07-31"


def test_revision_uses_same_period_when_21_day_row_is_a_real_rollover(db):
    """A true next-year period must not block a later same-period pair."""
    today = date(2026, 8, 21)
    _store(db, "AAA", date(2026, 7, 31), "2026-12-31", 1.80, 900.0)
    _store(db, "AAA", date(2026, 8, 8), "2027-12-31", 2.00, 1000.0)
    current = {
        "estimatePeriod": "2027-12-31",
        "epsEstimateAvg": 2.20,
        "revenueEstimateAvg": 1100.0,
    }
    out = compute_estimate_revisions(db, "AAA", current, today)
    assert out["epsRevisionPct"] == pytest.approx(0.10)
    assert out["revisionLookbackDays"] == 13
    assert out["revisionBasisDate"] == "2026-08-08"


def test_recompute_latest_revisions_fills_nulls_left_by_the_old_lookup(db):
    today = date(2026, 8, 21)
    _store(db, "WDC", date(2026, 7, 31), "2027-06-27", 18.70, 1_000.0)
    db.add(
        Fundamentals(
            ticker="WDC",
            as_of=today,
            data={
                "estimatePeriod": "2027-07-03",
                "epsEstimateAvg": 20.21,
                "revenueEstimateAvg": 1_100.0,
                "epsRevisionPct": None,
                "revenueRevisionPct": None,
            },
        )
    )
    db.commit()

    patched = recompute_latest_revisions(db, today)
    assert patched == 1
    latest = (
        db.query(Fundamentals)
        .filter(Fundamentals.ticker == "WDC", Fundamentals.as_of == today)
        .one()
    )
    assert latest.data["epsRevisionPct"] == pytest.approx((20.21 - 18.70) / 18.70)
    assert latest.data["revisionLookbackDays"] == 21


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


def test_refresh_marks_resolves_a_missing_sector_so_a_holding_can_be_scored(db):
    """market_cap was only the first gate; sector is the second.

    compute_scores builds peer groups with `if s.ticker in funds and s.sector`,
    so a NULL sector drops the ticker before `considered` is incremented — it
    appears in no count and no log line. Backfilling market_cap alone (commit
    294252e) left hand-seeded holdings still unscoreable, still unrated, and
    still ineligible for every exit rule.
    """
    from app.db.models import Portfolio, Position

    db.add(Portfolio(id=1, name="Test", cash=1000.0))
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.commit()

    class ProfileFMP:
        def batch_quotes(self, tickers):
            return [{"symbol": t, "price": 11.0, "marketCap": 4e9} for t in tickers]

        def profile(self, ticker):
            return {"sector": "Technology", "industry": "Software",
                    "companyName": "Aaa Inc"}

    refresh_marks(db, ProfileFMP())

    stock = db.get(Stock, "AAA")
    assert stock.sector == "Technology"
    assert stock.market_cap == 4e9


def test_refresh_marks_does_not_refetch_a_profile_it_already_has(db):
    """One call per ticker missing a sector, not one per marks run."""
    from app.db.models import Portfolio, Position

    db.add(Portfolio(id=1, name="Test", cash=1000.0))
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.add(Stock(ticker="AAA", is_active=True, sector="Energy", market_cap=1e9))
    db.commit()

    calls: list[str] = []

    class CountingFMP:
        def batch_quotes(self, tickers):
            return [{"symbol": t, "price": 11.0} for t in tickers]

        def profile(self, ticker):
            calls.append(ticker)
            return {"sector": "Technology"}

    refresh_marks(db, CountingFMP())
    assert calls == []
    assert db.get(Stock, "AAA").sector == "Energy"


def test_refresh_marks_survives_a_failing_profile_lookup(db):
    """A marks run must not die because one profile call raised."""
    from app.db.models import Portfolio, Position

    db.add(Portfolio(id=1, name="Test", cash=1000.0))
    db.add(Position(portfolio_id=1, ticker="AAA", shares=10, avg_cost=5.0))
    db.commit()

    class AngryFMP:
        def batch_quotes(self, tickers):
            return [{"symbol": t, "price": 11.0} for t in tickers]

        def profile(self, ticker):
            raise RuntimeError("FMP is down")

    assert refresh_marks(db, AngryFMP()) >= 1
    assert db.get(Stock, "AAA").last_price == 11.0


def test_refresh_marks_backfills_a_short_comparison_etf(db):
    """QQQ had five daily marks and no history; Saturday's job was six days away."""
    from app.services.benchmarks import BENCHMARKS

    class HistoryFMP(FakeFMP):
        def __init__(self):
            super().__init__({t: 100.0 for t in BENCHMARKS})
            self.history_asked: list[str] = []

        def historical_prices(self, ticker, from_date=None):
            self.history_asked.append(ticker)
            start = from_date or (date.today() - timedelta(days=430))
            out = []
            day = start
            while day < date.today():
                if day.weekday() < 5:
                    out.append({"date": day.isoformat(), "close": 500.0})
                day += timedelta(days=1)
            return out

    fmp = HistoryFMP()
    refresh_marks(db, fmp)

    assert "QQQ" in fmp.history_asked
    qqq_bars = db.query(PriceBar).filter(PriceBar.ticker == "QQQ").count()
    assert qqq_bars > 50, "daily marks still left QQQ with only today's quote"


def test_refresh_marks_does_not_refetch_a_covered_benchmark(db):
    """A full QQQ series is the daily-marks job's to keep fresh, not to re-download."""
    from app.services.benchmarks import BENCHMARKS

    for i in range(200):
        db.add(
            PriceBar(
                ticker="QQQ",
                date=date.today() - timedelta(days=i + 1),
                close=500.0,
            )
        )
    db.commit()

    class HistoryFMP(FakeFMP):
        def __init__(self):
            super().__init__({t: 100.0 for t in BENCHMARKS})
            self.history_asked: list[str] = []

        def historical_prices(self, ticker, from_date=None):
            self.history_asked.append(ticker)
            return []

    fmp = HistoryFMP()
    refresh_marks(db, fmp)
    assert "QQQ" not in fmp.history_asked
    from worker.services.ingest import INGEST_ETFS

    assert set(fmp.history_asked) <= set(INGEST_ETFS)


def test_price_target_consensus_reads_common_aliases():
    from worker.services.ingest import _price_target_consensus

    assert _price_target_consensus(
        {
            "targetLow": 210,
            "targetConsensus": 230,
            "targetHigh": 250,
            "numberOfAnalysts": 18,
        }
    ) == {
        "priceTargetLow": 210,
        "priceTargetMean": 230,
        "priceTargetHigh": 250,
        "priceTargetAnalystCount": 18,
    }
    assert _price_target_consensus(None) == {}
    assert _price_target_consensus({"targetLow": 1}) == {"priceTargetLow": 1}


# ---------------------------------------------------------------------------
# News ingestion for the X spotlight thread's "news" focus
# ---------------------------------------------------------------------------


class FakeNewsFMP:
    """Stand-in for FMPClient.stock_news."""

    def __init__(self, rows):
        self.rows = rows
        self.requested_symbols = None

    def stock_news(self, symbols, limit=50):
        self.requested_symbols = list(symbols)
        return self.rows


def _news_row(**overrides):
    row = {
        "symbol": "AAA",
        "publishedDate": "2026-08-29 12:00:00",
        "publisher": "Wire Service",
        "title": "Headline",
        "url": "https://example.com/a",
    }
    row.update(overrides)
    return row


def test_parse_fmp_news_date_reads_fmp_format():
    parsed = _parse_fmp_news_date("2026-08-29 19:41:01")
    assert parsed == datetime(2026, 8, 29, 19, 41, 1, tzinfo=timezone.utc)


def test_parse_fmp_news_date_rejects_garbage():
    assert _parse_fmp_news_date(None) is None
    assert _parse_fmp_news_date("not a date") is None


def test_news_universe_includes_held_and_top_rated_non_held(db, portfolio):
    make_position(db, portfolio, "HELD", 10, 100.0, 100.0)
    _score(db, "HELD", date(2026, 8, 28), 4.0)
    _score(db, "BEST", date(2026, 8, 28), 4.8)
    _score(db, "WORST", date(2026, 8, 28), 1.0)

    tickers = news_universe_tickers(db, limit=1)

    # Held is always included regardless of the limit; the non-held slice is
    # capped at `limit` and takes the highest-rated names first.
    assert "HELD" in tickers
    assert "BEST" in tickers
    assert "WORST" not in tickers


def test_news_universe_falls_back_to_held_when_unscored(db, portfolio):
    make_position(db, portfolio, "HELD", 10, 100.0, 100.0)
    assert news_universe_tickers(db) == ["HELD"]


def test_refresh_news_inserts_and_dedupes_by_url(db):
    fmp = FakeNewsFMP([_news_row(), _news_row()])  # same url twice
    inserted = refresh_news(db, fmp, ["AAA"])
    assert inserted == 1
    assert db.query(StockNews).count() == 1

    # A second run against the same feed inserts nothing new.
    fmp2 = FakeNewsFMP([_news_row()])
    assert refresh_news(db, fmp2, ["AAA"]) == 0
    assert db.query(StockNews).count() == 1


def test_refresh_news_skips_rows_missing_required_fields(db):
    fmp = FakeNewsFMP(
        [
            _news_row(url=None),
            _news_row(title=None, url="https://example.com/b"),
            _news_row(publishedDate=None, url="https://example.com/c"),
        ]
    )
    assert refresh_news(db, fmp, ["AAA"]) == 0
    assert db.query(StockNews).count() == 0


def test_refresh_news_prunes_stale_rows(db):
    stale = StockNews(
        ticker="OLD",
        published_at=datetime.now(timezone.utc) - timedelta(days=NEWS_RETENTION_DAYS + 1),
        publisher="Wire Service",
        title="Old headline",
        url="https://example.com/old",
    )
    db.add(stale)
    db.commit()

    refresh_news(db, FakeNewsFMP([]), ["AAA"])

    assert db.query(StockNews).filter(StockNews.url == "https://example.com/old").count() == 0


def test_refresh_news_passes_requested_tickers_through(db):
    fmp = FakeNewsFMP([])
    refresh_news(db, fmp, ["AAA", "BBB"])
    assert fmp.requested_symbols == ["AAA", "BBB"]


def test_refresh_news_noop_for_empty_ticker_list(db):
    fmp = FakeNewsFMP([_news_row()])
    assert refresh_news(db, fmp, []) == 0
    assert fmp.requested_symbols is None


def test_refresh_news_filters_lawsuit_solicitations(db):
    """Confirmed live in production: a law-firm 'encourages investors to
    secure counsel' release for a tracked ticker rode the same feed as real
    reporting. The spotlight thread must never surface one of these."""
    fmp = FakeNewsFMP(
        [
            _news_row(
                url="https://example.com/lawsuit",
                title=(
                    "ROSEN, TOP-RANKED INVESTOR RIGHTS LAWYERS, Encourages "
                    "Example Corp Investors to Secure Counsel Before "
                    "Important Deadline in Securities Class Action"
                ),
            ),
            _news_row(url="https://example.com/real", title="Example Corp beats earnings"),
        ]
    )
    assert refresh_news(db, fmp, ["AAA"]) == 1
    titles = [row.title for row in db.query(StockNews).all()]
    assert titles == ["Example Corp beats earnings"]
