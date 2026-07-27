"""Grade utilities shared by scoring and selection."""

import logging

logger = logging.getLogger(__name__)

GRADE_THRESHOLDS = [
    (95, "A+"),
    (85, "A"),
    (75, "A-"),
    (65, "B+"),
    (55, "B"),
    (45, "B-"),
    (35, "C+"),
    (25, "C"),
    (15, "C-"),
    (10, "D+"),
    (5, "D"),
    (2, "D-"),
    (0, "F"),
]

GRADE_ORDER = {
    "A+": 12,
    "A": 11,
    "A-": 10,
    "B+": 9,
    "B": 8,
    "B-": 7,
    "C+": 6,
    "C": 5,
    "C-": 4,
    "D+": 3,
    "D": 2,
    "D-": 1,
    "F": 0,
}

SIGNAL_THRESHOLDS = {
    "strong_buy": 4.5,
    "buy": 3.5,
    "hold": 2.5,
    "sell": 1.5,
}


def percentile_to_grade(pct: float) -> str:
    for threshold, grade in GRADE_THRESHOLDS:
        if pct >= threshold:
            return grade
    return "F"


def grade_meets_minimum(grade: str | None, min_grade: str) -> bool:
    """Does `grade` clear the `min_grade` bar? An unknown bar rejects everything.

    The threshold side must fail CLOSED. `GRADE_ORDER.get(min_grade, 0)` resolved
    an unrecognised minimum to F's rank, so `>= 0` was true for every grade and
    the gate silently disappeared — a lower-cased "b+" or a stray space in one
    `params_json` row was enough to stop `min_revisions_grade` (weight 0.30,
    gates every buy) from filtering anything, while the ledger still recorded the
    rule as passed. `params_from_portfolio` splices free-form JSON from the
    database over the defaults, so this is reachable from data, not just code.

    Rejecting rather than raising is deliberate: this runs inside a scheduled
    evaluation, and a bad config row should make the strategy decline to buy —
    loudly — not take the whole run down. The stock side (`grade or "F"`) already
    fails closed and is left alone.
    """
    min_rank = GRADE_ORDER.get(min_grade)
    if min_rank is None:
        logger.error(
            "Unrecognised minimum grade %r — rejecting every candidate on this "
            "criterion. Valid grades: %s. Check params_json.",
            min_grade,
            ", ".join(GRADE_ORDER),
        )
        return False
    return GRADE_ORDER.get(grade or "F", 0) >= min_rank


def quant_to_signal(qr: float) -> str:
    if qr >= SIGNAL_THRESHOLDS["strong_buy"]:
        return "strong_buy"
    if qr >= SIGNAL_THRESHOLDS["buy"]:
        return "buy"
    if qr >= SIGNAL_THRESHOLDS["hold"]:
        return "hold"
    if qr >= SIGNAL_THRESHOLDS["sell"]:
        return "sell"
    return "strong_sell"
