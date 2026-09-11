"""FMP HTTP client — fundamentals + prices only (no Alpaca).

Targets FMP's `/stable` API. The legacy `/api/v3` endpoints this client
originally used have been retired and now return:

    403 {"Error Message": "Legacy Endpoint : Due to Legacy endpoints being no
    longer supported - This endpoint is only available to legacy users"}

The two API generations differ in shape, not just in path:
  - v3 passed the symbol as a PATH segment (`/quote/AAPL`); stable passes it as
    a QUERY parameter (`/quote?symbol=AAPL`).
  - v3's historical endpoint returned `{"historical": [...]}`; stable returns a
    bare list.
  - Analyst estimate fields lost their `estimated` prefix
    (`estimatedEpsAvg` -> `epsAvg`).
"""

from __future__ import annotations

import logging
import time
from datetime import date

import httpx

from worker.jobs.deadline import JobDeadline

log = logging.getLogger(__name__)

# httpx logs every request's full URL at INFO, and FMP takes the credential as
# an `apikey` QUERY parameter — so under the worker's INFO-level basicConfig
# every single call wrote the live key in plaintext to the platform log, ~1700
# times per refresh. This module's own messages are careful never to interpolate
# a URL (see _get); silencing httpx closes the other half of the same hole.
# Set at import so it holds for any entrypoint that touches FMP, not just the
# worker's scheduler.
logging.getLogger("httpx").setLevel(logging.WARNING)

DEFAULT_BASE_URL = "https://financialmodelingprep.com/stable"


class FMPAccessError(RuntimeError):
    """The key is rejected or the endpoint is not on the current plan.

    Distinct from "no data": a 401/402/403 means every subsequent call will
    fail the same way, so jobs must surface it instead of silently recording a
    successful run that fetched nothing. An entire deployment's worth of
    scheduled jobs previously "succeeded" with zero rows because the legacy
    endpoints 403'd and the error was swallowed.
    """


class FMPClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        rate_limit: int = 60,
        max_retries: int = 4,
        deadline: JobDeadline | None = None,
    ):
        self.api_key = api_key
        base = (base_url or DEFAULT_BASE_URL).rstrip("/")
        # Tolerate a stored legacy base URL rather than 403 on every call.
        if base.endswith("/api/v3"):
            log.warning(
                "FMP base URL %s is the retired legacy API; using %s instead",
                base,
                DEFAULT_BASE_URL,
            )
            base = DEFAULT_BASE_URL
        self.base_url = base
        self._min_interval = 60.0 / max(rate_limit, 1)
        self._last_call = 0.0
        self._max_retries = max(max_retries, 0)
        self._deadline = deadline
        self._client = httpx.Client(timeout=30.0)

    def _check_deadline(self) -> float | None:
        return self._deadline.remaining_seconds() if self._deadline else None

    def _throttle(self) -> None:
        self._check_deadline()
        wait = self._min_interval - (time.monotonic() - self._last_call)
        if wait > 0:
            if self._deadline:
                self._deadline.sleep(wait)
            else:
                time.sleep(wait)

    def _get(self, path: str, params: dict | None = None) -> list | dict | None:
        if not self.api_key:
            log.warning("FMP_API_KEY not set — skipping %s", path)
            return None

        params = {k: v for k, v in (params or {}).items() if v is not None}
        params["apikey"] = self.api_key
        url = f"{self.base_url}/{path.lstrip('/')}"

        for attempt in range(self._max_retries + 1):
            self._throttle()
            self._last_call = time.monotonic()
            try:
                remaining = self._check_deadline()
                # The request itself must not outlive the total job budget.
                request_timeout = min(30.0, remaining) if remaining else 30.0
                r = self._client.get(url, params=params, timeout=request_timeout)
            except Exception as e:
                # A request timeout at the edge of the total budget is a job
                # timeout, not an ordinary missing FMP response.
                self._check_deadline()
                # Never interpolate the response/URL directly — it carries the
                # api key as a query parameter and would land in the logs.
                log.error("FMP %s failed: %s", path, type(e).__name__)
                return None

            if r.status_code in (401, 402, 403):
                raise FMPAccessError(f"FMP {path} returned {r.status_code}")

            if r.status_code == 429:
                if attempt < self._max_retries:
                    backoff = 2.0 * (2**attempt)
                    log.warning(
                        "FMP %s rate limited; retrying in %.0fs (%s/%s)",
                        path,
                        backoff,
                        attempt + 1,
                        self._max_retries,
                    )
                    if self._deadline:
                        self._deadline.sleep(backoff)
                    else:
                        time.sleep(backoff)
                    continue
                log.error("FMP %s rate limited; giving up", path)
                return None

            if r.status_code >= 400:
                log.error("FMP %s returned %s", path, r.status_code)
                return None
            try:
                return r.json()
            except Exception:
                log.error("FMP %s returned malformed JSON", path)
                return None
        return None

    @staticmethod
    def _first(data: list | dict | None) -> dict | None:
        if isinstance(data, list) and data:
            return data[0]
        return None

    def stock_screener(
        self, min_market_cap: float = 300_000_000, limit: int = 1000
    ) -> list[dict]:
        data = self._get(
            "company-screener",
            {
                "marketCapMoreThan": int(min_market_cap),
                "volumeMoreThan": 50_000,
                "isEtf": "false",
                "isActivelyTrading": "true",
                "country": "US",
                "limit": limit,
            },
        )
        return data if isinstance(data, list) else []

    def profile(self, ticker: str) -> dict | None:
        return self._first(self._get("profile", {"symbol": ticker}))

    def quote(self, ticker: str) -> dict | None:
        return self._first(self._get("quote", {"symbol": ticker}))

    def batch_quotes(self, tickers: list[str]) -> list[dict]:
        """One request per symbol.

        `/stable/batch-quote` exists but is 402 Restricted on the current plan,
        so batching is not available to us. At the default 280 req/min this is
        ~4.6 symbols/second, which is fine for a book plus a candidate list.
        """
        out: list[dict] = []
        for ticker in tickers:
            q = self.quote(ticker)
            if q:
                out.append(q)
        return out

    def historical_prices(
        self, ticker: str, from_date: date | None = None
    ) -> list[dict]:
        data = self._get(
            "historical-price-eod/full",
            {
                "symbol": ticker,
                "from": from_date.isoformat() if from_date else None,
            },
        )
        if isinstance(data, list):
            return data
        # Defensive: older shape nested the rows under "historical".
        if isinstance(data, dict):
            return data.get("historical") or []
        return []

    def income_statement_quarterly(self, ticker: str, limit: int = 8) -> list[dict]:
        """Recent quarters, newest first, for deriving TTM growth.

        Eight quarters is the minimum for a trailing-twelve-month comparison:
        the latest four against the four before them. FMP's `financial-growth`
        endpoint is not a substitute — it is fiscal-year-over-year, so it is
        stale by up to a year, misaligned between companies with different
        fiscal calendars, and computed over a signed denominator that inverts
        for loss-makers.
        """
        data = self._get(
            "income-statement", {"symbol": ticker, "period": "quarter", "limit": limit}
        )
        return data if isinstance(data, list) else []

    def cash_flow_quarterly(self, ticker: str, limit: int = 12) -> list[dict]:
        """Recent quarterly cash-flow statements. Optional EV/EBITDA denominator."""
        data = self._get(
            "cash-flow-statement",
            {"symbol": ticker, "period": "quarter", "limit": limit},
        )
        return data if isinstance(data, list) else []

    def key_metrics_ttm(self, ticker: str) -> dict | None:
        return self._first(self._get("key-metrics-ttm", {"symbol": ticker}))

    def ratios_ttm(self, ticker: str) -> dict | None:
        return self._first(self._get("ratios-ttm", {"symbol": ticker}))

    def analyst_estimates(self, ticker: str) -> list[dict]:
        data = self._get(
            "analyst-estimates", {"symbol": ticker, "period": "annual"}
        )
        return data if isinstance(data, list) else []

    def balance_sheet_quarterly(self, ticker: str, limit: int = 12) -> list[dict]:
        """Recent quarterly balance sheets, newest first.

        Twelve quarters covers the TTM ROE/ROA/ROCE window plus a restatement
        buffer. Phase 2 ingest uses this; Phase 1 only probes that the current
        key can read it.
        """
        data = self._get(
            "balance-sheet-statement",
            {"symbol": ticker, "period": "quarter", "limit": limit},
        )
        return data if isinstance(data, list) else []

    def historical_market_cap(
        self,
        ticker: str,
        from_date: date | None = None,
        to_date: date | None = None,
    ) -> list[dict]:
        """Daily market-cap series. Date on each row is its availability date."""
        data = self._get(
            "historical-market-capitalization",
            {
                "symbol": ticker,
                "from": from_date.isoformat() if from_date else None,
                "to": to_date.isoformat() if to_date else None,
            },
        )
        return data if isinstance(data, list) else []

    def delisted_companies(self, page: int = 0, limit: int = 100) -> list[dict]:
        """US names that have left an exchange. Paginated."""
        data = self._get("delisted-companies", {"page": page, "limit": limit})
        return data if isinstance(data, list) else []

    def probe_backtest_endpoints(self, ticker: str = "AAPL") -> dict:
        """Cheap live check that Phase 2's extra FMP paths respond on this key.

        Returns `{endpoint: {ok, n, error}}`. A 401/402/403 is `ok=False` with
        the status, not an exception — the snapshot job must still complete.
        """
        probes = {
            "analyst-estimates": lambda: self.analyst_estimates(ticker),
            "balance-sheet-statement": lambda: self.balance_sheet_quarterly(
                ticker, limit=4
            ),
            "historical-market-capitalization": lambda: self.historical_market_cap(
                ticker
            ),
            "delisted-companies": lambda: self.delisted_companies(page=0, limit=10),
        }
        out: dict = {}
        for name, fetch in probes.items():
            try:
                data = fetch()
            except FMPAccessError as e:
                out[name] = {"ok": False, "n": 0, "error": str(e)}
                continue
            if isinstance(data, list):
                n = len(data)
            elif data:
                n = 1
            else:
                n = 0
            out[name] = {"ok": n > 0, "n": n, "error": None if n else "empty"}
        return out

    def earnings(self, ticker: str, limit: int = 8) -> list[dict]:
        """Recent actual-versus-estimate earnings reports for one company."""
        data = self._get("earnings", {"symbol": ticker, "limit": limit})
        return data if isinstance(data, list) else []

    def price_target_consensus(self, ticker: str) -> dict | None:
        """Analyst price-target high / low / consensus for one symbol."""
        return self._first(
            self._get("price-target-consensus", {"symbol": ticker})
        )

    def stock_news(self, symbols: list[str], limit: int = 50) -> list[dict]:
        """Recent headlines for a specific set of tickers.

        `symbols` is comma-joined into one query parameter — confirmed live
        against `/stable/news/stock` to accept a multi-symbol batch in one
        call, unlike `batch_quotes` which has to fall back to one request per
        symbol. Empty input returns without a request; there is nothing to
        scope the feed to.
        """
        if not symbols:
            return []
        data = self._get(
            "news/stock", {"symbols": ",".join(symbols), "limit": limit}
        )
        return data if isinstance(data, list) else []

    def treasury_rates(self, start: str, end: str) -> list[dict]:
        """Constant-maturity Treasury yields for a date range.

        One row per session with a column per tenor (`month1` ... `year30`),
        which is why this returns raw rows rather than a single tenor — the
        week-ahead thread wants the 2-year and the 10-year from the same
        session, and splitting that into two calls invites quoting yields
        from two different days in one sentence.
        """
        data = self._get("treasury-rates", {"from": start, "to": end})
        return data if isinstance(data, list) else []

    def economics_calendar(self, start: str, end: str) -> list[dict]:
        """Scheduled macro releases between two dates, US only.

        Filtered to `country == "US"` here rather than by query parameter:
        the stable endpoint returns the whole world and the parameter is not
        honoured on every plan, so filtering client-side is the version that
        cannot silently start including euro-area PMIs.
        """
        data = self._get("economic-calendar", {"from": start, "to": end})
        if not isinstance(data, list):
            return []
        return [row for row in data if (row.get("country") or "").upper() == "US"]

    def close(self):
        self._client.close()
