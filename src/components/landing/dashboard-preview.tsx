import Link from "next/link";
import { BACKTEST, FINAL_HOLDINGS, WINNERS_CIRCLE } from "@/lib/constants";

// Show top 3 holdings, blur the rest
const visibleHoldings = 3;
const displayHoldings = FINAL_HOLDINGS.slice(0, 8);

// Show top 3 winners, blur the rest
const visibleWinners = 3;
const displayWinners = WINNERS_CIRCLE.slice(0, 6);

export function DashboardPreview() {
  return (
    <section id="performance" className="border-b border-border">
      <div className="container-op py-20">
        <p className="section-label">BACKTEST PORTFOLIO</p>
        <h2 className="section-title">Full transparency. Every position.</h2>
        <p className="section-sub">
          The final portfolio from our backtest. Members get this level of
          detail on every holding — past and present.
        </p>

        <div className="bg-bg-secondary border border-border overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-5 border-b border-border gap-2">
            <span className="font-mono text-[11px] text-text-dim tracking-[1.5px]">
              FINAL HOLDINGS &middot; {FINAL_HOLDINGS.length} POSITIONS
            </span>
            <span className="font-mono text-[12px] bg-accent-green-soft text-accent-green px-3.5 py-1.5 font-semibold">
              {BACKTEST.totalReturn} vs SPY {BACKTEST.spyReturn}
            </span>
          </div>

          {/* Holdings table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="font-mono text-left px-6 py-3.5 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg">
                    TICKER
                  </th>
                  <th className="font-mono text-left px-6 py-3.5 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg">
                    AVG COST
                  </th>
                  <th className="font-mono text-left px-6 py-3.5 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg">
                    LAST
                  </th>
                  <th className="font-mono text-left px-6 py-3.5 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg">
                    RETURN
                  </th>
                  <th className="font-mono text-left px-6 py-3.5 text-[10px] text-text-dim tracking-[1.5px] font-medium border-b border-border bg-bg">
                    P&L
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayHoldings.map((h, i) => {
                  const isNegative = h.ret.startsWith("-");
                  return (
                    <tr
                      key={`${h.ticker}-${i}`}
                      className={`border-b border-border last:border-b-0 ${
                        i >= visibleHoldings
                          ? "blur-[5px] select-none pointer-events-none"
                          : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-mono text-[14px] font-semibold">
                        {h.ticker}
                      </td>
                      <td className="px-6 py-4 font-mono text-[13px] text-text-muted">
                        {h.avgCost}
                      </td>
                      <td className="px-6 py-4 font-mono text-[13px]">
                        {h.last}
                      </td>
                      <td
                        className={`px-6 py-4 font-mono text-[13px] font-semibold ${
                          isNegative ? "text-accent-red" : "text-accent-green"
                        }`}
                      >
                        {h.ret}
                      </td>
                      <td
                        className={`px-6 py-4 font-mono text-[13px] ${
                          isNegative ? "text-accent-red" : "text-accent-green"
                        }`}
                      >
                        {h.pnl}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Winners Circle */}
          <div className="border-t border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <span className="font-mono text-[11px] text-text-dim tracking-[1.5px]">
                WINNERS CIRCLE — STOCKS THAT DOUBLED
              </span>
              <span className="font-mono text-[12px] text-accent-green font-semibold">
                {BACKTEST.winnersCircle} TOTAL
              </span>
            </div>
            {displayWinners.map((w, i) => (
              <div
                key={`${w.ticker}-${w.entry}-${i}`}
                className={`grid grid-cols-4 px-6 py-4 border-b border-border last:border-b-0 items-center ${
                  i >= visibleWinners
                    ? "blur-[6px] select-none pointer-events-none"
                    : ""
                }`}
              >
                <span className="font-mono font-bold text-[14px]">
                  {w.ticker}
                </span>
                <span className="font-sans text-[12px] text-text-dim">
                  {w.entry} → {w.exit}
                </span>
                <span className="font-mono text-[14px] font-bold text-accent-green text-right">
                  {w.ret}
                </span>
                <span className="font-mono text-[12px] text-text-muted text-right">
                  {w.pnl}
                </span>
              </div>
            ))}
          </div>

          {/* Unlock CTA */}
          <div className="text-center py-8 bg-gradient-to-t from-bg-secondary to-transparent -mt-10 relative z-10">
            <p className="font-sans text-[14px] text-text-muted mb-4">
              {FINAL_HOLDINGS.length - visibleHoldings} more holdings +{" "}
              {BACKTEST.winnersCircle - visibleWinners} more winners in the full
              portfolio
            </p>
            <Link href="/dashboard" className="btn-outline">
              UNLOCK FULL ACCESS →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
