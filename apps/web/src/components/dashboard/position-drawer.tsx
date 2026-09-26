"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { FileText, X } from "lucide-react";
import { useStrategy } from "@/lib/hooks/use-strategy";
import { usePicks } from "@/lib/hooks/use-picks";
import { useTrades } from "@/lib/hooks/use-trades";
import { useInsights } from "@/lib/hooks/use-insights";
import { insightForTicker } from "@/lib/insights";
import { CompanyLogo } from "@/components/ui/company-logo";
import {
  calendarDaysHeld,
  formatDayMonth,
  formatPctOrDash,
  pnlClass,
} from "@/lib/portfolio";
import { formatCompactUsd, marketCapTier } from "@/lib/market-cap";
import { describeOpenRating } from "./open-rating";
import { asShareOfInvested } from "./sector-model";
import { actionMeta } from "./trade-action";
import { PositionFundamentals } from "./position-fundamentals";
import { tradesForTicker } from "./positions-model";

function heldBetween(entry: string, exit: string | null): string {
  if (!exit) return "—";
  const a = new Date(entry).getTime();
  const b = new Date(exit).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return "—";
  return `${Math.max(0, Math.floor((b - a) / 86400000))}d`;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="field-label">{label}</dt>
      <dd className="mt-1 font-mono text-[13px] tabular-nums text-text">
        {children}
      </dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border px-5 py-5">
      <h3 className="mb-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Everything about one name in one place: the position, the company's
 * latest numbers, and every trade the strategy made in it.
 *
 * These used to be three tabs, each with its own copy of the row. All of it
 * is already in the page's queries, so opening the drawer fetches nothing.
 */
export function PositionDrawer({
  ticker,
  onClose,
}: {
  ticker: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // Held in a ref so a new onClose identity from the page does not re-run
  // the mount effect — that would steal focus back to the close button.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  const strategy = useStrategy().data;
  const activePicks = usePicks("active").data;
  const closedPicks = usePicks("closed").data?.picks ?? [];
  const tradesQuery = useTrades();
  const insights = useInsights().data?.insights ?? [];

  const holding = strategy?.holdings
    ? asShareOfInvested(strategy.holdings).find((h) => h.ticker === ticker)
    : undefined;
  const stints = closedPicks
    .filter((p) => p.ticker === ticker)
    .sort((a, b) => (b.exit_date ?? "").localeCompare(a.exit_date ?? ""));
  const trades = tradesForTicker(tradesQuery.data?.trades ?? [], ticker);
  const slug =
    stints.find((p) => p.blog_slug)?.blog_slug ??
    insightForTicker(insights, ticker)?.slug;

  const ratingDate = formatDayMonth(activePicks?.rating_as_of ?? null);
  const rating = holding
    ? describeOpenRating({
        signal: activePicks?.picks.find((p) => p.ticker === ticker)?.signal,
        entryDate: holding.entry_date,
        minHoldingDays:
          typeof strategy?.params?.min_holding_days === "number"
            ? strategy.params.min_holding_days
            : null,
        ratingAsOf: ratingDate,
      })
    : null;
  const held = holding ? calendarDaysHeld(holding.entry_date) : null;
  const tier = marketCapTier(holding?.market_cap);

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="position-drawer-title"
        className="absolute inset-y-0 right-0 flex w-full flex-col overflow-y-auto border-l border-border bg-bg shadow-2xl sm:max-w-[500px]"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-bg px-5 py-4">
          <CompanyLogo ticker={ticker} size="md" />
          <div className="min-w-0 flex-1">
            <h2
              id="position-drawer-title"
              className="font-mono text-[18px] font-semibold leading-tight text-text"
            >
              {ticker}
            </h2>
            <p className="truncate font-sans text-[12px] text-text-dim">
              {[holding?.name, holding?.sector?.trim()].filter(Boolean).join(" · ") ||
                (holding ? "Open position" : "Closed position")}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-2 text-text-dim hover:bg-bg-tertiary hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text"
          >
            <X size={18} />
          </button>
        </header>

        {holding && rating ? (
          <div className="px-5 py-5">
            <div className="flex items-baseline gap-3">
              <span
                className={`font-mono text-[28px] font-bold tabular-nums ${pnlClass(holding.pnl_pct)}`}
              >
                {formatPctOrDash(holding.pnl_pct)}
              </span>
              <span className="font-sans text-[12px] text-text-dim">
                unrealized vs cost
              </span>
              {holding.is_house_money && (
                <span
                  className="badge badge-buy !px-2 !text-[9px]"
                  title="A Winners Circle partial sell already recovered the original stake. This position is running on profit."
                >
                  House
                </span>
              )}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Fact label="WEIGHT">
                {typeof holding.weight_pct === "number"
                  ? `${holding.weight_pct.toFixed(1)}%`
                  : "—"}
              </Fact>
              <Fact label="HELD">{held === null ? "—" : `${held}d`}</Fact>
              <Fact label="ENTRY">{formatDayMonth(holding.entry_date) ?? "—"}</Fact>
              <Fact label="MARKET CAP">
                {formatCompactUsd(holding.market_cap)}
                {tier && (
                  <span className="ml-1 font-sans text-[10px] text-text-dim">
                    {tier}
                  </span>
                )}
              </Fact>
            </dl>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="field-label">RATING</span>
              {rating.kind === "unrated" ? (
                <span className="font-mono text-[11px] text-text-dim">
                  {rating.label}
                </span>
              ) : (
                <span className={`badge ${rating.badgeClass}`}>{rating.label}</span>
              )}
              {ratingDate && (
                <span className="font-mono text-[10px] text-text-dim">
                  as of {ratingDate}
                </span>
              )}
            </div>
            <p className="mt-2 font-sans text-[11px] leading-relaxed text-text-dim">
              {rating.detail ? `${rating.detail}. ` : ""}
              {rating.title}
            </p>
          </div>
        ) : null}

        {stints.length > 0 && (
          <Section title={holding ? "Earlier positions" : "Closed"}>
            <ul className="space-y-4">
              {stints.map((p, i) => (
                <li key={`${p.entry_date}-${i}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`font-mono text-[16px] font-semibold tabular-nums ${pnlClass(p.pnl_pct)}`}
                    >
                      {formatPctOrDash(p.pnl_pct, 1)}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-text-dim">
                      {p.entry_date} → {p.exit_date ?? "—"} ·{" "}
                      {heldBetween(p.entry_date, p.exit_date)}
                    </span>
                  </div>
                  {p.exit_reason && (
                    <p className="mt-1 font-sans text-[12px] leading-snug text-text-muted">
                      {p.exit_reason}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {slug && (
          <div className="border-t border-border px-5 py-4">
            <Link
              href={`/dashboard/insights/${slug}`}
              className="inline-flex items-center gap-2 font-sans text-[13px] font-semibold text-text underline underline-offset-4 hover:opacity-70"
            >
              <FileText size={14} className="text-accent-lilac" />
              Read the research note
            </Link>
          </div>
        )}

        {holding && (
          <Section title="Fundamentals">
            {holding.fundamentals ? (
              <PositionFundamentals holding={holding} />
            ) : (
              <p className="font-sans text-[12px] text-text-dim">
                No fundamentals yet. Reported growth and analyst consensus
                appear after the next fundamentals refresh.
              </p>
            )}
          </Section>
        )}

        <Section title="Trade history">
          {tradesQuery.isPending ? (
            <span className="block h-4 w-40 animate-pulse rounded bg-bg-tertiary" />
          ) : trades.length === 0 ? (
            <p className="font-sans text-[12px] text-text-dim">
              No logged trades. Positions in the hand-entered seed book predate
              the trade ledger.
            </p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {trades.map((t, i) => {
                const meta = actionMeta(t);
                return (
                  <li key={`${t.date}-${i}`} className="relative">
                    <span
                      className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-border-strong"
                      aria-hidden
                    />
                    <div className="flex items-center gap-2">
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                      <span className="font-mono text-[11px] text-text-dim">
                        {t.date.slice(0, 10)}
                      </span>
                    </div>
                    {t.reason && (
                      <p className="mt-1 font-sans text-[12px] leading-snug text-text-muted">
                        {t.reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Section>
      </aside>
    </div>
  );
}
