"""Job-openings collection: board discovery rules and the daily count.

The rules pinned here: slugs come from the company's name with corporate
suffixes dropped; only an exact name match from Greenhouse (or the company's
name in most of a Lever/Ashby board's postings) makes a board verified, a
board that only starts like the company's name is kept unverified; share
classes of one company share a lookup; a company with several boards sums
them, and if any board fails to load the company is skipped for the day
instead of recording a partial count; rows are append-only per day.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import JobBoard, JobBoardCheck, JobOpeningSnapshot, Stock
from worker.services import job_openings
from worker.services.job_openings import (
    GREENHOUSE,
    LEVER,
    ASHBY,
    candidate_slugs,
    collect_openings,
    coverage,
    discover_boards,
    discover_ticker,
    discovery_universe,
    missing_weekdays,
    name_tokens,
    names_equal,
    text_names_company,
)

TODAY = date(2026, 10, 5)  # a Monday


@pytest.fixture(autouse=True)
def _no_retry_sleep(monkeypatch):
    monkeypatch.setattr(job_openings.time, "sleep", lambda s: None)


class FakeAts:
    def __init__(self, gh_names=None, lever=None, ashby=None, greenhouse=None, fail=(), gone=(), flaky=()):
        self.gh_names = gh_names or {}
        self.boards = {
            GREENHOUSE: greenhouse or {},
            LEVER: lever or {},
            ASHBY: ashby or {},
        }
        self.fail = set(fail)
        self.gone = set(gone)
        self.flaky = set(flaky)  # fails once, then answers
        self.last_status = 200
        self.calls: list[str] = []

    def greenhouse_name(self, slug):
        self.calls.append(f"gh-name:{slug}")
        return self.gh_names.get(slug)

    def jobs(self, ats, slug):
        self.calls.append(f"{ats}:{slug}")
        key = (ats, slug)
        if key in self.gone:
            self.last_status = 404
            return None
        if key in self.fail:
            self.last_status = 0
            return None
        if key in self.flaky:
            self.flaky.discard(key)
            self.last_status = 0
            return None
        self.last_status = 200
        return self.boards[ats].get(slug)


def _jobs(n, text="Join Palantir today"):
    return [{"title": f"Role {i}", "descriptionPlain": text} for i in range(n)]


def test_name_tokens_drop_corporate_suffixes():
    assert name_tokens("Palantir Technologies Inc.") == ["palantir", "technologies"]
    assert name_tokens("The Trade Desk, Inc.") == ["trade", "desk"]
    assert names_equal("Block, Inc.", "Block")
    assert not names_equal("Apple", "Apple Hospitality REIT")


def test_candidate_slugs_most_specific_first():
    assert candidate_slugs("Palantir Technologies Inc.", "PLTR") == [
        "palantirtechnologies",
        "palantir-technologies",
        "palantir",
        "pltr",
    ]
    # A short ticker is too ambiguous to guess a board from.
    assert "ab" not in candidate_slugs("Alpha Beta Corp", "AB")


def test_greenhouse_exact_name_is_verified():
    ats = FakeAts(gh_names={"airbnb": "Airbnb"})
    found = discover_ticker(ats, "ABNB", "Airbnb, Inc.")
    assert found == [
        {"ats": GREENHOUSE, "slug": "airbnb", "board_name": "Airbnb", "verified": True}
    ]


def test_greenhouse_prefix_match_is_kept_unverified():
    ats = FakeAts(gh_names={"apple": "Apple"})
    found = discover_ticker(ats, "APLE", "Apple Hospitality REIT, Inc.")
    assert found and found[0]["verified"] is False


def test_greenhouse_unrelated_board_is_rejected():
    ats = FakeAts(gh_names={"block": "Blockchain Foundation"})
    assert discover_ticker(ats, "XYZ", "Block, Inc.") == []


def test_lever_board_verified_only_when_postings_name_the_company():
    named = FakeAts(lever={"palantir": _jobs(25, "Palantir builds software")})
    assert discover_ticker(named, "PLTR", "Palantir Technologies Inc.")[0]["verified"]
    other = FakeAts(lever={"palantir": _jobs(25, "A totally different firm")})
    assert discover_ticker(other, "PLTR", "Palantir Technologies Inc.")[0]["verified"] is False


def test_text_verification_needs_a_long_enough_name_token():
    assert not text_names_company(_jobs(5, "ibm ibm"), "IBM Corp")  # token too short
    assert not text_names_company([], "Palantir")


def _stocks(db, rows):
    for ticker, name in rows:
        db.add(Stock(ticker=ticker, name=name, is_active=True, is_etf=False))
    db.commit()


def test_discovery_universe_dedupes_share_classes(db):
    _stocks(db, [("GOOGL", "Alphabet Inc."), ("GOOG", "Alphabet Inc."), ("ABNB", "Airbnb, Inc.")])
    assert [t for t, _ in discovery_universe(db)] == ["ABNB", "GOOG"]


def test_discover_boards_stores_boards_and_checks_and_skips_recent(db):
    _stocks(db, [("ABNB", "Airbnb, Inc."), ("NOPE", "Nothing Corp")])
    ats = FakeAts(gh_names={"airbnb": "Airbnb"})
    result = discover_boards(db, ats)
    assert result["asked"] == 2 and result["found"] == 1 and result["verified"] == 1
    assert db.query(JobBoard).count() == 1
    assert db.get(JobBoardCheck, "NOPE").found is False
    again = discover_boards(db, FakeAts())
    assert again["queued"] == 0


def test_discover_boards_rechecks_after_the_window_and_keeps_manual_verification(db):
    _stocks(db, [("ABNB", "Airbnb, Inc.")])
    discover_boards(db, FakeAts(gh_names={"airbnb": "Airbnb"}))
    board = db.query(JobBoard).one()
    board.verified = True
    db.commit()
    # The name check now fails (board renamed); a manual verification stays.
    later = datetime.now(timezone.utc) + timedelta(days=200)
    discover_boards(db, FakeAts(gh_names={"airbnb": "Airbnb Hospitality Group"}), now=later)
    assert db.query(JobBoard).one().verified is True


def test_discovery_stops_on_budget_and_resumes(db):
    _stocks(db, [("AAA", "Alpha Corp"), ("BBB", "Beta Corp")])
    first = discover_boards(db, FakeAts(), budget_seconds=-1)
    assert first["asked"] == 0 and first["remaining"] == 2
    assert discover_boards(db, FakeAts())["asked"] == 2


def _board(db, ticker, ats, slug, verified=True):
    db.add(
        JobBoard(
            ticker=ticker, ats=ats, slug=slug, board_name=None, verified=verified,
            active=True, discovered_at=datetime.now(timezone.utc),
        )
    )
    db.commit()


def test_collect_sums_a_companys_boards(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    _board(db, "AAA", LEVER, "aaa")
    ats = FakeAts(greenhouse={"aaa": _jobs(3)}, lever={"aaa": _jobs(4)})
    result = collect_openings(db, ats, as_of=TODAY)
    row = db.query(JobOpeningSnapshot).one()
    assert result["stored"] == 1 and row.open_count == 7 and row.verified is True
    assert {b["ats"]: b["open"] for b in row.boards} == {GREENHOUSE: 3, LEVER: 4}


def test_collect_skips_a_company_when_one_board_fails(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    _board(db, "AAA", LEVER, "aaa")
    _board(db, "BBB", GREENHOUSE, "bbb")
    ats = FakeAts(
        greenhouse={"aaa": _jobs(3), "bbb": _jobs(2)}, lever={"aaa": _jobs(4)}, fail={(LEVER, "aaa")}
    )
    result = collect_openings(db, ats, as_of=TODAY)
    assert result["stored"] == 1 and result["skipped"] == 1
    assert {r.ticker for r in db.query(JobOpeningSnapshot)} == {"BBB"}


def test_collect_is_append_only_per_day(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    collect_openings(db, FakeAts(greenhouse={"aaa": _jobs(3)}), as_of=TODAY)
    again = collect_openings(db, FakeAts(greenhouse={"aaa": _jobs(99)}), as_of=TODAY)
    assert again["stored"] == 0 and again["already_had"] == 1
    assert db.query(JobOpeningSnapshot).one().open_count == 3


def test_collect_marks_unverified_if_any_board_is_unverified(db):
    _board(db, "AAA", GREENHOUSE, "aaa", verified=True)
    _board(db, "AAA", ASHBY, "aaa", verified=False)
    collect_openings(db, FakeAts(greenhouse={"aaa": _jobs(1)}, ashby={"aaa": _jobs(1)}), as_of=TODAY)
    assert db.query(JobOpeningSnapshot).one().verified is False


def test_collect_raises_without_boards_or_when_every_board_fails(db):
    with pytest.raises(RuntimeError, match="discovery"):
        collect_openings(db, FakeAts(), as_of=TODAY)
    for i in range(10):
        _board(db, f"T{i}", GREENHOUSE, f"t{i}")
    with pytest.raises(RuntimeError, match="10 of 10 companies failed"):
        collect_openings(db, FakeAts(), as_of=TODAY)


def test_text_verification_ignores_generic_words_and_matches_whole_words():
    assert job_openings.distinctive_token("United Rentals, Inc.") == "rentals"
    assert job_openings.distinctive_token("American Express") == "express"
    assert job_openings.distinctive_token("First Solar") == "solar"
    assert job_openings.distinctive_token("United Corp") is None
    # "visa" must not be found inside "revisable"; "united" is not evidence.
    assert not text_names_company(_jobs(25, "a revisable plan"), "Visa Inc.")
    assert text_names_company(_jobs(25, "Visa is hiring"), "Visa Inc.")
    assert not text_names_company(_jobs(25, "United States only"), "United Rentals")


def test_one_transient_failure_is_retried(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    ats = FakeAts(greenhouse={"aaa": _jobs(3)}, flaky={(GREENHOUSE, "aaa")})
    assert collect_openings(db, ats, as_of=TODAY)["stored"] == 1


def test_a_board_that_is_gone_is_dropped_after_three_misses(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    _board(db, "BBB", GREENHOUSE, "bbb")
    ats = FakeAts(greenhouse={"bbb": _jobs(2)}, gone={(GREENHOUSE, "aaa")})
    for day in range(3):
        collect_openings(db, ats, as_of=TODAY + timedelta(days=day))
    assert db.query(JobBoard).filter_by(ticker="AAA").one().active is False
    assert db.query(JobBoard).filter_by(ticker="BBB").one().active is True


def test_a_recovering_board_resets_its_misses(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    _board(db, "BBB", GREENHOUSE, "bbb")
    collect_openings(db, FakeAts(greenhouse={"bbb": _jobs(1)}, gone={(GREENHOUSE, "aaa")}), as_of=TODAY)
    assert db.query(JobBoard).filter_by(ticker="AAA").one().misses == 1
    collect_openings(
        db, FakeAts(greenhouse={"aaa": _jobs(5), "bbb": _jobs(1)}), as_of=TODAY + timedelta(days=1)
    )
    assert db.query(JobBoard).filter_by(ticker="AAA").one().misses == 0


def test_an_empty_board_is_not_recorded_as_zero_for_an_established_company(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    _board(db, "BBB", GREENHOUSE, "bbb")
    collect_openings(db, FakeAts(greenhouse={"aaa": _jobs(40), "bbb": _jobs(1)}), as_of=TODAY)
    result = collect_openings(
        db, FakeAts(greenhouse={"aaa": [], "bbb": []}), as_of=TODAY + timedelta(days=1)
    )
    # AAA had 40, so a zero is suspect; BBB was already tiny, so it is believed.
    assert result["suspicious_zero"] == 1 and result["stored"] == 1
    rows = {r.ticker: r.open_count for r in db.query(JobOpeningSnapshot).filter(
        JobOpeningSnapshot.as_of == TODAY + timedelta(days=1))}
    assert rows == {"BBB": 0}


def test_a_new_company_with_zero_postings_is_not_recorded(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    result = collect_openings(db, FakeAts(greenhouse={"aaa": []}), as_of=TODAY)
    assert result["suspicious_zero"] == 1 and db.query(JobOpeningSnapshot).count() == 0


def test_mostly_failed_day_raises_after_storing_what_it_got(db):
    for i in range(10):
        _board(db, f"T{i:02d}", GREENHOUSE, f"t{i}")
    ats = FakeAts(greenhouse={f"t{i}": _jobs(2) for i in range(10)}, fail={(GREENHOUSE, f"t{i}") for i in range(4)})
    with pytest.raises(RuntimeError, match="4 of 10"):
        collect_openings(db, ats, as_of=TODAY)
    assert db.query(JobOpeningSnapshot).count() == 6


def test_one_ats_failing_entirely_raises(db):
    for i in range(5):
        _board(db, f"L{i}", LEVER, f"l{i}")
    for i in range(20):
        _board(db, f"G{i:02d}", GREENHOUSE, f"g{i}")
    ats = FakeAts(
        greenhouse={f"g{i}": _jobs(2) for i in range(20)},
        lever={f"l{i}": _jobs(2) for i in range(5)},
        fail={(LEVER, f"l{i}") for i in range(5)},
    )
    with pytest.raises(RuntimeError, match="every lever board failed"):
        collect_openings(db, ats, as_of=TODAY)


def test_collect_budget_leaves_the_rest_unfinished_without_failing(db):
    for i in range(3):
        _board(db, f"T{i}", GREENHOUSE, f"t{i}")
    result = collect_openings(
        db, FakeAts(greenhouse={f"t{i}": _jobs(2) for i in range(3)}), as_of=TODAY, budget_seconds=-1
    )
    assert result["unfinished"] == 3 and result["stored"] == 0


def test_overlapping_run_loses_quietly_on_the_unique_key(db):
    _board(db, "AAA", GREENHOUSE, "aaa")

    class Racing(FakeAts):
        def jobs(self, ats, slug):
            # The other run lands its row while this one is mid-fetch.
            if not db.query(JobOpeningSnapshot).count():
                db.add(JobOpeningSnapshot(ticker="AAA", as_of=TODAY, open_count=9, verified=True, boards=[]))
                db.commit()
            return super().jobs(ats, slug)

    result = collect_openings(db, Racing(greenhouse={"aaa": _jobs(3)}), as_of=TODAY)
    assert result["stored"] == 0 and result["already_had"] == 1
    assert db.query(JobOpeningSnapshot).one().open_count == 9


def test_share_class_representative_does_not_depend_on_what_is_held(db):
    _stocks(db, [("GOOGL", "Alphabet Inc."), ("GOOG", "Alphabet Inc."), ("BRK-B", "Berkshire Hathaway Inc."), ("BRK-A", "Berkshire Hathaway Inc.")])
    assert [t for t, _ in discovery_universe(db)] == ["GOOG", "BRK-A"]


def test_throttle_is_per_host(monkeypatch):
    sleeps: list[float] = []
    monkeypatch.setattr(job_openings.time, "sleep", sleeps.append)
    now = [100.0]
    monkeypatch.setattr(job_openings.time, "monotonic", lambda: now[0])

    class Resp:
        status_code = 200
        def json(self):
            return {}

    class Http:
        def get(self, url):
            return Resp()
        def close(self):
            pass

    client = job_openings.AtsClient(client=Http(), interval=0.4)
    client._get("https://boards-api.greenhouse.io/v1/boards/x")
    client._get("https://api.lever.co/v0/postings/x")  # different host: no wait
    assert sleeps == []
    client._get("https://api.lever.co/v0/postings/y")  # same host, no time passed
    assert sleeps and sleeps[0] == pytest.approx(0.4)


def test_missing_weekdays_and_coverage(db):
    _board(db, "AAA", GREENHOUSE, "aaa")
    _board(db, "BBB", LEVER, "bbb", verified=False)
    for day in (date(2026, 9, 28), date(2026, 9, 30)):  # Mon, Wed; Tue missing
        db.add(JobOpeningSnapshot(ticker="AAA", as_of=day, open_count=5, verified=True, boards=[]))
    db.commit()
    assert missing_weekdays(db, date(2026, 10, 1)) == [date(2026, 9, 29)]
    cov = coverage(db, today=date(2026, 10, 1))
    assert cov["boards_by_ats"][GREENHOUSE] == {"verified": 1, "unverified": 0}
    assert cov["boards_by_ats"][LEVER] == {"verified": 0, "unverified": 1}
    assert cov["latest_snapshot"] == "2026-09-30" and cov["openings_in_latest"] == 5
    assert cov["missing_prior_weekdays"] == ["2026-09-29"]
