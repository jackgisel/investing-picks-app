export const SITE_NAME = "Outpick";
export const SITE_URL = "https://outpick.xyz";
/** Human inbox. Product mail still sends from email@ via Resend. */
export const SUPPORT_EMAIL = "hello@outpick.xyz";
export const SITE_TAGLINE = "Intentional investing beyond the index.";
export const SITE_SUBHEADLINE =
  "Value-based stock research for investors who outgrew index funds.";
export const SITE_DESCRIPTION =
  "Outpick is a stock research team for investors who outgrew index funds. Value-based research into businesses worth owning for years — one name every two weeks, a live book you can audit, and a written note every time a position closes.";

export const PRICING = {
  annual: 1000,
  foundersAnnual: 250,
  currency: "USD",
  label: "$1,000 / year",
  foundersLabel: "$250 / year",
};

/** Founders pricing is available through this UTC calendar date, inclusive. */
export const FOUNDERS_DEAL_ENDS_ISO = "2026-12-01";
export const FOUNDERS_DEAL_ENDS_LABEL = "December 1, 2026";

// Historical backtest: Jun 15, 2022 — Apr 06, 2026 (~3.8 years)
// Walk-forward validation: parameters trained on Jun 2022 — Jul 2024,
// tested on unseen data Jul 2024 — Apr 2026.
// Strategy: COMBINED — best weights + best Outpick-style
// NOTE: We intentionally express everything as percentages — no portfolio
// dollar values, entry/exit prices, or P&L in dollars. Returns are what
// matters; absolute capital is a customer's own decision.
// We do not publish a CAGR/annualized figure for the backtrained model. A
// 3.8-year cumulative return compared against the S&P's cumulative return
// over the same window is apples-to-apples; converting one side to an
// annualized rate and not the other produced a real bug (see git history).
// Cumulative-to-cumulative is also the honest match for "outpicking the
// index" — the comparison this whole product is built around.
export const BACKTEST = {
  label: "COMBINED: best weights + best Outpick-style",
  startDate: "Jun 15, 2022",
  endDate: "Apr 06, 2026",
  // Jun 15, 2022 — Apr 06, 2026 is 3.81 years. Keep these two in sync with
  // startDate/endDate above; they are rendered as performance claims.
  yearsCovered: 3.8,
  yearsLabel: "3.8-year trailing history",
  totalReturn: "+250.39%",
  spyReturn: "+83.34%",
  // Cumulative excess return over the S&P (totalReturn − spyReturn). This is
  // NOT risk-adjusted alpha — do not call it "alpha" in copy.
  outpickedSp: "+167.0%",
  sharpe: "1.14",
  maxDrawdown: "-27.38%",
  maxDrawdownDate: "2025-04-08",
  winRate: "66%",
  wins: 35,
  losses: 18,
  // wins + losses. The win-rate denominator — always show this next to the
  // rate, never `trades`, which counts individual executions instead.
  closedPicks: 53,
  // Individual buy/sell executions across those 53 picks — a pick can be
  // trimmed or added to more than once. Not the win-rate denominator.
  trades: 132,
  // Distinct positions that doubled — see WINNERS_CIRCLE. Must equal
  // WINNERS_CIRCLE.length; there is a script check in scripts/.
  winnersCircle: 5,
  doubledMinReturnPct: 100,
  // Validation period (out-of-sample only). Cumulative excess return over
  // the S&P during the held-out window — see the note above on "alpha".
  validationOutpickedSp: "+67%",
  validationStart: "Jul 2024",
  validationEnd: "Apr 2026",
};

// The single benefit list for the membership — shown on the pricing card
// (pre-purchase) and in account settings (post-purchase). These used to be
// two independently hand-written lists that drifted apart. Describe the
// research process, not the drafting stack.
export const MEMBERSHIP_BENEFITS = [
  "A new high-conviction pick every two weeks — fundamentals, revisions, a written thesis, and review before it publishes",
  "Live example portfolio with full position tracking",
  "Complete investment theses — evidence and risks, not just a call",
  "Performance tracked against the S&P 500, wins and losses both shown",
  "Email alerts on new picks",
  `${BACKTEST.yearsCovered}-year backtrained model + live example portfolio`,
];

// Live portfolio.
//
// NOTE: `inceptionISO` is a FALLBACK ONLY. The source of truth is
// `portfolios.inception_date` in the database, editable at
// /dashboard/ops/positions and served by GET /api/portfolio-meta. Read it with
// `useInceptionDate()` (@/lib/hooks/use-inception) rather than this constant.
export const LIVE_PORTFOLIO = {
  inceptionDate: "Apr 01, 2026",
  inceptionISO: "2026-04-01",
  status: "LIVE" as const,
};

// Positions that doubled during the backtest.
//
// One position can exit in several tranches — the strategy trims winners and
// recycles the proceeds rather than closing all at once. The raw backtest log
// therefore contains eight doubling *exits*, but only five doubling
// *positions*: AVGO exited three times and YPF twice, each from a single
// entry. Counting the tranches made "8 picks doubled" a headline claim that
// showed the same ticker three times over.
//
// `ret` is the best realized tranche for that position. A blended
// position-level return would be more precise but needs the per-tranche share
// counts, which are not in this repo.
//
// `exits` records how many times each position was sold out of, so the
// trimming behaviour can still be described honestly in copy — see
// WINNERS_CIRCLE_EXITS below.
export const WINNERS_CIRCLE = [
  { ticker: "YPF",  entry: "2023-11-20", exit: "2025-01-06", ret: "+199.87%", exits: 2 },
  { ticker: "TGS",  entry: "2023-02-21", exit: "2026-01-05", ret: "+189.83%", exits: 1 },
  { ticker: "BMA",  entry: "2023-12-04", exit: "2024-09-16", ret: "+179.01%", exits: 1 },
  { ticker: "IRS",  entry: "2023-07-17", exit: "2025-06-02", ret: "+160.98%", exits: 1 },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2025-03-03", ret: "+128.40%", exits: 3 },
];

/** Doubling exits, counting each trim separately. */
export const WINNERS_CIRCLE_EXITS = WINNERS_CIRCLE.reduce(
  (n, w) => n + w.exits,
  0,
);

// Final holdings at end of backtest (16 positions)
export const FINAL_HOLDINGS = [
  { ticker: "CRS",  entry: "2024-01-02", ret: "+470.68%", fromPeak: "-5.2%" },
  { ticker: "IRS",  entry: "2022-12-19", ret: "+306.42%", fromPeak: "-8.9%" },
  { ticker: "AGI",  entry: "2024-08-05", ret: "+174.58%", fromPeak: "-16.4%" },
  { ticker: "AEM",  entry: "2025-01-21", ret: "+139.7%",  fromPeak: "-16.8%" },
  { ticker: "ASA",  entry: "2025-03-17", ret: "+125.4%",  fromPeak: "-21.9%" },
  { ticker: "FIX",  entry: "2025-10-20", ret: "+70.77%",  fromPeak: "-3.0%" },
  { ticker: "CPRX", entry: "2024-03-04", ret: "+47.96%",  fromPeak: "-6.1%" },
  { ticker: "IAG",  entry: "2025-11-17", ret: "+40.18%",  fromPeak: "-23.0%" },
  { ticker: "ORLA", entry: "2025-04-07", ret: "+34.77%",  fromPeak: "-20.6%" },
  { ticker: "STX",  entry: "2025-10-06", ret: "+29.54%",  fromPeak: "0.0%" },
  { ticker: "TKC",  entry: "2023-08-21", ret: "+25.88%",  fromPeak: "-22.1%" },
  { ticker: "PTGX", entry: "2026-01-05", ret: "+22.84%",  fromPeak: "-1.9%" },
  { ticker: "KYIV", entry: "2025-01-06", ret: "+2.26%",   fromPeak: "-32.5%" },
  { ticker: "NVDA", entry: "2026-03-16", ret: "-3.25%",   fromPeak: "-3.2%" },
  { ticker: "NUTX", entry: "2025-08-18", ret: "-7.51%",   fromPeak: "-46.7%" },
  { ticker: "SEZL", entry: "2025-02-03", ret: "-42.91%",  fromPeak: "-62.0%" },
];
