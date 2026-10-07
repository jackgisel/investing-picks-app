import type { Metadata } from "next";
import Link from "next/link";
import { BoardTable } from "@/components/challenge/board-table";
import { EntryCta } from "@/components/challenge/entry-cta";
import { getBoard, type Board } from "@/lib/challenge/db";
import {
  CHALLENGE_PATH,
  cohortFor,
  cohortLabel,
  formatPts,
  HOLD_YEARS,
  isCohort,
  MAX_PICKS,
  MIN_PICKS,
  nyDate,
} from "@/lib/challenge/rules";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

// The board moves once a night when the closes land; ten minutes is plenty.
export const revalidate = 600;

const TITLE = "Beat the S&P 500: a free stock picking game";
const DESCRIPTION = `Pick ${MIN_PICKS} to ${MAX_PICKS} stocks, lock them in, and see if they beat the S&P 500. Scored every trading day for ${HOLD_YEARS} years on a public leaderboard. Free.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${CHALLENGE_PATH}` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}${CHALLENGE_PATH}`,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does the Beat the S&P 500 challenge work?",
    a: `You pick ${MIN_PICKS} to ${MAX_PICKS} US listed stocks and lock them in. Each one gets an equal share of an imaginary portfolio at the first market close after you submit. We track that portfolio against the S&P 500 (SPY, bought at the same close) every trading day for ${HOLD_YEARS} years.`,
  },
  {
    q: "Can I change my picks?",
    a: "No. The portfolio is never rebalanced and never edited. That is the whole test: most people can find a stock that beat the index last year, far fewer can hold a portfolio that beats it for a decade.",
  },
  {
    q: "Why do I need at least 15 stocks?",
    a: "Below about 15, one lucky stock decides the result. Fifteen is enough that the board says something about how someone picks, not just whether they caught one winner.",
  },
  {
    q: "Which stocks are allowed?",
    a: "US listed operating companies worth at least $300 million. Funds and ETFs are out, and so is SPY itself.",
  },
  {
    q: "How often can I enter?",
    a: "Once per calendar quarter. Each quarter's entries form a class, so you can compare your picks with people who started at the same time.",
  },
  {
    q: "What happens if a company is bought out or delisted?",
    a: "The stock is held at its last traded price for the rest of the ten years, as if the proceeds sat in cash.",
  },
  {
    q: "Does it cost anything?",
    a: "No. It is free, there is no real money involved, and you need a free Outpick account only so we can tie the entry to you.",
  },
];

async function load(cohort: string | null): Promise<Board | null> {
  try {
    return await getBoard({ cohort });
  } catch (e) {
    console.error("challenge board failed to load:", e);
    return null;
  }
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const sp = await searchParams;
  const cohort = isCohort(sp.class) ? sp.class : null;
  const data = await load(cohort);
  const thisClass = cohortFor(nyDate(new Date()));

  const rows = data?.rows ?? [];
  const stats = data?.stats;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const tab =
    "press rounded-pill border px-4 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.08em]";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-border">
        <div className="container-op py-14 sm:py-20">
          <p className="section-label section-label-yellow">Free game</p>
          <h1 className="font-sans text-[40px] sm:text-[56px] font-extrabold leading-[1.02] tracking-tight max-w-[820px] uppercase">
            Can your picks beat the S&amp;P 500?
          </h1>
          <p className="mt-6 max-w-[620px] font-sans text-[18px] leading-relaxed text-text-muted">
            Pick {MIN_PICKS} to {MAX_PICKS} stocks. They lock in at the next market
            close and we score them against the index every trading day for{" "}
            {HOLD_YEARS} years. No money, no edits, and everyone can see the
            leaderboard.
          </p>
          <EntryCta className="mt-8" />

          <dl className="mt-12 grid max-w-[720px] grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { label: "Entries", value: (stats?.entries ?? 0).toLocaleString("en-US") },
              {
                label: "Beating the S&P",
                value: stats?.scored ? `${Math.round((stats.beating / stats.scored) * 100)}%` : "—",
              },
              { label: "Median vs S&P", value: formatPts(stats?.median_excess) },
              { label: "Open class", value: cohortLabel(thisClass) },
            ].map((s) => (
              <div key={s.label}>
                <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
                  {s.label}
                </dt>
                <dd className="mt-1 font-mono text-[22px] font-semibold text-text">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-12">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-sans text-[24px] font-bold tracking-tight">Leaderboard</h2>
              <p className="mt-1 max-w-[620px] font-sans text-[14px] text-text-muted">
                Ranked by how far each portfolio is ahead of the S&amp;P 500 over the
                same days.
                {data?.as_of ? ` Prices as of the close on ${longDate(data.as_of)}.` : ""}
                {data?.basis === "total_return"
                  ? " Both sides include dividends."
                  : data?.basis === "price"
                    ? " Both sides are price only, without dividends."
                    : ""}
              </p>
            </div>
          </div>

          {data && data.cohorts.length > 0 && (
            <nav aria-label="Class" className="mb-6 flex flex-wrap gap-2">
              <Link
                href={CHALLENGE_PATH}
                scroll={false}
                aria-current={!cohort ? "page" : undefined}
                className={cn(
                  tab,
                  !cohort
                    ? "border-transparent bg-inverse text-inverse-fg"
                    : "border-border-strong bg-bg text-text hover:bg-bg-secondary",
                )}
              >
                All classes
              </Link>
              {data.cohorts.map((c) => (
                <Link
                  key={c}
                  href={`${CHALLENGE_PATH}?class=${c}`}
                  scroll={false}
                  aria-current={c === cohort ? "page" : undefined}
                  className={cn(
                    tab,
                    c === cohort
                      ? "border-transparent bg-inverse text-inverse-fg"
                      : "border-border-strong bg-bg text-text hover:bg-bg-secondary",
                  )}
                >
                  {cohortLabel(c)}
                </Link>
              ))}
            </nav>
          )}

          {!data ? (
            <p className="font-sans text-[15px] text-text-muted">
              The leaderboard is not loading right now. Try again in a moment.
            </p>
          ) : rows.length === 0 ? (
            <div className="rounded-soft border border-border bg-bg-secondary px-6 py-10">
              <p className="font-sans text-[17px] font-semibold text-text">
                Nobody has entered {cohort ? `the ${cohortLabel(cohort)} class` : "yet"}.
              </p>
              <p className="mt-1 max-w-[520px] font-sans text-[14px] text-text-muted">
                The first entry sits at the top of the board until someone beats it.
              </p>
            </div>
          ) : (
            <BoardTable rows={rows.slice(0, 100)} showClass={!cohort} />
          )}
        </div>
      </section>

      {data && data.popular.length > 0 && (
        <section className="border-b border-border">
          <div className="container-op py-12">
            <h2 className="font-sans text-[22px] font-bold tracking-tight">Most picked stocks</h2>
            <p className="mt-1 mb-6 font-sans text-[14px] text-text-muted">
              How many entries hold each one.
            </p>
            <ol className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {data.popular.map((p, i) => (
                <li
                  key={p.ticker}
                  className="flex items-baseline gap-3 border-b border-border/70 py-2.5"
                >
                  <span className="w-6 font-mono text-[12px] text-text-dim">{i + 1}</span>
                  <span className="font-mono text-[14px] font-semibold text-text">{p.ticker}</span>
                  <span className="truncate font-sans text-[13px] text-text-muted">{p.name}</span>
                  <span className="ml-auto font-mono text-[13px] text-text">{p.entries}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <section className="border-b border-border bg-bg-secondary/40">
        <div className="container-op py-14">
          <h2 className="mb-8 font-sans text-[24px] font-bold tracking-tight">How it works</h2>
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "1",
                t: `Pick ${MIN_PICKS} to ${MAX_PICKS} stocks`,
                d: "Any US listed company worth $300 million or more. Search by ticker or name.",
              },
              {
                n: "2",
                t: "Lock them in",
                d: "Each stock gets an equal share. The clock starts at the next market close, so nobody can buy at a price they already saw.",
              },
              {
                n: "3",
                t: "We score it every night",
                d: "After each close we mark your portfolio and the S&P 500 from the same starting day.",
              },
              {
                n: "4",
                t: `Come back for ${HOLD_YEARS} years`,
                d: "Nothing is rebalanced. Winners grow into a bigger share, losers shrink, as in a real account you never touch.",
              },
            ].map((s) => (
              <li key={s.n} className="soft-card">
                <span className="font-mono text-[13px] text-text-dim">{s.n}</span>
                <p className="mt-2 font-sans text-[17px] font-bold text-text">{s.t}</p>
                <p className="mt-2 font-sans text-[14px] leading-relaxed text-text-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-14 max-w-[760px]">
          <h2 className="mb-6 font-sans text-[24px] font-bold tracking-tight">Rules and questions</h2>
          <dl className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-sans text-[16px] font-semibold text-text">{f.q}</dt>
                <dd className="mt-1.5 font-sans text-[15px] leading-relaxed text-text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-12">
          <div className="soft-card max-w-[760px]">
            <p className="section-label">Do your homework</p>
            <h2 className="font-sans text-[22px] font-bold tracking-tight">
              Research before you lock it in
            </h2>
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-text-muted">
              Look up any company&apos;s headcount and revenue per employee, or run a
              stock through the free valuation worksheets.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/companies" className="btn-outline">Company data</Link>
              <Link href="/tools" className="btn-outline">All free tools</Link>
            </div>
          </div>
        </div>
      </section>

      <p className="container-op py-8 max-w-[760px] font-sans text-[12px] leading-relaxed text-text-dim">
        A game with imaginary money. Nothing here is a recommendation to buy or
        sell any stock, and past results on the board say nothing certain about
        future ones.
      </p>
    </>
  );
}
