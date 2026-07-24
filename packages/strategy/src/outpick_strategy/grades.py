"""Grade utilities shared by scoring and selection."""

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
    return GRADE_ORDER.get(grade or "F", 0) >= GRADE_ORDER.get(min_grade, 0)


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
