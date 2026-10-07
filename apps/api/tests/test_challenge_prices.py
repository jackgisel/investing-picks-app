"""Beat the S&P challenge prices: basis choice, appends, and restatements."""

from __future__ import annotations

from datetime import date, datetime, timezone

import pytest

from app.db.models import ChallengeEntry, ChallengePick, ChallengePrice, ChallengePriceCheck
from worker.services import challenge_prices as cp
from worker.services.fmp import FMPAccessError

TODAY = date(2026, 10, 7)
CUTOFF = date(2026, 10, 8)
NOW = datetime(2026, 10, 7, 23, 0, tzinfo=timezone.utc)
EARLIER = datetime(2026, 10, 2, 23, 0, tzinfo=timezone.utc)


def _entry_tables(db):
    """The schema already has them; kept so each test reads as a setup step."""


def _enter(db, entry_id, submitted_on, tickers):
    db.add(
        ChallengeEntry(
            id=entry_id,
            user_id=f"u-{entry_id}",
            display_name="Tester",
            cohort="2026-Q4",
            submitted_at=datetime(2026, 10, 1, tzinfo=timezone.utc),
            submitted_on=submitted_on,
        )
    )
    db.add_all(ChallengePick(entry_id=entry_id, ticker=t) for t in tickers)
    db.commit()


def _rows(closes: dict[str, float], field="adjClose"):
    return [{"date": d, field: c, "close": c * 2} for d, c in closes.items()]


class FakeFMP:
    def __init__(self, series, dividend_adjusted=True):
        self.series = series
        self.dividend_adjusted = dividend_adjusted
        self.calls: list[tuple[str, str]] = []

    def dividend_adjusted_series(self, ticker, from_date=None):
        self.calls.append(("div", ticker))
        if not self.dividend_adjusted:
            raise FMPAccessError("402")
        return _rows(self.series.get(ticker, {}))

    def historical_price_series(self, ticker, from_date=None):
        self.calls.append(("full", ticker))
        return [{"date": d, "close": c} for d, c in self.series.get(ticker, {}).items()]


def _stored(db, ticker):
    return {
        d.isoformat(): c
        for d, c in db.query(ChallengePrice.date, ChallengePrice.close)
        .filter(ChallengePrice.ticker == ticker)
        .order_by(ChallengePrice.date)
        .all()
    }


def test_skips_when_nobody_has_entered(db):
    _entry_tables(db)
    assert cp.challenge_prices(db, FakeFMP({}), today=TODAY) == {"skipped": "no entries"}


def test_fetches_each_pick_and_the_benchmark_on_one_basis(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA", "BBB"])
    fmp = FakeFMP(
        {
            "SPY": {"2026-10-02": 500.0, "2026-10-05": 505.0},
            "AAA": {"2026-10-02": 10.0, "2026-10-05": 11.0},
            "BBB": {"2026-10-02": 20.0},
        }
    )
    out = cp.challenge_prices(db, fmp, today=TODAY, cutoff=CUTOFF, now=NOW)
    assert out["basis"] == "total_return"
    assert out["tickers"] == 3
    assert fmp.calls[0] == ("div", "SPY")
    assert all(kind == "div" for kind, _ in fmp.calls)
    assert _stored(db, "AAA") == {"2026-10-02": 10.0, "2026-10-05": 11.0}
    assert db.get(ChallengePriceCheck, "BBB").basis == "total_return"


def test_falls_back_to_price_for_everything_when_dividends_are_off_plan(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA"])
    fmp = FakeFMP(
        {"SPY": {"2026-10-02": 500.0}, "AAA": {"2026-10-02": 10.0}},
        dividend_adjusted=False,
    )
    out = cp.challenge_prices(db, fmp, today=TODAY, cutoff=CUTOFF, now=NOW)
    assert out["basis"] == "price"
    assert ("full", "AAA") in fmp.calls
    assert ("div", "AAA") not in fmp.calls
    assert _stored(db, "AAA") == {"2026-10-02": 10.0}


def test_appends_new_days_without_touching_old_ones(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA"])
    series = {"SPY": {"2026-10-02": 500.0}, "AAA": {"2026-10-02": 10.0}}
    cp.challenge_prices(db, FakeFMP(series), today=date(2026, 10, 2), cutoff=date(2026, 10, 3), now=EARLIER)
    series["AAA"]["2026-10-05"] = 12.0
    series["SPY"]["2026-10-05"] = 501.0
    out = cp.challenge_prices(db, FakeFMP(series), today=TODAY, cutoff=CUTOFF, now=NOW)
    assert out["replaced"] == 0
    assert _stored(db, "AAA") == {"2026-10-02": 10.0, "2026-10-05": 12.0}
    assert db.get(ChallengePriceCheck, "AAA").replaced is False


def test_a_restated_history_replaces_the_whole_series(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA"])
    cp.challenge_prices(
        db,
        FakeFMP({"SPY": {"2026-10-02": 500.0}, "AAA": {"2026-10-02": 10.0}}),
        today=date(2026, 10, 2),
        cutoff=date(2026, 10, 3),
        now=EARLIER,
    )
    # A 2-for-1 split: the vendor halves every earlier close.
    restated = {"SPY": {"2026-10-02": 500.0, "2026-10-05": 502.0}, "AAA": {"2026-10-02": 5.0, "2026-10-05": 5.5}}
    out = cp.challenge_prices(db, FakeFMP(restated), today=TODAY, cutoff=CUTOFF, now=NOW)
    assert out["replaced"] == 1
    assert _stored(db, "AAA") == {"2026-10-02": 5.0, "2026-10-05": 5.5}


def test_never_stores_a_bar_on_or_after_the_cutoff(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA"])
    fmp = FakeFMP(
        {
            "SPY": {"2026-10-02": 500.0, "2026-10-07": 510.0},
            "AAA": {"2026-10-02": 10.0, "2026-10-07": 10.5},
        }
    )
    cp.challenge_prices(db, fmp, today=TODAY, cutoff=TODAY, now=NOW)
    assert "2026-10-07" not in _stored(db, "AAA")
    assert "2026-10-07" not in _stored(db, "SPY")


def test_a_missing_benchmark_fails_loudly(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA"])
    with pytest.raises(RuntimeError):
        cp.challenge_prices(db, FakeFMP({"AAA": {"2026-10-02": 10.0}}), today=TODAY, cutoff=CUTOFF, now=NOW)


def test_a_rerun_the_same_day_skips_fresh_tickers(db):
    _entry_tables(db)
    _enter(db, "e1", date(2026, 10, 1), ["AAA"])
    series = {"SPY": {"2026-10-02": 500.0}, "AAA": {"2026-10-02": 10.0}}
    cp.challenge_prices(db, FakeFMP(series), today=TODAY, cutoff=CUTOFF, now=NOW)
    fmp = FakeFMP(series)
    out = cp.challenge_prices(db, fmp, today=TODAY, cutoff=CUTOFF, now=NOW)
    assert out["skipped_fresh"] == 1
    assert ("div", "AAA") not in fmp.calls
