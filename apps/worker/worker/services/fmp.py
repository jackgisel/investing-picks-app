"""FMP HTTP client — fundamentals + prices only (no Alpaca)."""

from __future__ import annotations

import logging
import time
from datetime import date, datetime, timezone

import httpx

log = logging.getLogger(__name__)


class FMPClient:
    def __init__(self, api_key: str, base_url: str, rate_limit: int = 280):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._min_interval = 60.0 / max(rate_limit, 1)
        self._last_call = 0.0
        self._client = httpx.Client(timeout=30.0)

    def _get(self, path: str, params: dict | None = None) -> list | dict | None:
        if not self.api_key:
            log.warning("FMP_API_KEY not set — skipping %s", path)
            return None
        now = time.monotonic()
        wait = self._min_interval - (now - self._last_call)
        if wait > 0:
            time.sleep(wait)
        params = dict(params or {})
        params["apikey"] = self.api_key
        url = f"{self.base_url}/{path.lstrip('/')}"
        self._last_call = time.monotonic()
        try:
            r = self._client.get(url, params=params)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            log.error("FMP %s failed: %s", path, e)
            return None

    def stock_screener(self, min_market_cap: float = 300_000_000, limit: int = 1000) -> list[dict]:
        data = self._get(
            "stock-screener",
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
        data = self._get(f"profile/{ticker}")
        if isinstance(data, list) and data:
            return data[0]
        return None

    def quote(self, ticker: str) -> dict | None:
        data = self._get(f"quote/{ticker}")
        if isinstance(data, list) and data:
            return data[0]
        return None

    def batch_quotes(self, tickers: list[str]) -> list[dict]:
        if not tickers:
            return []
        # FMP allows comma-separated quotes
        out: list[dict] = []
        for i in range(0, len(tickers), 50):
            chunk = ",".join(tickers[i : i + 50])
            data = self._get(f"quote/{chunk}")
            if isinstance(data, list):
                out.extend(data)
        return out

    def historical_prices(self, ticker: str, from_date: date | None = None) -> list[dict]:
        params = {}
        if from_date:
            params["from"] = from_date.isoformat()
        data = self._get(f"historical-price-full/{ticker}", params)
        if isinstance(data, dict):
            return data.get("historical") or []
        return []

    def key_metrics_ttm(self, ticker: str) -> dict | None:
        data = self._get(f"key-metrics-ttm/{ticker}")
        if isinstance(data, list) and data:
            return data[0]
        return None

    def ratios_ttm(self, ticker: str) -> dict | None:
        data = self._get(f"ratios-ttm/{ticker}")
        if isinstance(data, list) and data:
            return data[0]
        return None

    def analyst_estimates(self, ticker: str) -> list[dict]:
        data = self._get(f"analyst-estimates/{ticker}")
        return data if isinstance(data, list) else []

    def close(self):
        self._client.close()
