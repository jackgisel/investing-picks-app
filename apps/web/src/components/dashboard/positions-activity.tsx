"use client";

import { useState } from "react";
import Link from "next/link";
import { TRADES_LIMIT, useTrades } from "@/lib/hooks/use-trades";
import { useIsAdmin } from "@/components/dashboard/admin-context";
import {
  DataState,
  hasDataState,
  resolveDataState,
} from "@/components/ui/data-state";
import { PanelHeader } from "@/components/dashboard/data-table";
import { CompanyLogo } from "@/components/ui/company-logo";
import { formatWeekdayDate } from "@/lib/portfolio";
import { actionMeta } from "./trade-action";
import { groupTradesByEvaluation } from "./positions-model";

const GROUPS_PER_PAGE = 6;

/**
 * What each strategy run did, newest first.
 *
 * The strategy trades in evaluation cycles, and a flat log of fills made the
 * reader rebuild those cycles by eye from matching dates. Each block here is
 * one run: every buy, trim and exit it made, with the reason it gave.
 */
export function PositionsActivity({
  onSelect,
}: {
  onSelect: (ticker: string) => void;
}) {
  const { data, isPending, isError, error, refetch } = useTrades();
  const isAdmin = useIsAdmin();
  const trades = data?.trades;
  // The API returns at most TRADES_LIMIT rows and no grand total, so a full
  // page means there are probably more we are not showing.
  const truncated = (trades?.length ?? 0) >= TRADES_LIMIT;
  const groups = groupTradesByEvaluation(trades ?? []);
  const [shown, setShown] = useState(GROUPS_PER_PAGE);

  const state = resolveDataState({
    isPending,
    isError,
    error,
    isEmpty: groups.length === 0,
  });

  return (
    <div className="data-panel">
      <PanelHeader label="Recent evaluations" tone="lilac">
        <span className="font-mono text-[10px] text-text-dim">
          {isPending || isError
            ? "—"
            : `${truncated ? "LAST " : ""}${trades?.length ?? 0} TRADES`}
        </span>
      </PanelHeader>

      {hasDataState(state) ? (
        <DataState
          state={state}
          error={error}
          onRetry={() => void refetch()}
          emptyTitle="No trades yet"
          emptyMessage="The live book was entered by hand, so there is no trade history behind it. Every buy and sell from here on will be logged here."
          compact
        />
      ) : (
        <ol>
          {groups.slice(0, shown).map((g) => (
            <li key={g.key} className="border-b border-border last:border-b-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pb-2 pt-4">
                <span className="font-sans text-[13px] font-semibold text-text">
                  {formatWeekdayDate(g.date) ?? g.date}
                </span>
                <span className="flex items-center gap-3 font-mono text-[10px] text-text-dim">
                  {g.trades.length} {g.trades.length === 1 ? "trade" : "trades"}
                  {g.evaluationId === null ? (
                    <span>seeded by hand</span>
                  ) : isAdmin ? (
                    <Link
                      href={`/dashboard/ops/evaluations/${g.evaluationId}`}
                      className="text-text underline underline-offset-2 hover:opacity-70"
                    >
                      EVAL #{g.evaluationId}
                    </Link>
                  ) : null}
                </span>
              </div>
              <ul className="pb-2">
                {g.trades.map((t, i) => {
                  const meta = actionMeta(t);
                  return (
                    <li key={`${t.ticker}-${t.date}-${i}`}>
                      <button
                        type="button"
                        onClick={() => onSelect(t.ticker)}
                        className="flex w-full items-start gap-3 px-5 py-2 text-left transition-colors hover:bg-bg-tertiary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-text"
                      >
                        <span className="w-[92px] shrink-0">
                          <span className={`badge ${meta.badge}`}>{meta.label}</span>
                        </span>
                        <span className="flex w-[84px] shrink-0 items-center gap-2 font-mono text-[13px] font-semibold text-text">
                          <CompanyLogo ticker={t.ticker} size="xs" />
                          {t.ticker}
                        </span>
                        <span className="min-w-0 flex-1 font-sans text-[12px] leading-snug text-text-muted">
                          {t.reason || "—"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {groups.length > shown && (
        <div className="border-t border-border px-5 py-3 text-center">
          <button
            type="button"
            onClick={() => setShown(shown + GROUPS_PER_PAGE)}
            className="font-sans text-[10px] font-bold tracking-[0.1em] text-text-dim hover:text-text"
          >
            SHOW EARLIER RUNS ({groups.length - shown} MORE)
          </button>
        </div>
      )}
    </div>
  );
}
