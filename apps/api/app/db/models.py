"""SQLAlchemy models for the virtual book and decision ledger."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base

# JSON works on Postgres and SQLite; prefer Postgres in production.


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="AP Strategy")
    cash: Mapped[float] = mapped_column(Float, default=0.0)
    peak_equity: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_drawdown_halted: Mapped[bool] = mapped_column(Boolean, default=False)
    params_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    positions: Mapped[list[Position]] = relationship(back_populates="portfolio")
    trades: Mapped[list[Trade]] = relationship(back_populates="portfolio")


class Position(Base):
    __tablename__ = "positions"
    __table_args__ = (UniqueConstraint("portfolio_id", "ticker"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(16), index=True)
    shares: Mapped[float] = mapped_column(Float)
    avg_cost: Mapped[float] = mapped_column(Float)
    current_price: Mapped[float] = mapped_column(Float, default=0.0)
    entry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    initial_investment: Mapped[float | None] = mapped_column(Float, nullable=True)
    sector: Mapped[str | None] = mapped_column(String(64), nullable=True)

    portfolio: Mapped[Portfolio] = relationship(back_populates="positions")

    @property
    def market_value(self) -> float:
        return self.shares * (self.current_price or 0.0)


class Trade(Base):
    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    evaluation_id: Mapped[int | None] = mapped_column(ForeignKey("evaluations.id"), nullable=True)
    signal_id: Mapped[int | None] = mapped_column(ForeignKey("signals.id"), nullable=True)
    ticker: Mapped[str] = mapped_column(String(16), index=True)
    side: Mapped[str] = mapped_column(String(8))  # buy | sell
    shares: Mapped[float] = mapped_column(Float)
    price: Mapped[float] = mapped_column(Float)
    notional: Mapped[float] = mapped_column(Float)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    action: Mapped[str | None] = mapped_column(String(32), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio: Mapped[Portfolio] = relationship(back_populates="trades")


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"
    __table_args__ = (UniqueConstraint("portfolio_id", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    cash: Mapped[float] = mapped_column(Float)
    invested_value: Mapped[float] = mapped_column(Float)
    total_value: Mapped[float] = mapped_column(Float)
    spy_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    position_count: Mapped[int] = mapped_column(Integer, default=0)


class Stock(Base):
    __tablename__ = "stocks"

    ticker: Mapped[str] = mapped_column(String(16), primary_key=True)
    name: Mapped[str | None] = mapped_column(String(256), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(64), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(128), nullable=True)
    market_cap: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_etf: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Fundamentals(Base):
    __tablename__ = "fundamentals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(16), index=True)
    as_of: Mapped[date] = mapped_column(Date)
    data: Mapped[dict] = mapped_column(JSON, default=dict)


class PriceBar(Base):
    __tablename__ = "price_bars"
    __table_args__ = (UniqueConstraint("ticker", "date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(16), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    close: Mapped[float] = mapped_column(Float)


class CompositeScore(Base):
    __tablename__ = "composite_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(16), index=True)
    as_of: Mapped[date] = mapped_column(Date, index=True)
    quant_rating: Mapped[float] = mapped_column(Float)
    composite: Mapped[float | None] = mapped_column(Float, nullable=True)
    valuation_grade: Mapped[str] = mapped_column(String(4), default="F")
    growth_grade: Mapped[str] = mapped_column(String(4), default="F")
    profitability_grade: Mapped[str] = mapped_column(String(4), default="F")
    momentum_grade: Mapped[str] = mapped_column(String(4), default="F")
    revisions_grade: Mapped[str] = mapped_column(String(4), default="F")
    sector: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Evaluation(Base):
    __tablename__ = "evaluations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"), index=True)
    mode: Mapped[str] = mapped_column(String(32))  # biweekly | daily | dry_run
    params_version: Mapped[str] = mapped_column(String(32))
    params_json: Mapped[dict] = mapped_column(JSON, default=dict)
    portfolio_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    executed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    signals: Mapped[list[SignalRow]] = relationship(back_populates="evaluation")


class SignalRow(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evaluation_id: Mapped[int] = mapped_column(ForeignKey("evaluations.id"), index=True)
    ticker: Mapped[str] = mapped_column(String(16), index=True)
    action: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    sell_shares: Mapped[float | None] = mapped_column(Float, nullable=True)
    keep_shares: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    executed: Mapped[bool] = mapped_column(Boolean, default=False)

    evaluation: Mapped[Evaluation] = relationship(back_populates="signals")
    reasons: Mapped[list[SignalReason]] = relationship(back_populates="signal")


class SignalReason(Base):
    __tablename__ = "signal_reasons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id"), index=True)
    rule_id: Mapped[str] = mapped_column(String(64), index=True)
    passed: Mapped[bool] = mapped_column(Boolean)
    inputs: Mapped[dict] = mapped_column(JSON, default=dict)
    threshold: Mapped[dict] = mapped_column(JSON, default=dict)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    signal: Mapped[SignalRow] = relationship(back_populates="reasons")


class JobRun(Base):
    __tablename__ = "job_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_name: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(32))
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
