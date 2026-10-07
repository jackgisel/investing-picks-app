# Beat the S&P 500 challenge

A free game on `/tools/beat-the-sp-500`. A signed-in user (a free account is
enough) locks in 15 to 30 stocks. Each gets an equal share at the first close
after the New York calendar date of submission, and the entry is scored against
SPY bought at the same close, every trading day, for ten years. Nothing is
rebalanced or edited. One entry per user per calendar quarter; each quarter is
a "class" on the board.

## Where things live

| Piece | Where |
|---|---|
| Entries, eligibility, scoring | `apps/api/app/services/challenge.py` |
| Public reads | `GET /api/v1/challenge/{stocks,board,entries/{id}}` |
| Writes for a signed-in user (ops key) | `/api/ops/challenge/entries`, `/users/{id}/entries`, `/entries/{id}/hidden` |
| Web client and shape checks | `apps/web/src/lib/challenge/{db,rules}.ts` |
| All four tables | API `ensure_schema` (the API database) |
| Nightly prices | worker `challenge_prices`, weekdays 20:30 ET |

Everything is in the API's database because the universe (`stocks`) and the
prices live there and production's web database is a separate one. The web app
signs the user in and passes their id to the ops routes; there is no foreign
key across the two databases.

Eligible stocks: `stocks` rows that are active, not ETFs, and at least $300M in
market value.

## Prices

The worker fetches each held ticker's whole series from the earliest entry
holding it, one request per ticker. SPY goes first and sets the basis for the
run: dividend-adjusted closes when the FMP plan serves
`historical-price-eod/dividend-adjusted`, split-adjusted closes otherwise. The
board says which. If the vendor's closes for dates already stored change (a
split, or a dividend restating history), the ticker's stored series is replaced
whole, so one series never mixes two bases. A pick with no price counts as flat.
A delisted name is held at its last close.

Scores are computed on read in SQL from `challenge_price`; nothing derived is
stored.

## Ops

- Run the prices now: `POST /api/ops/challenge-prices` (resumable within a day;
  today's bar is kept only after 16:30 ET). Status is in `job_runs`.
- Hide an entry from the board (abusive name): `POST
  /api/ops/challenge/{id}` on the web app with `{"hidden": true}` as an admin
  (it calls the API's `/entries/{id}/hidden`). The entry and its picks are kept.

## Before the first real entry

Check the first nightly run's `job_runs.detail.basis`. `price` means the plan
does not serve dividend-adjusted prices and both sides are scored without
dividends.
