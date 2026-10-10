"""Stock splits: positions, stored prices and the trade ledger stay on one basis."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import JobRun, PriceBar, SplitAdjustment, StockSplit, Trade
from app.services.benchmarks import open_lots, public_lots, picks_growth_index
from app.services.portfolio import exit_basis, split_ratios
from conftest import make_position
from worker.services.fmp import FMPAccessError
from worker.services.splits import (
    apply_position_splits,
    parse_split_rows,
    record_splits,
    restate_price_bars,
)

SPLIT = date(2026, 10, 5)  # a Monday
TODAY = SPLIT


class FakeFMP:
    def __init__(self, calendar=None, per_ticker=None, calendar_error=False):
        self.calendar = calendar
        self.per_ticker = per_ticker or {}
        self.calendar_error = calendar_error
        self.ticker_calls: list[str] = []

    def splits_calendar(self, start, end):
        if self.calendar_error:
            raise FMPAccessError("FMP splits-calendar returned 403")
        return self.calendar

    def stock_splits(self, ticker):
        self.ticker_calls.append(ticker)
        return self.per_ticker.get(ticker, [])


def _ts(d: date) -> datetime:
    return datetime(d.year, d.month, d.day, 15, tzinfo=timezone.utc)


def _buy(db, portfolio, ticker, shares, price, when, action="buy"):
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker=ticker,
            side="buy",
            shares=shares,
            price=price,
            notional=shares * price,
            action=action,
            timestamp=_ts(when),
        )
    )
    db.commit()


def _sell(db, portfolio, ticker, shares, price, when, action="full_sell"):
    t = Trade(
        portfolio_id=portfolio.id,
        ticker=ticker,
        side="sell",
        shares=shares,
        price=price,
        notional=shares * price,
        action=action,
        timestamp=_ts(when),
    )
    db.add(t)
    db.commit()
    return t


def _bars(db, ticker, closes: dict[date, float]):
    for d, c in closes.items():
        db.add(PriceBar(ticker=ticker, date=d, close=c))
    db.commit()


def _split(db, ticker="AAA", when=SPLIT, num=4.0, den=1.0):
    db.add(StockSplit(ticker=ticker, date=when, numerator=num, denominator=den))
    db.commit()


@pytest.fixture()
def held(db, portfolio):
    """10 AAA bought at $400 in September, marked at $400 before a 4-for-1."""
    _buy(db, portfolio, "AAA", 10, 400.0, date(2026, 9, 1))
    return make_position(
        db, portfolio, "AAA", 10, 400.0, 400.0, entry_date=date(2026, 9, 1)
    )


def test_parse_drops_malformed_and_one_for_one_rows():
    rows = [
        {"symbol": "aaa", "date": "2026-10-05", "numerator": 4, "denominator": 1},
        {"symbol": "BBB", "date": "2026-10-05", "numerator": 1, "denominator": 1},
        {"symbol": "CCC", "date": "2026-10-05", "numerator": 0, "denominator": 1},
        {"symbol": "DDD", "date": None, "numerator": 2, "denominator": 1},
        {"symbol": "EEE", "date": "2026-10-05", "numerator": 1, "denominator": 10},
    ]
    assert parse_split_rows(rows) == [
        ("AAA", SPLIT, 4.0, 1.0),
        ("EEE", SPLIT, 1.0, 10.0),
    ]


def test_record_splits_ignores_future_dates_and_dedupes(db, portfolio):
    fmp = FakeFMP(
        calendar=[
            {"symbol": "AAA", "date": "2026-10-05", "numerator": 4, "denominator": 1},
            {"symbol": "ZZZ", "date": "2026-10-20", "numerator": 2, "denominator": 1},
        ]
    )
    assert record_splits(db, fmp, TODAY)["added"] == 1
    assert record_splits(db, fmp, TODAY)["added"] == 0
    assert [(s.ticker, s.date) for s in db.query(StockSplit).all()] == [("AAA", SPLIT)]


def test_calendar_off_plan_falls_back_to_each_held_ticker(db, portfolio, held):
    fmp = FakeFMP(
        calendar_error=True,
        per_ticker={
            "AAA": [
                {"date": "2026-10-05", "numerator": 4, "denominator": 1},
                {"date": "2020-08-31", "numerator": 4, "denominator": 1},
            ]
        },
    )
    out = record_splits(db, fmp, TODAY)
    assert out["source"] == "per_ticker"
    assert fmp.ticker_calls == ["AAA"]
    # Only the recent one: the 2020 split is outside the window.
    assert [s.date for s in db.query(StockSplit).all()] == [SPLIT]


def test_a_forward_split_keeps_value_and_cost_basis(db, portfolio, held):
    _bars(db, "AAA", {date(2026, 10, 2): 400.0})
    _split(db)
    out = apply_position_splits(db, TODAY)

    db.refresh(held)
    assert held.shares == pytest.approx(40)
    assert held.avg_cost == pytest.approx(100)
    assert held.current_price == pytest.approx(100)
    assert held.cost_basis == pytest.approx(4000)
    assert held.market_value == pytest.approx(4000)
    assert len(out["applied"]) == 1 and out["open_reviews"] == []


def test_running_twice_does_not_split_twice(db, portfolio, held):
    _split(db)
    apply_position_splits(db, TODAY)
    apply_position_splits(db, TODAY + timedelta(days=1))
    db.refresh(held)
    assert held.shares == pytest.approx(40)
    assert db.query(SplitAdjustment).count() == 1


def test_a_reverse_split(db, portfolio):
    _buy(db, portfolio, "RRR", 100, 2.0, date(2026, 9, 1))
    pos = make_position(db, portfolio, "RRR", 100, 2.0, 1.5, entry_date=date(2026, 9, 1))
    _split(db, "RRR", num=1, den=10)
    apply_position_splits(db, TODAY)
    db.refresh(pos)
    assert pos.shares == pytest.approx(10)
    assert pos.avg_cost == pytest.approx(20)
    assert pos.current_price == pytest.approx(15)


def test_a_position_opened_after_the_split_is_left_alone(db, portfolio):
    _buy(db, portfolio, "AAA", 40, 100.0, SPLIT)
    pos = make_position(db, portfolio, "AAA", 40, 100.0, 100.0, entry_date=SPLIT)
    _split(db)
    out = apply_position_splits(db, TODAY)
    db.refresh(pos)
    assert pos.shares == 40
    assert out["applied"] == [] and out["review"] == []


def test_a_mark_already_post_split_is_not_divided_again(db, portfolio, held):
    _bars(db, "AAA", {date(2026, 10, 2): 400.0})
    held.current_price = 101.0  # a post-split quote landed first
    db.commit()
    _split(db)
    apply_position_splits(db, TODAY + timedelta(days=1))
    db.refresh(held)
    assert held.shares == pytest.approx(40)
    assert held.current_price == pytest.approx(101.0)


def test_a_buy_after_the_split_holds_it_for_review(db, portfolio, held):
    _buy(db, portfolio, "AAA", 4, 100.0, SPLIT + timedelta(days=1), action="double_buy")
    _split(db)
    out = apply_position_splits(db, SPLIT + timedelta(days=1))
    db.refresh(held)
    assert held.shares == 10  # untouched
    assert len(out["review"]) == 1 and len(out["open_reviews"]) == 1
    assert db.query(SplitAdjustment).one().status == "review"


def test_a_split_found_too_late_is_held_for_review(db, portfolio, held):
    _split(db)
    out = apply_position_splits(db, SPLIT + timedelta(days=10))
    db.refresh(held)
    assert held.shares == 10
    assert "late" in out["review"][0]


def test_every_book_is_adjusted(db, portfolio):
    from app.db.models import Portfolio

    dca = Portfolio(id=2, name="DCA picks", cash=0.0, kind="dca_picks")
    db.add(dca)
    db.commit()
    for book in (portfolio, dca):
        _buy(db, book, "AAA", 10, 400.0, date(2026, 9, 1))
        make_position(db, book, "AAA", 10, 400.0, 400.0, entry_date=date(2026, 9, 1))
    _split(db)
    apply_position_splits(db, TODAY)
    assert db.query(SplitAdjustment).filter_by(status="applied").count() == 2


# --- stored prices ----------------------------------------------------------


def test_price_bars_before_the_split_are_restated(db, portfolio):
    _bars(
        db,
        "AAA",
        {
            date(2026, 9, 30): 396.0,
            date(2026, 10, 1): 404.0,
            date(2026, 10, 2): 400.0,
            SPLIT: 101.0,
        },
    )
    _split(db)
    out = restate_price_bars(db, TODAY)
    closes = {b.date: b.close for b in db.query(PriceBar).filter_by(ticker="AAA")}
    assert closes[date(2026, 9, 30)] == pytest.approx(99.0)
    assert closes[date(2026, 10, 2)] == pytest.approx(100.0)
    assert closes[SPLIT] == pytest.approx(101.0)
    assert out["restated"]
    # Second run is a no-op.
    restate_price_bars(db, TODAY)
    assert db.query(PriceBar).filter_by(ticker="AAA", date=date(2026, 10, 2)).one().close == pytest.approx(100.0)


def test_already_adjusted_bars_are_left_alone(db, portfolio):
    _bars(db, "AAA", {date(2026, 10, 1): 99.0, date(2026, 10, 2): 100.0, SPLIT: 101.0})
    _split(db)
    restate_price_bars(db, TODAY)
    assert db.query(PriceBar).filter_by(ticker="AAA", date=date(2026, 10, 2)).one().close == 100.0
    assert db.query(StockSplit).one().prices_adjusted_at is not None


def test_a_top_up_that_moved_the_step_earlier_is_found(db, portfolio):
    # A weekly top-up after the split overwrote Oct 1-2 with adjusted closes,
    # so the old-basis bars end on Sep 30, not the day before the split.
    _bars(
        db,
        "AAA",
        {
            date(2026, 9, 29): 392.0,
            date(2026, 9, 30): 396.0,
            date(2026, 10, 1): 101.0,
            date(2026, 10, 2): 100.0,
            SPLIT: 101.0,
        },
    )
    _split(db)
    restate_price_bars(db, TODAY)
    closes = {b.date: b.close for b in db.query(PriceBar).filter_by(ticker="AAA")}
    assert closes[date(2026, 9, 29)] == pytest.approx(98.0)
    assert closes[date(2026, 9, 30)] == pytest.approx(99.0)
    assert closes[date(2026, 10, 1)] == pytest.approx(101.0)


def test_restatement_waits_for_a_post_split_bar(db, portfolio):
    _bars(db, "AAA", {date(2026, 10, 2): 400.0})
    _split(db)
    out = restate_price_bars(db, TODAY)
    assert out["waiting_for_post_split_bar"] == ["AAA"]
    assert db.query(StockSplit).one().prices_adjusted_at is None


# --- the trade ledger -------------------------------------------------------


def test_lot_returns_do_not_drop_by_the_split_ratio(db, portfolio, held):
    _split(db)
    apply_position_splits(db, TODAY)
    db.refresh(held)
    lots = public_lots(open_lots(db, portfolio.id).get("AAA"), 104.0)
    assert lots[0]["pnl_pct"] == pytest.approx(4.0)


def test_a_post_split_sale_closes_against_restated_cost(db, portfolio, held):
    _split(db)
    apply_position_splits(db, TODAY)
    sell = _sell(db, portfolio, "AAA", 40, 110.0, SPLIT + timedelta(days=3))
    trades = db.query(Trade).filter_by(portfolio_id=portfolio.id).all()
    basis = exit_basis(trades, split_ratios(db, portfolio.id))[sell.id]
    assert basis["avg_cost"] == pytest.approx(100.0)
    assert basis["closes_position"] is True


def test_a_pre_split_sale_keeps_its_own_price_terms(db, portfolio, held):
    sell = _sell(db, portfolio, "AAA", 5, 440.0, date(2026, 9, 20), action="trim")
    _split(db)
    apply_position_splits(db, TODAY)
    trades = db.query(Trade).filter_by(portfolio_id=portfolio.id).all()
    basis = exit_basis(trades, split_ratios(db, portfolio.id))[sell.id]
    assert basis["avg_cost"] == pytest.approx(400.0)


def test_the_growth_index_has_no_step_at_the_split(db, portfolio, held):
    _bars(
        db,
        "AAA",
        {
            date(2026, 9, 1): 100.0,  # price_bars are in today's (post-split) terms
            date(2026, 10, 2): 100.0,
            SPLIT: 100.0,
            date(2026, 10, 6): 100.0,
        },
    )
    _split(db)
    apply_position_splits(db, TODAY)
    _sell(db, portfolio, "AAA", 20, 100.0, date(2026, 10, 6), action="trim")
    rows = picks_growth_index(db, portfolio.id)
    assert rows and all(r["index"] == pytest.approx(1.0) for r in rows)


# --- the daily job ----------------------------------------------------------


def test_check_splits_holds_sells_and_alerts_on_review(db, portfolio, held):
    from worker.jobs.runner import SPLIT_REVIEW_JOB, check_splits

    _buy(db, portfolio, "AAA", 4, 100.0, SPLIT, action="double_buy")
    fmp = FakeFMP(
        calendar=[{"symbol": "AAA", "date": "2026-10-05", "numerator": 4, "denominator": 1}]
    )
    out = check_splits(db, fmp, TODAY)
    assert out["hold_sells"] is True
    assert db.query(JobRun).filter_by(job_name=SPLIT_REVIEW_JOB, status="error").count() == 1


def test_check_splits_holds_sells_when_fmp_fails(db, portfolio, held):
    from worker.jobs.runner import check_splits

    class Broken(FakeFMP):
        def splits_calendar(self, start, end):
            raise RuntimeError("boom")

    out = check_splits(db, Broken(), TODAY)
    assert out["hold_sells"] is True and out["error"]


def test_check_splits_clean_day_allows_sells(db, portfolio, held):
    from worker.jobs.runner import check_splits

    out = check_splits(db, FakeFMP(calendar=[]), TODAY)
    assert out["hold_sells"] is False


def test_a_pick_sold_before_a_later_split_has_no_fake_gain(db, portfolio):
    # Bought and sold in September, split in October. The split job restates
    # every ticker's bars, so the old trades must be restated too.
    _buy(db, portfolio, "OLD", 10, 400.0, date(2026, 9, 1))
    _sell(db, portfolio, "OLD", 10, 400.0, date(2026, 9, 15))
    _bars(
        db,
        "OLD",
        {date(2026, 9, 1): 100.0, date(2026, 9, 14): 100.0, date(2026, 9, 15): 100.0},
    )
    _split(db, "OLD")
    rows = picks_growth_index(db, portfolio.id)
    assert rows and all(r["index"] == pytest.approx(1.0) for r in rows)


def test_a_review_blocks_every_executed_evaluation(db, portfolio, held):
    from app.services.portfolio import SplitReviewPending, run_evaluation

    _buy(db, portfolio, "AAA", 4, 100.0, SPLIT, action="double_buy")
    _split(db)
    apply_position_splits(db, TODAY)
    with pytest.raises(SplitReviewPending):
        run_evaluation(db, portfolio_id=portfolio.id, mode="biweekly", dry_run=False)


def test_an_unexpected_response_shape_fails_closed(db, portfolio, held):
    from worker.jobs.runner import check_splits

    fmp = FakeFMP(calendar=[{"symbol": "AAA", "splitDate": "2026-10-05", "ratio": "4:1"}])
    with pytest.raises(RuntimeError):
        record_splits(db, fmp, TODAY)
    assert check_splits(db, fmp, TODAY)["hold_sells"] is True


def test_only_one_for_one_rows_is_not_an_error(db, portfolio):
    fmp = FakeFMP(
        calendar=[{"symbol": "AAA", "date": "2026-10-05", "numerator": 1, "denominator": 1}]
    )
    assert record_splits(db, fmp, TODAY)["added"] == 0
