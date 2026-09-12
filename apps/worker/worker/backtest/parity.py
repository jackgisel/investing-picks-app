"""Compare derived composite_scores to live scores on Segment A Fridays."""

from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.db.models import CompositeScore, UniverseMembership


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    if dx == 0 or dy == 0:
        return None
    return num / (dx * dy)


def _ranks(values: list[float]) -> list[float]:
    indexed = sorted(range(len(values)), key=lambda i: values[i], reverse=True)
    ranks = [0.0] * len(values)
    rank = 0
    while rank < len(indexed):
        end = rank
        while (
            end + 1 < len(indexed)
            and values[indexed[end + 1]] == values[indexed[rank]]
        ):
            end += 1
        mid = (rank + end) / 2.0
        for k in range(rank, end + 1):
            ranks[indexed[k]] = mid
        rank = end + 1
    return ranks


def _spearman(xs: list[float], ys: list[float]) -> float | None:
    return _pearson(_ranks(xs), _ranks(ys))


def _scores_by_ticker(db: Session, as_of: date) -> dict[str, CompositeScore]:
    return {
        row.ticker: row
        for row in db.query(CompositeScore).filter(CompositeScore.as_of == as_of).all()
    }


def parity_report(
    derived: Session,
    live: Session,
    start: date,
    end: date,
) -> dict:
    """Decision-level parity: derived vs live composite_scores, Segment A only.

    A gap here is a PIT derivation bug (acceptedDate, valuation-at-close,
    forward-fill), not a vendor disagreement — same functions, same vendor.
    """
    fridays = (
        derived.query(UniverseMembership.as_of, UniverseMembership.universe_scope)
        .filter(
            UniverseMembership.as_of >= start,
            UniverseMembership.as_of <= end,
        )
        .distinct()
        .all()
    )
    by_day = []
    qr_derived: list[float] = []
    qr_live: list[float] = []
    exact = 0
    overlap_n = 0
    abs_qr = 0.0
    for as_of, scope in sorted(fridays, key=lambda row: row[0]):
        if scope != "top400_live":
            continue
        left = _scores_by_ticker(derived, as_of)
        right = _scores_by_ticker(live, as_of)
        shared = sorted(set(left) & set(right))
        day_exact = 0
        day_abs = 0.0
        for ticker in shared:
            overlap_n += 1
            d_qr = float(left[ticker].quant_rating)
            l_qr = float(right[ticker].quant_rating)
            qr_derived.append(d_qr)
            qr_live.append(l_qr)
            diff = abs(d_qr - l_qr)
            abs_qr += diff
            day_abs += diff
            if round(d_qr, 3) == round(l_qr, 3):
                exact += 1
                day_exact += 1
        by_day.append(
            {
                "as_of": as_of.isoformat(),
                "universe_scope": scope,
                "derived": len(left),
                "live": len(right),
                "overlap": len(shared),
                "exact_qr": day_exact,
                "mean_abs_qr_diff": (day_abs / len(shared)) if shared else None,
            }
        )
    return {
        "segment": "top400_live",
        "fridays": by_day,
        "n_fridays": len(by_day),
        "overlap": overlap_n,
        "exact_qr": exact,
        "exact_qr_pct": (exact / overlap_n) if overlap_n else None,
        "mean_abs_qr_diff": (abs_qr / overlap_n) if overlap_n else None,
        "spearman_qr": _spearman(qr_derived, qr_live) if overlap_n else None,
    }
