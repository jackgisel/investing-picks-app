import { BACKTEST } from "@/lib/constants";

const stats = [
  {
    label: "7YR RETURN",
    value: BACKTEST.totalReturn,
    sub: "backtest",
    green: true,
  },
  {
    label: "VS S&P 500",
    value: BACKTEST.alpha,
    sub: "alpha generated",
    green: true,
  },
  {
    label: "CAGR",
    value: BACKTEST.cagr,
    sub: "annualized",
    green: true,
  },
  {
    label: "WIN RATE",
    value: BACKTEST.winRate,
    sub: `${BACKTEST.wins}W / ${BACKTEST.losses}L`,
    green: false,
  },
  {
    label: "LIVE SINCE",
    value: "APR '26",
    sub: "real money",
    green: false,
    pulse: true,
  },
];

export function StatsBar() {
  return (
    <section className="border-y border-border">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 max-w-[1000px] mx-auto">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`py-7 px-7 text-center ${
              i < stats.length - 1 ? "border-r border-border" : ""
            }`}
          >
            <p className="font-mono text-[10px] text-text-dim tracking-[2px] mb-2 flex items-center justify-center gap-1.5">
              {"pulse" in stat && stat.pulse && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-green opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent-green" />
                </span>
              )}
              {stat.label}
            </p>
            <p
              className={`font-mono text-[22px] font-bold ${
                stat.green ? "text-accent-green" : "text-text"
              }`}
            >
              {stat.value}
            </p>
            <p className="font-sans text-[11px] text-text-dim mt-1">
              {stat.sub}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
