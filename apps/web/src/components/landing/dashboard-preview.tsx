"use client";

import { BACKTEST, FINAL_HOLDINGS, WINNERS_CIRCLE } from "@/lib/constants";
import { PillButton } from "@/components/ui/pill-button";
import { useSession } from "@/lib/auth-client";
import { CompanyLogo } from "@/components/ui/company-logo";
import { HScroll } from "@/components/ui/h-scroll";

/**
 * Every figure here is from the backtrained model — simulated, not a live
 * account. It's all shown in full to everyone: FINAL_HOLDINGS and
 * WINNERS_CIRCLE are compile-time constants that ship in the client bundle
 * regardless of session state, so gating their visibility was theater, not a
 * boundary. The live example portfolio and current picks are the real
 * members-only surface, enforced server-side in lib/api-gate.ts.
 */
export function DashboardPreview() {
  const { data: session } = useSession();
  const unlocked = Boolean(session?.user);

  return (
    <section id="performance" className="relative border-b border-border overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg-secondary/60 to-transparent"
      />

      <div className="container-op relative py-20 sm:py-24">
        <div className="mb-10 sm:mb-12 max-w-[540px]">
          <p className="section-label section-label-yellow">Backtrained model · simulated</p>
          <h2 className="section-title">
            Every name, winners and losers.
          </h2>
          <p className="section-sub mb-0">
            The simulation&apos;s final holdings. Nothing gated, nothing
            held back for a paywall. The live book is members-only.
          </p>
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
              <span className="badge !text-[12px] !py-1.5 text-accent-green bg-accent-green-soft">
                <span className="font-mono">{BACKTEST.totalReturn}</span> simulated
              </span>
              <span className="badge !text-[12px] !py-1.5 text-text-muted bg-bg-tertiary">
                SPY <span className="font-mono">{BACKTEST.spyReturn}</span>
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="divide-y divide-border md:hidden">
              {FINAL_HOLDINGS.map((h, i) => {
                const isNegative = h.ret.startsWith("-");
                return (
                  <div
                    key={`${h.ticker}-${i}`}
                    className="flex items-start justify-between gap-3 px-5 py-3.5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="font-mono text-[11px] text-text-dim">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <CompanyLogo ticker={h.ticker} size="xs" />
                      <span className="min-w-0">
                        <span className="block font-mono text-[14px] font-semibold">
                          {h.ticker}
                        </span>
                        <span className="block font-mono text-[11px] text-text-dim">
                          {h.entry}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`block font-mono text-[13px] font-semibold ${
                          isNegative ? "text-accent-red" : "text-accent-green"
                        }`}
                      >
                        {h.ret}
                      </span>
                      <span className="block font-mono text-[11px] text-text-dim">
                        {h.fromPeak} from peak
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
            <HScroll className="hidden md:block">
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
                  {FINAL_HOLDINGS.map((h, i) => {
                    const isNegative = h.ret.startsWith("-");
                    return (
                      <tr
                        key={`${h.ticker}-${i}`}
                        className={`border-b border-border/80 last:border-b-0 ${
                          i % 2 === 0 ? "bg-bg-secondary/15" : ""
                        }`}
                      >
                        <td className="px-6 py-3.5 font-mono text-[11px] text-text-dim">
                          {String(i + 1).padStart(2, "0")}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="flex items-center gap-2.5 font-mono text-[14px] font-semibold">
                            <CompanyLogo ticker={h.ticker} size="xs" />
                            <span>{h.ticker}</span>
                          </span>
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
            </HScroll>

            {/* Winners row */}
            <div className="border-t border-border px-6 sm:px-7 py-5 bg-bg-secondary/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <p className="font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-text-dim">
                  Winners circle — picks that doubled
                </p>
                <span className="font-mono text-[13px] text-accent-green font-bold">
                  {BACKTEST.winnersCircle} total · {BACKTEST.wins}W /{" "}
                  {BACKTEST.losses}L of {BACKTEST.closedPicks} closed picks
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {WINNERS_CIRCLE.map((w, i) => {
                  return (
                    <span
                      key={`${w.ticker}-${w.entry}-${i}`}
                      className="inline-flex items-center gap-2 rounded-pill border border-border bg-bg px-3 py-1.5"
                    >
                      <CompanyLogo ticker={w.ticker} size="xxs" />
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

            {/* Everything above is shown in full — nothing gated on session. */}
            <div className="relative border-t border-border">
              <div className="text-center py-8 sm:py-10 px-6">
                <p className="font-sans text-[14px] text-text-muted mb-1">
                  That&apos;s the backtrained model&apos;s final snapshot —{" "}
                  {FINAL_HOLDINGS.length} positions, winners and losers, as
                  the simulation ended. Sharpe {BACKTEST.sharpe} · max
                  drawdown {BACKTEST.maxDrawdown}.
                </p>
                <p className="font-sans text-[12px] text-text-dim mb-5">
                  The live example portfolio and current picks are
                  members-only.
                </p>
                {unlocked ? (
                  <PillButton href="/#pricing" arrow>
                    See membership
                  </PillButton>
                ) : (
                  <div className="flex flex-wrap gap-3 justify-center">
                    <PillButton href="/login" arrow>
                      Create a free account
                    </PillButton>
                    <PillButton href="/#pricing" variant="outline">
                      See membership
                    </PillButton>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
