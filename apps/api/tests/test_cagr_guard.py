"""The live CAGR is a public performance claim. These are its guardrails.

The bug being pinned: the landing card annualized a since-inception return over
the *snapshot* window. With two rows in `portfolio_snapshots` that window was one
day, so +26.81% annualized to an astronomical number, tripped the old guard, and
rendered as a bare em-dash beside the text "Day 115".
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import PortfolioSnapshot, Trade
from app.routes.public_v1 import (
    MIN_CAGR_WINDOW_DAYS,
    MIN_HISTORY_COVERAGE,
    annualize_return,
    get_performance,
)

from conftest import make_position


# ---------------------------------------------------------------------------
# The guard itself
# ---------------------------------------------------------------------------


def test_short_window_is_refused_rather_than_annualized():
    """The original bug, reduced: +26.81% over one day."""
    out = annualize_return(26.81, days_live=1, days_recorded=1)
    assert out["annualized_return_pct"] is None
    assert out["annualized_status"] == "window_too_short"


def test_a_week_is_still_refused():
    """The previous floor was 7 days, which annualizes to ~10^13 percent."""
    out = annualize_return(26.81, days_live=7, days_recorded=7)
    assert out["annualized_status"] == "window_too_short"


@pytest.mark.parametrize("days", [1, 7, 30, 60, MIN_CAGR_WINDOW_DAYS - 1])
def test_every_window_below_the_floor_is_refused(days):
    out = annualize_return(26.81, days_live=days, days_recorded=days)
    assert out["annualized_return_pct"] is None
    assert out["annualized_status"] == "window_too_short"


def test_the_floor_itself_is_allowed():
    out = annualize_return(26.81, MIN_CAGR_WINDOW_DAYS, MIN_CAGR_WINDOW_DAYS)
    assert out["annualized_status"] == "ok"
    # (1.2681 ^ (365/90) - 1) * 100
    assert out["annualized_return_pct"] == pytest.approx(162.03, abs=0.05)


def test_annualization_uses_days_live_not_the_snapshot_window():
    """The heart of the fix.

    A book 115 days old with a full 115-day history and a book 115 days old
    reported over a 1-day window must never produce different *rates* — one is
    published, the other is refused, but neither annualizes over 1 day.
    """
    full = annualize_return(26.81, days_live=115, days_recorded=115)
    assert full["annualized_status"] == "ok"
    assert full["annualized_return_pct"] == pytest.approx(112.52, abs=0.05)

    # For scale: annualizing the same return over the 1-day snapshot window the
    # old code used gives 4.5e39 percent. That is the number the em-dash was
    # hiding, and it must be unreachable now regardless of the data window.
    assert (1.2681 ** 365 - 1) * 100 > 1e38
    assert 0 < full["annualized_return_pct"] < 1000


def test_thin_history_is_refused_even_though_the_window_is_long():
    out = annualize_return(26.81, days_live=115, days_recorded=1)
    assert out["annualized_return_pct"] is None
    assert out["annualized_status"] == "insufficient_history"
    # The response carries both numbers so the UI can say which one is short.
    assert out["days_live"] == 115
    assert out["days_recorded"] == 1


def test_history_coverage_boundary():
    days_live = 200
    just_enough = int(MIN_HISTORY_COVERAGE * days_live)
    assert annualize_return(20.0, days_live, just_enough)["annualized_status"] == "ok"
    assert (
        annualize_return(20.0, days_live, just_enough - 1)["annualized_status"]
        == "insufficient_history"
    )


def test_no_return_yields_unavailable_not_a_number():
    out = annualize_return(None, days_live=365, days_recorded=365)
    assert out["annualized_return_pct"] is None
    assert out["annualized_status"] == "unavailable"


def test_zero_or_negative_days_live_is_unavailable():
    assert annualize_return(10.0, 0, 0)["annualized_status"] == "unavailable"
    assert annualize_return(10.0, -5, 0)["annualized_status"] == "unavailable"


def test_a_total_wipeout_has_no_annualized_rate():
    out = annualize_return(-100.0, days_live=365, days_recorded=365)
    assert out["annualized_return_pct"] is None
    assert out["annualized_status"] == "not_meaningful"


def test_a_loss_still_annualizes():
    out = annualize_return(-20.0, days_live=365, days_recorded=365)
    assert out["annualized_status"] == "ok"
    assert out["annualized_return_pct"] == pytest.approx(-20.0, abs=0.1)


def test_one_full_year_annualizes_to_the_total_return():
    out = annualize_return(38.99, days_live=365, days_recorded=365)
    assert out["annualized_return_pct"] == pytest.approx(38.99, abs=0.01)


def test_the_status_is_never_missing():
    """A bare null with no reason is what produced the unexplained em-dash."""
    for args in [(None, None, None), (10.0, 5, 5), (10.0, 500, 1), (10.0, 500, 500)]:
        out = annualize_return(*args)
        assert out["annualized_status"]
        assert "min_window_days" in out


# ---------------------------------------------------------------------------
# End to end through /performance
# ---------------------------------------------------------------------------


def _snapshot(db, portfolio, day, total, spy=500.0):
    db.add(
        PortfolioSnapshot(
            portfolio_id=portfolio.id,
            date=day,
            cash=0.0,
            invested_value=total,
            total_value=total,
            spy_value=spy,
            position_count=1,
        )
    )
    db.commit()


def test_performance_refuses_the_cagr_on_a_two_row_history(db, portfolio):
    """Exactly the production state that produced the em-dash."""
    today = date.today()
    portfolio.inception_date = today - timedelta(days=115)
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0, current_price=126.81)
    _snapshot(db, portfolio, today - timedelta(days=1), 100_000.0)
    _snapshot(db, portfolio, today, 126_810.0)

    summary = get_performance(db)["summary"]

    assert summary["days_live"] == 115
    assert summary["days_recorded"] == 1
    assert summary["annualized_return_pct"] is None
    assert summary["annualized_status"] == "insufficient_history"
    # The realized number is still published — only the extrapolation is held back.
    assert summary["total_return_pct"] is not None


def test_performance_publishes_the_cagr_once_the_curve_is_backfilled(db, portfolio):
    """After the backfill fills in the missing sessions, the claim is allowed."""
    today = date.today()
    inception = today - timedelta(days=115)
    portfolio.inception_date = inception
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0, current_price=126.81)
    for i in range(0, 116, 5):
        day = inception + timedelta(days=i)
        _snapshot(db, portfolio, day, 100_000.0 * (1 + 0.2681 * i / 115))

    summary = get_performance(db)["summary"]

    assert summary["days_live"] == 115
    assert summary["days_recorded"] == 115
    assert summary["annualized_status"] == "ok"
    assert summary["annualized_return_pct"] is not None
    assert 0 < summary["annualized_return_pct"] < 1000
    assert summary["inception_date"] == inception.isoformat()


def test_performance_with_no_snapshots_still_explains_itself(db, portfolio):
    portfolio.inception_date = date.today() - timedelta(days=115)
    db.commit()
    summary = get_performance(db)["summary"]

    assert summary["snapshots"] == 0
    assert summary["annualized_return_pct"] is None
    assert summary["annualized_status"] in ("insufficient_history", "unavailable")


def test_inception_falls_back_to_the_first_snapshot(db, portfolio):
    today = date.today()
    portfolio.inception_date = None
    db.commit()
    _snapshot(db, portfolio, today - timedelta(days=200), 100_000.0)
    _snapshot(db, portfolio, today, 120_000.0)

    summary = get_performance(db)["summary"]
    assert summary["inception_date"] == (today - timedelta(days=200)).isoformat()
    assert summary["days_live"] == 200


def test_a_young_book_says_the_window_is_too_short(db, portfolio):
    today = date.today()
    inception = today - timedelta(days=10)
    portfolio.inception_date = inception
    db.commit()
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0, current_price=126.81)
    for i in range(11):
        _snapshot(db, portfolio, inception + timedelta(days=i), 100_000.0 + 2681.0 * i)

    summary = get_performance(db)["summary"]
    # Full coverage, but ten days is not a track record.
    assert summary["days_recorded"] == 10
    assert summary["annualized_status"] == "window_too_short"
    assert summary["annualized_return_pct"] is None


def test_the_summary_carries_both_bases_and_they_do_not_mix(db, portfolio):
    """The landing page's +21.36%-beside-+6.43% bug, at its source.

    A partly-invested book makes the picks return and the equity return diverge
    by an order of magnitude. The summary has to publish both, each with its own
    annualization, so a caller leading with one cannot pick up the other's CAGR
    without saying so.
    """
    today = date.today()
    inception = today - timedelta(days=200)
    portfolio.inception_date = inception
    db.commit()

    # Deploy a tenth of the book into one position that then doubles, leaving
    # the rest in cash: picks +100%, whole book far less. The buy trade is what
    # `picks_return` measures against — it divides by capital actually deployed,
    # so a position with no trade behind it has no picks return at all.
    make_position(db, portfolio, "AAA", shares=100.0, avg_cost=100.0, current_price=200.0)
    db.add(
        Trade(
            portfolio_id=portfolio.id,
            ticker="AAA",
            side="buy",
            shares=100.0,
            price=100.0,
            notional=10_000.0,
            action="manual_buy",
            timestamp=datetime(
                inception.year, inception.month, inception.day, tzinfo=timezone.utc
            ),
        )
    )
    db.commit()
    for i in range(201):
        _snapshot(db, portfolio, inception + timedelta(days=i), 100_000.0 + 50.0 * i)

    summary = get_performance(db)["summary"]

    assert summary["return_basis"] == "portfolio_equity"
    # Both pairs present, both "ok" on a 200-day book with full coverage.
    assert summary["annualized_status"] == "ok"
    assert summary["picks_annualized_status"] == "ok"

    # Each annualized figure must be its OWN base annualized — never the other.
    for total_key, cagr_key in (
        ("total_return_pct", "annualized_return_pct"),
        ("picks_return_pct", "picks_annualized_return_pct"),
    ):
        base = summary[total_key]
        expected = round(((1 + base / 100) ** (365 / summary["days_live"]) - 1) * 100, 2)
        assert summary[cagr_key] == pytest.approx(expected, abs=0.01), (
            f"{cagr_key} is not {total_key} annualized"
        )

    # And the two bases really are different here, so the check above has teeth.
    assert summary["picks_return_pct"] > summary["total_return_pct"] * 2

    # The window fields describe the book, not a base, and are not duplicated.
    assert summary["days_live"] == 200
    assert "picks_days_live" not in summary
