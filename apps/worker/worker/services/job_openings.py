"""Job openings — our own dataset, counted from companies' public job boards.

No vendor sells this to us on our plan, and the history cannot be recovered
later, so we start the clock ourselves. Two jobs share this module:

- `discover_boards` finds which public ATS board (Greenhouse, Lever, Ashby),
  if any, belongs to each company. Weekly, slow, conservative.
- `collect_openings` counts the open postings on every known board and appends
  one row per company per day. Daily, fast.

A board is `verified` only when we have positive evidence it is that company's:
an exact name match from Greenhouse (which states the board's name), or the
company's name appearing in the text of most of a Lever / Ashby board's
postings. Everything else is stored unverified and kept out of any published
number. A wrong board is worse than no board.
"""

from __future__ import annotations

import logging
import re
import time
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import JobBoard, JobBoardCheck, JobOpeningSnapshot, Stock
from worker.services.ingest import held_tickers, today_et

log = logging.getLogger(__name__)

DISCOVER_JOB = "job_boards_discover"
COLLECT_JOB = "job_openings_collect"
DISCOVER_TIMEOUT_MINUTES = 45.0
COLLECT_TIMEOUT_MINUTES = 20.0
#: Seconds between requests to any one ATS host. These are public feeds meant
#: for career-site widgets; stay far below anything that looks like load.
REQUEST_INTERVAL = 0.4
RECHECK_NOT_FOUND_DAYS = 45
RECHECK_FOUND_DAYS = 90
#: Share of sampled postings that must name the company to verify a board.
TEXT_VERIFY_SHARE = 0.6
TEXT_VERIFY_SAMPLE = 20
MIN_TOKEN_LEN = 4

GREENHOUSE = "greenhouse"
LEVER = "lever"
ASHBY = "ashby"
ATS_ORDER = (GREENHOUSE, LEVER, ASHBY)

_SUFFIXES = {
    "inc", "incorporated", "corp", "corporation", "co", "company", "ltd",
    "limited", "plc", "llc", "lp", "holdings", "holding", "group", "the",
    "sa", "nv", "ag", "de", "cl", "class", "common", "stock",
}


def name_tokens(name: str | None) -> list[str]:
    """Lowercase alphanumeric words with corporate suffixes dropped."""
    words = re.findall(r"[a-z0-9]+", (name or "").lower().replace("&", " and "))
    return [w for w in words if w not in _SUFFIXES]


def names_equal(a: str | None, b: str | None) -> bool:
    ta, tb = name_tokens(a), name_tokens(b)
    return bool(ta) and ta == tb


def candidate_slugs(name: str | None, ticker: str) -> list[str]:
    """Plausible board slugs for a company, most specific first."""
    tokens = name_tokens(name)
    out: list[str] = []
    if tokens:
        out.append("".join(tokens))
        if len(tokens) > 1:
            out.append("-".join(tokens))
            if len(tokens[0]) >= MIN_TOKEN_LEN:
                out.append(tokens[0])
    if len(ticker) >= MIN_TOKEN_LEN:
        out.append(ticker.lower())
    seen: set[str] = set()
    return [s for s in out if s and not (s in seen or seen.add(s))]


class AtsClient:
    """Thin client over the three public job-board feeds."""

    def __init__(self, client: httpx.Client | None = None, interval: float = REQUEST_INTERVAL):
        self._client = client or httpx.Client(
            timeout=30.0, headers={"User-Agent": "outpick-data/1.0 (+https://outpick.xyz)"}
        )
        self._interval = interval
        self._last = 0.0

    def close(self) -> None:
        self._client.close()

    def _get(self, url: str) -> list | dict | None:
        wait = self._interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.monotonic()
        try:
            r = self._client.get(url)
        except Exception as e:
            log.warning("job board request failed: %s", type(e).__name__)
            return None
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except Exception:
            return None

    def greenhouse_name(self, slug: str) -> str | None:
        data = self._get(f"https://boards-api.greenhouse.io/v1/boards/{slug}")
        return data.get("name") if isinstance(data, dict) else None

    def greenhouse_jobs(self, slug: str) -> list[dict] | None:
        data = self._get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs")
        if isinstance(data, dict) and isinstance(data.get("jobs"), list):
            return data["jobs"]
        return None

    def lever_jobs(self, slug: str) -> list[dict] | None:
        data = self._get(f"https://api.lever.co/v0/postings/{slug}?mode=json")
        return data if isinstance(data, list) else None

    def ashby_jobs(self, slug: str) -> list[dict] | None:
        data = self._get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
        if isinstance(data, dict) and isinstance(data.get("jobs"), list):
            return data["jobs"]
        return None

    def jobs(self, ats: str, slug: str) -> list[dict] | None:
        return {
            GREENHOUSE: self.greenhouse_jobs,
            LEVER: self.lever_jobs,
            ASHBY: self.ashby_jobs,
        }[ats](slug)


def _posting_text(job: dict) -> str:
    parts = [
        job.get("descriptionPlain"),
        job.get("additionalPlain"),
        job.get("text"),
        job.get("title"),
    ]
    return " ".join(str(p) for p in parts if p).lower()


def text_names_company(jobs: list[dict], company: str | None) -> bool:
    """Does the company's name appear in most of a board's postings?"""
    tokens = [t for t in name_tokens(company) if len(t) >= MIN_TOKEN_LEN]
    if not tokens or not jobs:
        return False
    needle = tokens[0]
    sample = jobs[:TEXT_VERIFY_SAMPLE]
    hits = sum(1 for j in sample if needle in _posting_text(j))
    return hits / len(sample) >= TEXT_VERIFY_SHARE


def discover_ticker(ats: AtsClient, ticker: str, name: str | None) -> list[dict]:
    """Boards found for one company. Greenhouse first; Lever/Ashby if it has none."""
    found: list[dict] = []
    slugs = candidate_slugs(name, ticker)
    for slug in slugs:
        board_name = ats.greenhouse_name(slug)
        if board_name is None:
            continue
        exact = names_equal(board_name, name)
        # A board whose name merely starts like the company's (Apple vs Apple
        # Hospitality REIT) is recorded, but never trusted.
        tokens_b, tokens_c = name_tokens(board_name), name_tokens(name)
        prefix = bool(tokens_b) and tokens_c[: len(tokens_b)] == tokens_b
        if exact or prefix:
            found.append(
                {"ats": GREENHOUSE, "slug": slug, "board_name": board_name, "verified": exact}
            )
            break
    if found:
        return found
    for slug in slugs:
        for kind in (LEVER, ASHBY):
            jobs = ats.jobs(kind, slug)
            if not jobs:
                continue
            found.append(
                {
                    "ats": kind,
                    "slug": slug,
                    "board_name": None,
                    "verified": text_names_company(jobs, name),
                }
            )
            return found
    return found


def discovery_universe(db: Session) -> list[tuple[str, str | None]]:
    """(ticker, name) for every live-universe name, held first."""
    held = held_tickers(db)
    rows = (
        db.query(Stock.ticker, Stock.name)
        .filter(Stock.is_active == True, Stock.is_etf == False)  # noqa: E712
        .all()
    )
    rows.sort(key=lambda r: (r[0] not in held, r[0]))
    # One entry per company: share classes share a board.
    seen: set[str] = set()
    out: list[tuple[str, str | None]] = []
    for ticker, name in rows:
        key = " ".join(name_tokens(name)) or ticker
        if key in seen:
            continue
        seen.add(key)
        out.append((ticker, name))
    return out


def _age_days(at: datetime, now: datetime) -> float:
    if at.tzinfo is None:
        at = at.replace(tzinfo=timezone.utc)
    return (now - at).total_seconds() / 86400


def discover_boards(
    db: Session,
    ats: AtsClient,
    budget_seconds: float = (DISCOVER_TIMEOUT_MINUTES - 5) * 60,
    now: datetime | None = None,
) -> dict:
    """Find boards for companies not looked at recently. Resumable by check log."""
    now = now or datetime.now(timezone.utc)
    started = time.monotonic()
    checks = {c.ticker: c for c in db.query(JobBoardCheck).all()}
    queue = []
    for ticker, name in discovery_universe(db):
        check = checks.get(ticker)
        limit = None
        if check is not None:
            limit = RECHECK_FOUND_DAYS if check.found else RECHECK_NOT_FOUND_DAYS
        if check is None or _age_days(check.checked_at, now) >= limit:
            queue.append((ticker, name))

    asked = found_n = verified_n = 0
    for ticker, name in queue:
        if time.monotonic() - started > budget_seconds:
            break
        boards = discover_ticker(ats, ticker, name)
        for b in boards:
            existing = (
                db.query(JobBoard)
                .filter_by(ticker=ticker, ats=b["ats"], slug=b["slug"])
                .one_or_none()
            )
            if existing is None:
                db.add(JobBoard(ticker=ticker, discovered_at=now, active=True, **b))
            else:
                # Never downgrade a board someone verified by hand.
                existing.verified = existing.verified or b["verified"]
                existing.board_name = b["board_name"] or existing.board_name
        check = checks.get(ticker) or JobBoardCheck(ticker=ticker)
        check.checked_at = now
        check.found = bool(boards)
        db.merge(check)
        db.commit()
        asked += 1
        found_n += bool(boards)
        verified_n += any(b["verified"] for b in boards)
    return {
        "universe": len(discovery_universe(db)),
        "queued": len(queue),
        "asked": asked,
        "found": found_n,
        "verified": verified_n,
        "remaining": len(queue) - asked,
    }


def missing_weekdays(db: Session, today: date) -> list[date]:
    """Mon-Fri dates after the first snapshot with none, like the consensus tape."""
    first = db.query(func.min(JobOpeningSnapshot.as_of)).scalar()
    if first is None:
        return []
    present = {
        d
        for (d,) in db.query(JobOpeningSnapshot.as_of)
        .filter(JobOpeningSnapshot.as_of >= first, JobOpeningSnapshot.as_of < today)
        .distinct()
        .all()
    }
    out, cursor = [], first
    while cursor < today:
        if cursor.weekday() < 5 and cursor not in present:
            out.append(cursor)
        cursor += timedelta(days=1)
    return out


def collect_openings(db: Session, ats: AtsClient, as_of: date | None = None) -> dict:
    """Append today's open-posting count for every company with a known board.

    One row per (ticker, day), the first write wins. A ticker's count is the
    sum over its boards, and `boards` keeps the split. If any one of a
    company's boards fails to load, the company is skipped for the day rather
    than recording a partial count that would read as a hiring collapse.
    """
    as_of = as_of or today_et()
    boards = db.query(JobBoard).filter(JobBoard.active == True).all()  # noqa: E712
    by_ticker: dict[str, list[JobBoard]] = {}
    for b in boards:
        by_ticker.setdefault(b.ticker, []).append(b)
    if not by_ticker:
        raise RuntimeError("no job boards known; run discovery first")

    stored = skipped = 0
    existing = {
        t
        for (t,) in db.query(JobOpeningSnapshot.ticker).filter(
            JobOpeningSnapshot.as_of == as_of
        )
    }
    for ticker, group in sorted(by_ticker.items()):
        if ticker in existing:
            continue
        detail, total, ok = [], 0, True
        for b in group:
            jobs = ats.jobs(b.ats, b.slug)
            if jobs is None:
                ok = False
                break
            detail.append({"ats": b.ats, "slug": b.slug, "open": len(jobs)})
            total += len(jobs)
        if not ok:
            skipped += 1
            continue
        db.add(
            JobOpeningSnapshot(
                ticker=ticker,
                as_of=as_of,
                open_count=total,
                verified=all(b.verified for b in group),
                boards=detail,
                fetched_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        stored += 1
    if stored == 0 and skipped >= 10:
        raise RuntimeError(f"job openings: all {skipped} boards failed to load")
    return {
        "as_of": as_of.isoformat(),
        "boards": len(boards),
        "tickers": len(by_ticker),
        "stored": stored,
        "skipped": skipped,
        "already_had": len(existing),
    }


def coverage(db: Session, today: date | None = None) -> dict:
    today = today or today_et()
    latest = db.query(func.max(JobOpeningSnapshot.as_of)).scalar()
    by_ats = {
        ats: {"verified": 0, "unverified": 0}
        for ats in ATS_ORDER
    }
    for b in db.query(JobBoard).filter(JobBoard.active == True):  # noqa: E712
        by_ats.setdefault(b.ats, {"verified": 0, "unverified": 0})[
            "verified" if b.verified else "unverified"
        ] += 1
    snap = (
        db.query(
            func.count(JobOpeningSnapshot.id), func.coalesce(func.sum(JobOpeningSnapshot.open_count), 0)
        )
        .filter(JobOpeningSnapshot.as_of == latest)
        .one()
        if latest
        else (0, 0)
    )
    return {
        "boards_by_ats": by_ats,
        "companies_checked": db.query(func.count(JobBoardCheck.ticker)).scalar() or 0,
        "latest_snapshot": latest.isoformat() if latest else None,
        "tickers_in_latest": int(snap[0]),
        "openings_in_latest": int(snap[1]),
        "missing_prior_weekdays": [d.isoformat() for d in missing_weekdays(db, today)],
    }
