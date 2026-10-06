"""A stored params_json row is overrides, never a pin on the model version."""

from __future__ import annotations

from app.services.portfolio import ensure_default_portfolio, params_from_portfolio
from outpick_strategy import RUN118_PARAMS, StrategyParams


def test_a_stale_run118_snapshot_resolves_to_run119_defaults(db, portfolio):
    """The live book's row was written by run118's `to_dict()` at creation.

    After the run119 deploy that row pinned sector_cap_basis, momentum_penalty
    and the version label to run118 while the worker scored on run119. A value
    that equals run118's default in a run118-labelled row is not an override.
    """
    stale = RUN118_PARAMS.to_dict()
    stale.update(
        {
            "version_label": "run118",
            "sector_cap_basis": "max_positions",
            "momentum_penalty": 20.0,
            "valuation_penalize_losses": False,
            "cash_reserve_buys": 2,
            "weak_signal_threshold": 4.0,
            "position_size_usd": 1_000.0,
            "max_loss_pct": None,
        }
    )
    portfolio.params_json = stale
    params = params_from_portfolio(portfolio)
    assert params.version_label == RUN118_PARAMS.version_label
    assert params.sector_cap_basis == "held"
    assert params.momentum_penalty == 0.0
    assert params.valuation_penalize_losses is True
    # The one genuine override survives.
    assert params.position_size_usd == 1_000.0
    assert params.version_hash() == RUN118_PARAMS.with_overrides(
        position_size_usd=1_000.0, max_loss_pct=None
    ).version_hash()


def test_a_real_override_on_a_stale_row_still_applies(db, portfolio):
    stale = RUN118_PARAMS.to_dict()
    stale.update({"version_label": "run118", "sector_cap_basis": "max_positions",
                  "momentum_penalty": 10.0})
    portfolio.params_json = stale
    params = params_from_portfolio(portfolio)
    assert params.momentum_penalty == 10.0
    assert params.sector_cap_basis == "held"


def test_only_differing_keys_change_the_hash(db, portfolio):
    portfolio.params_json = {"position_size_usd": 1_000.0, "version_label": "run0"}
    params = params_from_portfolio(portfolio)
    assert params.position_size_usd == 1_000.0
    assert params.version_label == RUN118_PARAMS.version_label
    assert params.version_hash() == RUN118_PARAMS.with_overrides(position_size_usd=1_000.0).version_hash()

    portfolio.params_json = StrategyParams().to_dict()
    assert params_from_portfolio(portfolio).version_hash() == RUN118_PARAMS.version_hash()


def test_default_portfolio_is_created_with_no_snapshot(db):
    from app.db.models import Portfolio

    db.query(Portfolio).delete()
    db.commit()
    created = ensure_default_portfolio(db, 50_000.0)
    assert created.params_json == {}
    assert params_from_portfolio(created) == RUN118_PARAMS
