"""Phase 2: historical ingest, PIT stamps, membership labels, live export."""

from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path

import pytest

from app.db.models import (
    ConsensusSnapshot,
    Delisting,
    Filing,
    Fundamentals,
    MarketCapHistory,
    PriceBar,
    Stock,
    UniverseMembership,
)
from worker.backtest.export import export_live_vintages
from worker.backtest.ingest import ingest_dataset, ingest_ticker
from worker.backtest.manifest import sha256_file, write_manifest
from worker.backtest.membership import write_universe_membership
from worker.backtest.pit import filing_available_from
from worker.backtest.store import open_dataset
from worker.services.fmp import FMPAccessError


class DatasetFMP:
    def __init__(self):
        self.screener = [
            {"symbol": "AAA", "price": 20.0, "marketCap": 2_000_000_000},
            {"symbol": "SMALL", "price": 6.0, "marketCap": 80_000_000},  # below floor
        ]
        self.delisted = [
            {
                "symbol": "DEAD",
                "delistedDate": "2026-03-01",
                "companyName": "Dead Co",
            }
        ]
        self.prices = {
            "AAA": [
                {"date": "2026-09-04", "adjClose": 20.0, "close": 20.0},
                {"date": "2026-08-21", "adjClose": 19.0, "close": 19.0},
                {"date": "2026-08-07", "adjClose": 18.0, "close": 18.0},
            ],
            "DEAD": [],  # no history — log and drop
        }
        self.income = {
            "AAA": [
                {
                    "date": "2026-06-30",
                    "acceptedDate": "2026-08-01 09:00:00",
                    "revenue": 100,
                    "netIncome": 10,
                    "weightedAverageShsOutDil": 1000,
                }
            ]
        }
        self.balance = {
            "AAA": [
                {
                    "date": "2026-06-30",
                    "acceptedDate": "2026-08-01 17:30:00",
                    "totalAssets": 500,
                }
            ]
        }
        self.cashflow = {"AAA": []}
        self.mcaps = {
            "AAA": [
                {"date": "2026-09-04", "marketCap": 2_000_000_000},
                {"date": "2026-08-21", "marketCap": 1_900_000_000},
                {"date": "2026-08-07", "marketCap": 1_800_000_000},
            ]
        }
        self.earnings_rows = {"AAA": [{"date": "2026-08-01", "epsActual": 1.2}]}
        self.profiles = {
            "AAA": {
                "companyName": "Aaa Inc",
                "sector": "Technology",
                "country": "US",
                "isEtf": False,
                "marketCap": 2_000_000_000,
            }
        }

    def stock_screener(self, min_market_cap, limit):
        return [r for r in self.screener if (r.get("marketCap") or 0) >= min_market_cap]

    def delisted_companies(self, page=0, limit=100):
        return self.delisted if page == 0 else []

    def historical_prices(self, ticker, from_date=None):
        return list(self.prices.get(ticker, []))

    def income_statement_quarterly(self, ticker, limit=12):
        return list(self.income.get(ticker, []))

    def balance_sheet_quarterly(self, ticker, limit=12):
        return list(self.balance.get(ticker, []))

    def cash_flow_quarterly(self, ticker, limit=12):
        return list(self.cashflow.get(ticker, []))

    def historical_market_cap(self, ticker, from_date=None, to_date=None):
        return list(self.mcaps.get(ticker, []))

    def earnings(self, ticker, limit=16):
        return list(self.earnings_rows.get(ticker, []))

    def profile(self, ticker):
        return self.profiles.get(ticker)

    def analyst_estimates(self, ticker):
        return []


def test_filing_available_from_uses_accepted_date_not_period():
    row = {
        "date": "2026-06-30",
        "acceptedDate": "2026-08-01 09:00:00",
        "fillingDate": "2026-07-31",
    }
    assert filing_available_from(row) == date(2026, 8, 1)


def test_filing_available_from_shifts_after_the_close():
    row = {"date": "2026-06-30", "acceptedDate": "2026-08-01 16:00:00"}
    assert filing_available_from(row) == date(2026, 8, 2)


def test_ingest_is_idempotent_and_drops_delisted_without_prices(tmp_path):
    db = open_dataset(tmp_path / "dataset.sqlite")
    fmp = DatasetFMP()
    start, end = date(2026, 8, 1), date(2026, 9, 11)
    first = ingest_dataset(db, fmp, start=start, end=end, resume=False)
    second = ingest_dataset(db, fmp, start=start, end=end, resume=True)
    assert first["dropped_no_prices_count"] == 1
    assert "DEAD" in first["dropped_no_prices"]
    assert db.query(Delisting).filter(Delisting.ticker == "DEAD").one().date == date(
        2026, 3, 1
    )
    # Resume skips AAA (already has bars) so ingested count drops.
    assert second["skipped_resume"] >= 1
    assert db.query(PriceBar).filter(PriceBar.ticker == "AAA").count() == 3
    filing = (
        db.query(Filing)
        .filter(Filing.ticker == "AAA", Filing.statement_type == "income")
        .one()
    )
    assert filing.period == date(2026, 6, 30)
    assert filing.available_from == date(2026, 8, 1)
    after_close = (
        db.query(Filing)
        .filter(Filing.ticker == "AAA", Filing.statement_type == "balance")
        .one()
    )
    assert after_close.available_from == date(2026, 8, 2)
    assert db.get(Stock, "AAA").sector == "Technology"
    db.close()


def test_membership_labels_segment_a_until_snapshots_exist(tmp_path):
    db = open_dataset(tmp_path / "dataset.sqlite")
    fmp = DatasetFMP()
    ingest_dataset(db, fmp, start=date(2026, 8, 1), end=date(2026, 9, 11), resume=False)
    rows = db.query(UniverseMembership).all()
    assert rows
    assert {r.universe_scope for r in rows} == {"top400_live"}
    assert {r.ticker for r in rows} == {"AAA"}
    db.close()


def test_membership_flips_to_full_once_snapshots_are_five_days_old(tmp_path):
    db = open_dataset(tmp_path / "dataset.sqlite")
    fmp = DatasetFMP()
    ingest_dataset(db, fmp, start=date(2026, 8, 1), end=date(2026, 9, 11), resume=False)
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=date(2026, 8, 1),
            fiscal_period=date(2026, 12, 31),
            eps_avg=2.0,
            revenue_avg=1000.0,
            raw={},
        )
    )
    db.commit()
    write_universe_membership(db, date(2026, 8, 1), date(2026, 9, 11))
    by_friday = {r.as_of: r.universe_scope for r in db.query(UniverseMembership).all()}
    # 7 Aug is 6 days after the first vintage → full. 21 Aug / 4 Sep too.
    assert by_friday[date(2026, 8, 7)] == "full"
    assert by_friday[date(2026, 8, 21)] == "full"
    db.close()


def test_export_copies_live_vintages_without_duplicating(tmp_path, db):
    db.add(
        ConsensusSnapshot(
            ticker="AAA",
            as_of=date(2026, 9, 11),
            fiscal_period=date(2026, 12, 31),
            eps_avg=2.1,
            revenue_avg=1100.0,
            raw={"date": "2026-12-31"},
        )
    )
    db.add(
        Fundamentals(
            ticker="AAA",
            as_of=date(2026, 9, 5),
            data={"epsEstimateAvg": 2.0, "estimatePeriod": "2026-12-31"},
        )
    )
    db.commit()
    dest = open_dataset(tmp_path / "dataset.sqlite")
    first = export_live_vintages(db, dest)
    second = export_live_vintages(db, dest)
    assert first["consensus_snapshots"] == 1
    assert first["fundamentals"] == 1
    assert dest.query(ConsensusSnapshot).count() == 1
    assert dest.query(Fundamentals).one().data["epsEstimateAvg"] == 2.0
    assert second["consensus_snapshots"] == 1  # attempted, skipped
    dest.close()


def test_manifest_hashes_the_file(tmp_path):
    path = tmp_path / "dataset-v1.sqlite"
    path.write_bytes(b"abc")
    manifest = tmp_path / "manifest.json"
    payload = write_manifest(path, manifest)
    assert payload["sha256"] == sha256_file(path)
    assert payload["bytes"] == 3
    assert '"sha256"' in manifest.read_text()


def test_ingest_stops_on_plan_restriction(tmp_path):
    db = open_dataset(tmp_path / "dataset.sqlite")

    class Boom(DatasetFMP):
        def historical_prices(self, ticker, from_date=None):
            raise FMPAccessError("402")

    with pytest.raises(FMPAccessError):
        ingest_ticker(db, Boom(), "AAA", date(2026, 1, 1), date(2026, 9, 11))
    db.close()


def test_cli_hash_roundtrip(tmp_path):
    from worker.backtest.__main__ import main

    path = tmp_path / "dataset-v1.sqlite"
    path.write_bytes(b"xyz")
    manifest = tmp_path / "manifest.json"
    assert main(["hash", "--dataset", str(path), "--manifest", str(manifest)]) == 0
    assert "xyz" not in manifest.read_text()  # hash, not contents
    assert Path(manifest).exists()
