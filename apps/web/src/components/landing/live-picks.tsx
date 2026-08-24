"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { CompanyLogo } from "@/components/ui/company-logo";
import { PillButton } from "@/components/ui/pill-button";
import { dataQueryOptions, fetchJson } from "@/lib/hooks/api-error";
import { formatPct } from "@/lib/portfolio";
import type { LivePicksResponse } from "@/app/api/data/live-picks/route";

/**
 * The three best-performing open positions, named.
 *
 * Everywhere else the marketing site publishes percentages and withholds
 * tickers — see `anonymiseStrategy`. This section is the deliberate exception:
 * three names are worth more as proof than as secrets. The rest of the book
 * stays behind the membership, which is what the footer link says.
 *
 * Renders nothing at all when the data is unavailable rather than an empty
 * shell. It sits high on the page, and a section reading "—" under a headline
 * about live performance is worse than no section.
 */
export function LivePicks() {
  const { data, isPending } = useQuery({
    queryKey: ["live-picks"],
    queryFn: () => fetchJson<LivePicksResponse>("/api/data/live-picks"),
    staleTime: 5 * 60 * 1000,
    ...dataQueryOptions,
  });

  const picks = data?.picks ?? [];
  if (!isPending && picks.length === 0) return null;

  const held = data?.positionCount ?? 0;
  const rest = Math.max(0, held - picks.length);

  return (
    <section
      id="live-picks"
      /* Positioned for the same reason as the band above — see market-note-band. */
      className="relative z-10 border-b border-border bg-bg"
    >
      <div className="container-op py-16 sm:py-20">
        <div className="mb-9 max-w-[560px] sm:mb-11">
          <p className="section-label section-label-mint">Live book</p>
          <h2 className="section-title">
            Three positions we hold right now.
          </h2>
          <p className="section-sub mb-0">
            Real names from the live example portfolio, not a simulation.
            Returns are marked from our entry price and move with the market.
          </p>
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[168px] animate-pulse rounded-soft border border-border bg-bg-secondary/40"
              />
            ))}
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {picks.map((pick) => (
              <li
                key={pick.ticker}
                className="flex flex-col rounded-soft border border-border bg-bg p-6"
              >
                <div className="flex items-start gap-3.5">
                  <CompanyLogo ticker={pick.ticker} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[15px] font-bold tracking-tight text-text">
                      {pick.ticker}
                    </p>
                    {pick.name ? (
                      <p className="mt-0.5 truncate font-sans text-[13px] text-text-muted">
                        {pick.name}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p
                  className={`mt-6 font-sans text-[30px] font-extrabold leading-none tracking-tight tabular-nums ${
                    pick.pnlPct >= 0 ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {formatPct(pick.pnlPct, 1)}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[12px] text-text-dim">
                  {pick.sector ? <span>{pick.sector}</span> : null}
                  {pick.sector && pick.entryDate ? (
                    <span aria-hidden>·</span>
                  ) : null}
                  {pick.entryDate ? (
                    <span>Held since {formatEntryMonth(pick.entryDate)}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-9 flex flex-wrap items-center gap-4">
          <PillButton href="/pricing" arrow>
            {rest > 0
              ? `Unlock the other ${rest} positions`
              : "See membership"}
          </PillButton>
          <Link
            href="/track-record"
            className="rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
          >
            Full track record →
          </Link>
        </div>
      </div>
    </section>
  );
}

/** `2026-04-01` → `April 2026`. UTC, so the date cannot slip a day west of GMT. */
function formatEntryMonth(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
