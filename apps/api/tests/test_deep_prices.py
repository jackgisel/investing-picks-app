"""Deep price history: one consistent series per name, in its own table.

Pinned: the live `price_bars` table is never touched; a refetch REPLACES a
name's rows (so a series never mixes price bases); a failed request records
nothing and is asked again, while an empty answer is recorded and retried
monthly; a recent IPO is not refetched on every run; a time budget leaves a
resumable remainder; and the factor study prefers this table when it has data.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import DeepPriceBar, DeepPriceCheck, PriceBar, Stock
from worker.services import deep_prices
from worker.services.deep_prices import coverage, deep_price_history, tickers_to_fetch
from worker.services.fmp import FMPAccessError

TODAY = date(2026, 10, 3)


def _rows(n=30, base=100.0, start=date(2024, 1, 2)):
    out, d, i = [], start, 0
    while len(out) < n:
        if d.weekday() < 5:
            out.append({"date": d.isoformat(), "adjClose": base + i, "close": base * 2 + i})
            i += 1
        d += timedelta(days=1)
    return out


class FakeFMP:
    def __init__(self, data=None, failing=(), denied=()):
        self.data = data or {}
        self.failing = set(failing)
        self.denied = set(denied)
        self.asked: list[str] = []

    def historical_price_series(self, ticker, from_date=None):
        self.asked.append(ticker)
        if ticker in self.denied:
            raise FMPAccessError("FMP historical-price-eod returned 403")
        if ticker in self.failing:
            return None
        return self.data.get(ticker, [])


@pytest.fixture()
def stocks(db):
    for t, cap in (("BIG", 9e9), ("MID", 5e9), ("SML", 1e9)):
        db.add(Stock(ticker=t, name=t, market_cap=cap, is_active=True, is_etf=False))
    db.commit()
    return ["BIG", "MID", "SML"]


def test_fetches_largest_first_and_stores_adjusted_closes(db, stocks):
    fmp = FakeFMP({"BIG": _rows(), "MID": _rows(base=50), "SML": _rows(base=10)})
    result = deep_price_history(db, fmp, today=TODAY)
    assert fmp.asked == ["BIG", "MID", "SML"]
    assert result["with_bars"] == 3 and result["bars"] == 90 and result["remaining"] == 0
    # adjClose wins, the same field order the live table uses.
    assert db.query(DeepPriceBar).filter_by(ticker="BIG").order_by(DeepPriceBar.date).first().close == 100.0
    assert db.get(DeepPriceCheck, "BIG").bars == 30


def test_never_touches_the_live_price_table(db, stocks):
    db.add(PriceBar(ticker="BIG", date=date(2026, 9, 30), close=123.0))
    db.commit()
    deep_price_history(db, FakeFMP({"BIG": _rows()}), today=TODAY)
    assert [(b.date, b.close) for b in db.query(PriceBar)] == [(date(2026, 9, 30), 123.0)]


def test_a_refetch_replaces_the_series_instead_of_mixing_bases(db, stocks):
    deep_price_history(db, FakeFMP({"BIG": _rows(base=100), "MID": _rows(), "SML": _rows()}), today=TODAY)
    db.query(DeepPriceCheck).update({"checked_at": datetime.now(timezone.utc) - timedelta(days=120)})
    db.commit()
    # A 2-for-1 split since: every bar is now half. Old bars must not survive.
    deep_price_history(db, FakeFMP({"BIG": _rows(base=50), "MID": _rows(), "SML": _rows()}), today=TODAY)
    closes = [b.close for b in db.query(DeepPriceBar).filter_by(ticker="BIG").order_by(DeepPriceBar.date)]
    assert len(closes) == 30 and closes[0] == 50.0


def test_recent_checks_are_skipped_but_old_or_empty_ones_come_back(db, stocks):
    now = datetime.now(timezone.utc)
    db.add(DeepPriceCheck(ticker="BIG", checked_at=now - timedelta(days=10), bars=1500))
    db.add(DeepPriceCheck(ticker="MID", checked_at=now - timedelta(days=100), bars=1500))
    db.add(DeepPriceCheck(ticker="SML", checked_at=now - timedelta(days=40), bars=0))
    db.commit()
    assert tickers_to_fetch(db) == ["MID", "SML"]


def test_a_recent_ipo_is_not_refetched_on_every_run(db, stocks):
    # Far fewer than five years of bars, but it was fetched: that is enough.
    deep_price_history(db, FakeFMP({"BIG": _rows(n=20), "MID": _rows(), "SML": _rows()}), today=TODAY)
    again = FakeFMP()
    deep_price_history(db, again, today=TODAY)
    assert again.asked == []


def test_a_failed_request_records_nothing_and_an_empty_answer_is_recorded(db, stocks):
    fmp = FakeFMP({"BIG": _rows()}, failing={"MID"})  # SML answers with no bars
    result = deep_price_history(db, fmp, today=TODAY)
    assert result["errors"] == 1 and result["empty"] == 1
    assert db.get(DeepPriceCheck, "MID") is None
    assert db.get(DeepPriceCheck, "SML").bars == 0
    assert tickers_to_fetch(db) == ["MID"]


def test_one_restricted_symbol_is_skipped_but_three_in_a_row_stop_the_run(db, stocks):
    ok = deep_price_history(db, FakeFMP({"BIG": _rows(), "SML": _rows()}, denied={"MID"}), today=TODAY)
    assert ok["with_bars"] == 2 and ok["errors"] == 1
    db.query(DeepPriceCheck).delete()
    db.commit()
    with pytest.raises(FMPAccessError):
        deep_price_history(db, FakeFMP(denied={"BIG", "MID", "SML"}), today=TODAY)


def test_budget_leaves_a_resumable_remainder(db, stocks):
    fmp = FakeFMP({t: _rows() for t in stocks})
    first = deep_price_history(db, fmp, today=TODAY, budget_seconds=-1)
    assert first["fetched"] == 0 and first["remaining"] == 3
    assert deep_price_history(db, fmp, today=TODAY)["fetched"] == 3


def test_a_run_with_no_bars_anywhere_raises(db, monkeypatch):
    many = [f"T{i:02d}" for i in range(30)]
    for t in many:
        db.add(Stock(ticker=t, name=t, is_active=True, is_etf=False))
    db.commit()
    with pytest.raises(RuntimeError, match="no bars"):
        deep_price_history(db, FakeFMP(), today=TODAY)


def test_coverage_reports_what_is_held(db, stocks):
    deep_price_history(db, FakeFMP({"BIG": _rows(), "MID": _rows()}), today=TODAY)
    out = coverage(db)
    assert out["tickers_with_bars"] == 2 and out["tickers_empty"] == 1
    assert out["bars"] == 60 and out["first_bar"] == "2024-01-02"


def test_the_study_prefers_the_deep_table_when_it_has_data(db):
    from worker.backtest import workforce_ic
    from worker.backtest.workforce_ic import compute_workforce_ic

    from tests.test_workforce_ic import _seed, N

    _seed(db)
    assert compute_workforce_ic(db, horizons=(21,))["price_source"] == "live"
    # Move the same series into the deep table and the study switches to it.
    rows = [{"ticker": b.ticker, "date": b.date, "close": b.close} for b in db.query(PriceBar)]
    db.bulk_insert_mappings(DeepPriceBar, rows)
    db.query(PriceBar).delete()
    db.commit()
    out = compute_workforce_ic(db, horizons=(21,))
    assert out["price_source"] == "deep"
    assert out["factors"]["leverage"]["21"]["ic"] > 0.6
    assert "deep history" in workforce_ic.render_markdown(out)
