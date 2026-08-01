from app.routes.public_v1 import _public_trade_reason


def test_internal_trade_labels_are_not_published():
    assert _public_trade_reason("Manual entry (admin)") == "Added to the live portfolio"
    assert _public_trade_reason("Manual edit (admin)") == "Position record adjusted"
    assert _public_trade_reason("Manual removal (admin)") == "Removed from the live portfolio"


def test_strategy_reasons_pass_through_unchanged():
    reason = "Top pick: Quant 4.6, Rev=A+, Gro=A, Val=C"
    assert _public_trade_reason(reason) == reason
    assert _public_trade_reason(None) is None
