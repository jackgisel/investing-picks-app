export const SITE_NAME = "Outpick";
export const SITE_URL = "https://outpick.com";
export const SITE_DESCRIPTION =
  "High-growth stock picks researched and tracked for you. New analysis every two weeks. Build a portfolio that beats the S&P — without becoming a day trader.";

export const PRICING = {
  annual: 1000,
  currency: "USD",
  label: "$1,000 / year",
};

// Historical backtest: Jun 15, 2022 — Apr 06, 2026 (~3.8 years)
// Walk-forward validation: parameters trained on Jun 2022 — Jul 2024,
// tested on unseen data Jul 2024 — Apr 2026.
// Strategy: COMBINED — best weights + best Outpick-style
// NOTE: We intentionally express everything as percentages — no portfolio
// dollar values, entry/exit prices, or P&L in dollars. Returns are what
// matters; absolute capital is a customer's own decision.
export const BACKTEST = {
  label: "COMBINED: best weights + best Outpick-style",
  startDate: "Jun 15, 2022",
  endDate: "Apr 06, 2026",
  yearsCovered: 3.8,
  totalReturn: "+250.39%",
  cagr: "+38.99%",
  spyReturn: "+83.34%",
  alpha: "+167.0%",
  sharpe: "1.14",
  maxDrawdown: "-27.38%",
  maxDrawdownDate: "2025-04-08",
  winRate: "66%",
  wins: 35,
  losses: 18,
  trades: 132,
  winnersCircle: 8,
  // Validation period (out-of-sample only)
  validationAlpha: "+67%",
  validationStart: "Jul 2024",
  validationEnd: "Apr 2026",
};

// Live portfolio — inception April 1, 2026
export const LIVE_PORTFOLIO = {
  inceptionDate: "Apr 01, 2026",
  status: "LIVE" as const,
};

// Stocks that doubled during the backtest (8 total)
export const WINNERS_CIRCLE = [
  { ticker: "YPF",  entry: "2023-11-20", exit: "2025-01-06", ret: "+199.87%" },
  { ticker: "TGS",  entry: "2023-02-21", exit: "2026-01-05", ret: "+189.83%" },
  { ticker: "BMA",  entry: "2023-12-04", exit: "2024-09-16", ret: "+179.01%" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2025-03-03", ret: "+128.40%" },
  { ticker: "IRS",  entry: "2023-07-17", exit: "2025-06-02", ret: "+160.98%" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2024-12-02", ret: "+102.45%" },
  { ticker: "YPF",  entry: "2023-11-20", exit: "2025-01-21", ret: "+188.81%" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2025-04-21", ret: "+103.23%" },
];

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

export const NAV_LINKS = [
  { label: "Track record", href: "/#track-record" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
export const PADDLE_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "";
