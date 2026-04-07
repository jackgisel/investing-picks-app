export const SITE_NAME = "Outpick";
export const SITE_URL = "https://outpick.com";
export const SITE_DESCRIPTION =
  "High-growth stock picks researched and tracked for you. New analysis every two weeks. Build a portfolio that beats the S&P — without becoming a day trader.";

export const PRICING = {
  annual: 1000,
  currency: "USD",
  label: "$1,000 / year",
};

// 7-year historical backtest: Apr 01, 2019 — Apr 06, 2026
// Walk-forward simulation using point-in-time annual fundamentals + historical prices.
// 90-day filing lag applied. Not indicative of future performance.
export const BACKTEST = {
  startDate: "Apr 01, 2019",
  endDate: "Apr 06, 2026",
  startingCapital: "$100,000",
  totalReturn: "+282.09%",
  cagr: "+21.06%",
  spyReturn: "+155.88%",
  alpha: "+126.2%",
  sharpe: "0.65",
  maxDrawdown: "-40.69%",
  maxDrawdownDate: "2022-09-26",
  finalValue: "$382,093",
  winRate: "56%",
  wins: 62,
  losses: 48,
  trades: 247,
  realizedPnl: "+$77,186",
  winnersCircle: 18,
};

// Live portfolio — inception April 1, 2026
export const LIVE_PORTFOLIO = {
  inceptionDate: "Apr 01, 2026",
  status: "LIVE" as const,
};

// Top winners circle entries (stocks that doubled) from backtest
export const WINNERS_CIRCLE = [
  { ticker: "BBAR", entry: "2023-09-18", exit: "2025-01-06", buy: "$4.25", sell: "$22.81", ret: "+436.71%", pnl: "+$12,765" },
  { ticker: "FTNT", entry: "2019-04-15", exit: "2024-04-15", buy: "$19.04", sell: "$64.73", ret: "+239.97%", pnl: "+$4,748" },
  { ticker: "FTNT", entry: "2019-04-15", exit: "2024-05-06", buy: "$19.04", sell: "$58.81", ret: "+208.88%", pnl: "+$3,195" },
  { ticker: "SEDG", entry: "2019-10-21", exit: "2022-05-02", buy: "$87.27", sell: "$255.31", ret: "+192.55%", pnl: "+$2,289" },
  { ticker: "TGS", entry: "2023-01-03", exit: "2026-01-05", buy: "$11.15", sell: "$30.78", ret: "+176.05%", pnl: "+$6,938" },
  { ticker: "IRS", entry: "2023-07-17", exit: "2025-06-02", buy: "$5.28", sell: "$13.78", ret: "+160.98%", pnl: "+$1,413" },
  { ticker: "GLOB", entry: "2019-11-04", exit: "2022-08-15", buy: "$94.24", sell: "$234.76", ret: "+149.11%", pnl: "+$2,884" },
  { ticker: "SEDG", entry: "2019-10-21", exit: "2022-10-17", buy: "$87.27", sell: "$197.29", ret: "+126.07%", pnl: "+$2,886" },
  { ticker: "YPF", entry: "2024-03-18", exit: "2025-01-21", buy: "$19.26", sell: "$43.35", ret: "+125.08%", pnl: "+$6,863" },
  { ticker: "AHCO", entry: "2020-02-18", exit: "2020-12-07", buy: "$16.31", sell: "$35.70", ret: "+118.88%", pnl: "+$2,723" },
  { ticker: "GGAL", entry: "2023-11-20", exit: "2025-09-15", buy: "$13.16", sell: "$28.53", ret: "+116.79%", pnl: "+$2,479" },
  { ticker: "GLOB", entry: "2019-11-04", exit: "2022-09-06", buy: "$94.24", sell: "$202.78", ret: "+115.17%", pnl: "+$1,797" },
  { ticker: "GGAL", entry: "2023-11-20", exit: "2025-10-06", buy: "$13.16", sell: "$28.29", ret: "+114.97%", pnl: "+$2,850" },
  { ticker: "BMA", entry: "2023-08-07", exit: "2025-10-06", buy: "$19.78", sell: "$42.35", ret: "+114.11%", pnl: "+$2,929" },
  { ticker: "BMA", entry: "2023-08-07", exit: "2025-09-15", buy: "$19.78", sell: "$40.90", ret: "+106.77%", pnl: "+$2,567" },
  { ticker: "BBAR", entry: "2023-09-18", exit: "2025-09-15", buy: "$4.25", sell: "$8.60", ret: "+102.35%", pnl: "+$4,674" },
  { ticker: "AVGO", entry: "2023-10-02", exit: "2024-11-18", buy: "$81.13", sell: "$163.43", ret: "+101.44%", pnl: "+$4,565" },
  { ticker: "TTD", entry: "2019-05-06", exit: "2022-08-01", buy: "$22.56", sell: "$45.43", ret: "+101.37%", pnl: "+$1,255" },
];

// Final holdings at end of backtest (also initial live portfolio positions)
export const FINAL_HOLDINGS = [
  { ticker: "CRS", entry: "2024-01-02", avgCost: "$68.49", last: "$394.82", ret: "+476.46%", pnl: "+$24,729", fromPeak: "-4.2%" },
  { ticker: "IRS", entry: "2022-12-19", avgCost: "$4.14", last: "$16.75", ret: "+304.65%", pnl: "+$31,221", fromPeak: "-9.0%" },
  { ticker: "APP", entry: "2024-05-06", avgCost: "$149.00", last: "$412.67", ret: "+176.96%", pnl: "+$9,818", fromPeak: "-43.7%" },
  { ticker: "AGI", entry: "2024-08-05", avgCost: "$16.84", last: "$46.31", ret: "+175.0%", pnl: "+$10,799", fromPeak: "-16.2%" },
  { ticker: "AEM", entry: "2025-01-21", avgCost: "$87.53", last: "$208.50", ret: "+138.2%", pnl: "+$16,273", fromPeak: "-17.3%" },
  { ticker: "ASA", entry: "2025-03-17", avgCost: "$28.15", last: "$63.33", ret: "+124.97%", pnl: "+$1,061", fromPeak: "-22.1%" },
  { ticker: "FIX", entry: "2025-10-20", avgCost: "$835.73", last: "$1431.53", ret: "+71.29%", pnl: "+$7,896", fromPeak: "-2.7%" },
  { ticker: "ORLA", entry: "2025-04-07", avgCost: "$11.06", last: "$17.42", ret: "+57.48%", pnl: "+$17,129", fromPeak: "-19.7%" },
  { ticker: "IAG", entry: "2025-11-17", avgCost: "$13.49", last: "$18.98", ret: "+40.66%", pnl: "+$4,539", fromPeak: "-22.8%" },
  { ticker: "STX", entry: "2025-10-06", avgCost: "$359.01", last: "$453.30", ret: "+26.26%", pnl: "+$12,319", fromPeak: "0.0%" },
  { ticker: "TKC", entry: "2023-08-21", avgCost: "$4.83", last: "$6.04", ret: "+25.26%", pnl: "+$1,212", fromPeak: "-22.5%" },
  { ticker: "PTGX", entry: "2026-01-05", avgCost: "$84.18", last: "$102.88", ret: "+22.21%", pnl: "+$2,040", fromPeak: "-2.4%" },
  { ticker: "NVDA", entry: "2026-03-16", avgCost: "$183.22", last: "$177.64", ret: "-3.05%", pnl: "-$390", fromPeak: "-3.0%" },
  { ticker: "NUTX", entry: "2025-08-18", avgCost: "$109.70", last: "$100.08", ret: "-8.77%", pnl: "-$2,079", fromPeak: "-47.5%" },
  { ticker: "SEZL", entry: "2025-02-03", avgCost: "$121.16", last: "$68.81", ret: "-43.21%", pnl: "-$18,616", fromPeak: "-62.2%" },
  { ticker: "TIGR", entry: "2025-09-02", avgCost: "$12.32", last: "$6.47", ret: "-47.44%", pnl: "-$2,852", fromPeak: "-50.2%" },
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

