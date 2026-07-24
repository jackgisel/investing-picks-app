import { BACKTEST, FINAL_HOLDINGS, WINNERS_CIRCLE } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";

const visibleHoldings = 3;
const displayHoldings = FINAL_HOLDINGS.slice(0, 8);
const visibleWinners = 3;
const displayWinners = WINNERS_CIRCLE.slice(0, 6);

export function DashboardPreview() {
  return (
    <section id="performance" className="relative border-b border-border overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg-secondary/60 to-transparent"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-8 lg:gap-12 items-end mb-10 sm:mb-12">
          <div>
            <p className="section-label">Backtest winners</p>
            <h2 className="section-title max-w-[540px]">
              Eight picks doubled. That&apos;s the edge.
            </h2>
            <p className="section-sub mb-0 max-w-[500px]">
              Total return tells part of the story. What matters is how many
              high-conviction picks become multi-baggers — and how the model
              finds them. Members see every holding, winner, and loser in full
              detail.
            </p>
          </div>

          <div className="flex flex-wrap gap-6 sm:gap-8 lg:pb-2">
            <PreviewStat label="Total return" value={BACKTEST.totalReturn} hero />
            <PreviewStat label="Win rate" value={BACKTEST.winRate} />
            <PreviewStat label="2× winners" value={BACKTEST.winnersCircle.toString()} />
          </div>
        </div>

        <div className="relative rounded-soft border border-border overflow-hidden bg-bg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 sm:px-7 py-5 border-b border-border bg-bg-secondary/35">
            <div>
              <span className="font-sans text-[10px] font-bold tracking-[0.14em] uppercase text-text-dim block mb-1">
                Final holdings snapshot
              </span>
              <span className="font-sans text-[13px] text-text-muted">
                {FINAL_HOLDINGS.length} positions · {BACKTEST.startDate} –{" "}
                {BACKTEST.endDate}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="font-mono text-[12px] font-bold text-accent-green px-3 py-1.5 rounded-pill bg-accent-green-soft">
                {BACKTEST.totalReturn} portfolio
              </span>
              <span className="font-mono text-[12px] text-text-muted px-3 py-1.5 rounded-pill bg-bg-tertiary">
                SPY {BACKTEST.spyReturn}
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="border-b border-border">
                    {["#", "Ticker", "Entry", "Return", "From peak"].map((h) => (
                      <th
                        key={h}
                        className="font-sans text-left px-6 py-3.5 text-[10px] text-text-dim tracking-[0.12em] font-bold uppercase bg-bg-secondary/20"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayHoldings.map((h, i) => {
                    const isNegative = h.ret.startsWith("-");
                    const blurred = i >= visibleHoldings;
                    return (
                      <tr
                        key={`${h.ticker}-${i}`}
                        className={`border-b border-border/80 last:border-b-0 ${
                          blurred
                            ? "blur-[5px] select-none pointer-events-none"
                            : ""
                        } ${i % 2 === 0 && !blurred ? "bg-bg-secondary/15" : ""}`}
                      >
                        <td className="px-6 py-3.5 font-mono text-[11px] text-text-dim">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[14px] font-semibold">
                          {h.ticker}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[12px] text-text-muted">
                          {h.entry}
                        </td>
                        <td
                          className={`px-6 py-3.5 font-mono text-[13px] font-semibold ${
                            isNegative ? "text-accent-red" : "text-accent-green"
                          }`}
                        >
                          {h.ret}
                        </td>
                        <td className="px-6 py-3.5 font-mono text-[12px] text-text-dim">
                          {h.fromPeak}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Winners row */}
            <div className="border-t border-border px-6 sm:px-7 py-5 bg-bg-secondary/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <p className="font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-text-dim">
                  Winners circle — stocks that doubled
                </p>
                <span className="font-mono text-[13px] text-accent-green font-bold">
                  {BACKTEST.winnersCircle} total · {BACKTEST.wins}W /{" "}
                  {BACKTEST.losses}L
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {displayWinners.map((w, i) => {
                  const blurred = i >= visibleWinners;
                  return (
                    <span
                      key={`${w.ticker}-${w.entry}-${i}`}
                      className={`inline-flex items-center gap-2 rounded-pill border border-border bg-bg px-3 py-1.5 ${
                        blurred
                          ? "blur-[5px] select-none pointer-events-none"
                          : ""
                      }`}
                    >
                      <span className="font-mono text-[12px] font-bold">
                        {w.ticker}
                      </span>
                      <span className="font-mono text-[12px] font-bold text-accent-green">
                        {w.ret}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Unlock CTA with gradient veil */}
            <div className="relative border-t border-border">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-16 h-16 bg-gradient-to-b from-transparent to-bg"
              />
              <div className="text-center py-8 sm:py-10 px-6">
                <p className="font-sans text-[14px] text-text-muted mb-1">
                  {FINAL_HOLDINGS.length - visibleHoldings} more holdings +{" "}
                  {BACKTEST.winnersCircle - visibleWinners} more winners in the
                  full portfolio
                </p>
                <p className="font-sans text-[12px] text-text-dim mb-5">
                  Sharpe {BACKTEST.sharpe} · max drawdown {BACKTEST.maxDrawdown}
                </p>
                <PillButton href="/dashboard" variant="outline" arrow>
                  Unlock full access
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewStat({
  label,
  value,
  hero = false,
}: {
  label: string;
  value: string;
  hero?: boolean;
}) {
  return (
    <div>
      <p className="font-sans text-[9px] font-bold text-text-dim tracking-[0.14em] uppercase mb-1">
        {label}
      </p>
      <p
        className={`font-mono font-bold text-accent-green leading-none ${
          hero ? "text-[28px] sm:text-[32px]" : "text-[20px]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
