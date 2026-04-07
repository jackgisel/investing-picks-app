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
// Strategy: COMBINED — best weights + best AP-style
export const BACKTEST = {
  label: "COMBINED: best weights + best AP-style",
  startDate: "Jun 15, 2022",
  endDate: "Apr 06, 2026",
  yearsCovered: 3.8,
  startingCapital: "$100,000",
  totalReturn: "+250.39%",
  cagr: "+38.99%",
  spyReturn: "+83.34%",
  alpha: "+167.0%",
  sharpe: "1.14",
  maxDrawdown: "-27.38%",
  maxDrawdownDate: "2025-04-08",
  finalValue: "$350,389",
  winRate: "66%",
  wins: 35,
  losses: 18,
  trades: 132,
  realizedPnl: "+$66,440",
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
  { ticker: "YPF",  entry: "2023-11-20", exit: "2025-01-06", buy: "$15.01", sell: "$45.01",  ret: "+199.87%", pnl: "+$8,091" },
  { ticker: "TGS",  entry: "2023-02-21", exit: "2026-01-05", buy: "$10.62", sell: "$30.78",  ret: "+189.83%", pnl: "+$7,556" },
  { ticker: "BMA",  entry: "2023-12-04", exit: "2024-09-16", buy: "$22.96", sell: "$64.06",  ret: "+179.01%", pnl: "+$4,201" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2025-03-03", buy: "$81.13", sell: "$185.30", ret: "+128.40%", pnl: "+$3,787" },
  { ticker: "IRS",  entry: "2023-07-17", exit: "2025-06-02", buy: "$5.28",  sell: "$13.78",  ret: "+160.98%", pnl: "+$1,455" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2024-12-02", buy: "$81.13", sell: "$164.25", ret: "+102.45%", pnl: "+$1,038" },
  { ticker: "YPF",  entry: "2023-11-20", exit: "2025-01-21", buy: "$15.01", sell: "$43.35",  ret: "+188.81%", pnl: "+$412" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2025-04-21", buy: "$81.13", sell: "$164.88", ret: "+103.23%", pnl: "+$184" },
];

// Final holdings at end of backtest (16 positions)
export const FINAL_HOLDINGS = [
  { ticker: "CRS",  entry: "2024-01-02", avgCost: "$68.49",   last: "$390.86",  ret: "+470.68%", pnl: "+$22,160", fromPeak: "-5.2%" },
  { ticker: "IRS",  entry: "2022-12-19", avgCost: "$4.13",    last: "$16.77",   ret: "+306.42%", pnl: "+$28,139", fromPeak: "-8.9%" },
  { ticker: "AGI",  entry: "2024-08-05", avgCost: "$16.84",   last: "$46.24",   ret: "+174.58%", pnl: "+$8,557",  fromPeak: "-16.4%" },
  { ticker: "AEM",  entry: "2025-01-21", avgCost: "$87.53",   last: "$209.81",  ret: "+139.7%",  pnl: "+$1,349",  fromPeak: "-16.8%" },
  { ticker: "ASA",  entry: "2025-03-17", avgCost: "$28.15",   last: "$63.45",   ret: "+125.4%",  pnl: "+$8,464",  fromPeak: "-21.9%" },
  { ticker: "FIX",  entry: "2025-10-20", avgCost: "$835.73",  last: "$1427.15", ret: "+70.77%",  pnl: "+$7,316",  fromPeak: "-3.0%" },
  { ticker: "CPRX", entry: "2024-03-04", avgCost: "$16.69",   last: "$24.70",   ret: "+47.96%",  pnl: "+$2,693",  fromPeak: "-6.1%" },
  { ticker: "IAG",  entry: "2025-11-17", avgCost: "$13.49",   last: "$18.91",   ret: "+40.18%",  pnl: "+$4,203",  fromPeak: "-23.0%" },
  { ticker: "ORLA", entry: "2025-04-07", avgCost: "$12.78",   last: "$17.23",   ret: "+34.77%",  pnl: "+$13,048", fromPeak: "-20.6%" },
  { ticker: "STX",  entry: "2025-10-06", avgCost: "$359.92",  last: "$466.25",  ret: "+29.54%",  pnl: "+$12,922", fromPeak: "0.0%" },
  { ticker: "TKC",  entry: "2023-08-21", avgCost: "$4.83",    last: "$6.08",    ret: "+25.88%",  pnl: "+$1,120",  fromPeak: "-22.1%" },
  { ticker: "PTGX", entry: "2026-01-05", avgCost: "$84.18",   last: "$103.41",  ret: "+22.84%",  pnl: "+$2,237",  fromPeak: "-1.9%" },
  { ticker: "KYIV", entry: "2025-01-06", avgCost: "$10.01",   last: "$10.24",   ret: "+2.26%",   pnl: "+$235",    fromPeak: "-32.5%" },
  { ticker: "NVDA", entry: "2026-03-16", avgCost: "$183.22",  last: "$177.27",  ret: "-3.25%",   pnl: "-$380",    fromPeak: "-3.2%" },
  { ticker: "NUTX", entry: "2025-08-18", avgCost: "$109.76",  last: "$101.51",  ret: "-7.51%",   pnl: "-$1,667",  fromPeak: "-46.7%" },
  { ticker: "SEZL", entry: "2025-02-03", avgCost: "$121.19",  last: "$69.18",   ret: "-42.91%",  pnl: "-$17,202", fromPeak: "-62.0%" },
];

export const NAV_LINKS = [
  { label: "Track record", href: "/#track-record" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Performance", href: "/#performance" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const PADDLE_CLIENT_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
export const PADDLE_PRICE_ID = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "";
