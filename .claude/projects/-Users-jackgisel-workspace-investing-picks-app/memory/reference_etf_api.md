---
name: ETF backtest API
description: External API at etf.jackgisel.com serving backtest data, strategy stats, picks, trades, and chart series for Outpick
type: reference
---

Base URL: `https://etf.jackgisel.com/api/v1`

| Endpoint | Description |
|---|---|
| `GET /strategy` | Dashboard hero data: backtest stats (+282%, 21% CAGR, 0.65 Sharpe, 56% win rate, 7yr), 16 merged holdings (13 live + 3 backtest-only: APP, NUTX, TIGR) |
| `GET /chart` | 1,763 daily data points (Apr 2019 – Apr 2026) for performance chart |
| `GET /picks?status=active` | Current holdings (live + backtest) |
| `GET /picks?status=closed` | Historical closed trades with P&L |
| `GET /trades?limit=20` | Recent trade log (247 backtest trades + live) |
| `GET /performance` | Detailed backtest summary + series |

All public, no auth required.
