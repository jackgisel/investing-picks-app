import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryChart } from "@/components/challenge/entry-chart";
import { ShareEntry } from "@/components/challenge/share-entry";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { HScroll } from "@/components/ui/h-scroll";
import { ensureMigrations } from "@/lib/auth";
import { getBoard, getEntry, getEntrySeries } from "@/lib/challenge/db";
import {
  annualized,
  CHALLENGE_PATH,
  cohortLabel,
  daysBetween,
  endDate,
  ENTER_PATH,
  entryPath,
  formatPct,
  formatPts,
  pickContribution,
} from "@/lib/challenge/rules";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatCompactUsd } from "@/lib/market-cap";
import { cn } from "@/lib/utils";

type Params = { id: string };

export const revalidate = 600;

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function price(v: number | null): string {
  return v === null ? "—" : `$${v.toFixed(2)}`;
}

function tone(v: number | null) {
  if (v === null) return "text-text";
  return v >= 0 ? "text-accent-green" : "text-accent-red";
}

async function load(id: string) {
  await ensureMigrations();
  const entry = await getEntry(id);
  if (!entry || entry.hidden) return null;
  return entry;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const entry = await load(id).catch(() => null);
  if (!entry) return { robots: { index: false, follow: false } };
  const title = `${entry.display_name}'s Beat the S&P 500 portfolio`;
  const description = `${entry.picks.length} stocks locked in against the S&P 500 for ten years, in the ${cohortLabel(entry.cohort)} class.`;
  return {
    title,
    description,
    // Entries are for sharing, not for search: the hub is the page that ranks.
    robots: { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}${entryPath(entry.id)}` },
    openGraph: { title, description, url: `${SITE_URL}${entryPath(entry.id)}`, siteName: SITE_NAME },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const entry = await load(id);
  if (!entry) notFound();

  const started = entry.start_date !== null && entry.as_of !== null;
  const ret = started
    ? entry.picks.reduce((s, p) => s + p.growth, 0) / entry.picks.length - 1
    : null;
  const spyRet =
    started && entry.spy_start && entry.spy_last ? entry.spy_last / entry.spy_start - 1 : null;
  const excess = ret !== null && spyRet !== null ? ret - spyRet : null;
  const days = started ? daysBetween(entry.start_date!, entry.as_of!) : 0;

  const [series, board] = started
    ? await Promise.all([
        getEntrySeries(entry.id, entry.start_date!),
        getBoard({ cohort: entry.cohort }),
      ])
    : [[], null];
  const ranked = board?.rows.filter((r) => r.excess !== null) ?? [];
  const rank = ranked.findIndex((r) => r.id === entry.id) + 1;

  const url = `${SITE_URL}${entryPath(entry.id)}`;
  const shareText =
    excess !== null
      ? `My ${entry.picks.length} stock portfolio is ${formatPts(excess)} against the S&P 500 so far. Ten years to go.`
      : `I just locked in ${entry.picks.length} stocks to beat the S&P 500 over the next ten years.`;

  const th =
    "py-3 px-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim whitespace-nowrap";

  return (
    <>
      <section className="border-b border-border">
        <div className="container-op pt-8 pb-12">
          <Breadcrumbs
            items={[
              { label: "Beat the S&P 500", href: CHALLENGE_PATH },
              { label: cohortLabel(entry.cohort), href: `${CHALLENGE_PATH}?class=${entry.cohort}` },
              { label: entry.display_name, href: entryPath(entry.id) },
            ]}
            className="mb-10"
          />

          {isNew && (
            <div className="mb-8 rounded-soft border border-accent-mint/60 bg-accent-mint/10 p-5">
              <p className="font-sans text-[16px] font-semibold text-text">You are in.</p>
              <p className="mt-1 max-w-[620px] font-sans text-[14px] leading-relaxed text-text-muted">
                Your {entry.picks.length} stocks start at the first market close after{" "}
                {longDate(entry.submitted_on)}. We mark them after every close from
                then on. Bookmark this page, or share it so someone can hold you to it.
              </p>
            </div>
          )}

          <p className="section-label section-label-yellow">{cohortLabel(entry.cohort)} class</p>
          <h1 className="font-sans text-[34px] sm:text-[44px] font-extrabold leading-[1.1] tracking-tight">
            {entry.display_name}
          </h1>
          <p className="mt-3 font-sans text-[15px] text-text-muted">
            {entry.picks.length} stocks ·{" "}
            {started
              ? `started ${longDate(entry.start_date!)} · runs to ${longDate(endDate(entry.start_date!))}`
              : `submitted ${longDate(entry.submitted_on)} · starts at the next market close`}
          </p>

          <div className="mt-8 grid max-w-[860px] grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Portfolio", value: formatPct(ret), cls: tone(ret) },
              { label: "S&P 500", value: formatPct(spyRet), cls: "text-text" },
              { label: "Vs S&P", value: formatPts(excess), cls: tone(excess) },
              {
                label: annualized(ret, days) !== null ? "Per year" : "Class rank",
                value:
                  annualized(ret, days) !== null
                    ? formatPct(annualized(ret, days))
                    : rank > 0
                      ? `${rank} of ${ranked.length}`
                      : "—",
                cls: "text-text",
              },
            ].map((t) => (
              <div key={t.label} className="data-card">
                <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
                  {t.label}
                </p>
                <p className={cn("mt-2 font-mono text-[24px] font-semibold", t.cls)}>{t.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <ShareEntry url={url} text={shareText} />
          </div>
        </div>
      </section>

      {started && (
        <section className="border-b border-border">
          <div className="container-op py-12 max-w-[860px]">
            <h2 className="mb-1 font-sans text-[22px] font-bold tracking-tight">
              $10,000 in each, from the same close
            </h2>
            <p className="mb-6 font-sans text-[14px] text-text-muted">
              Prices as of the close on {longDate(entry.as_of!)}.
              {entry.basis === "total_return"
                ? " Dividends included on both sides."
                : entry.basis === "price"
                  ? " Price only on both sides, without dividends."
                  : ""}
            </p>
            <EntryChart points={series} />
          </div>
        </section>
      )}

      <section className="border-b border-border">
        <div className="container-op py-12">
          <h2 className="mb-6 font-sans text-[22px] font-bold tracking-tight">The picks</h2>
          <HScroll innerClassName="pr-7">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <th className={th}>Company</th>
                  <th className={th}>Sector</th>
                  <th className={cn(th, "text-right")}>Market value</th>
                  <th className={cn(th, "text-right")}>Start</th>
                  <th className={cn(th, "text-right")}>Last</th>
                  <th className={cn(th, "text-right")}>Return</th>
                  <th className={cn(th, "text-right")}>Adds to total</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {entry.picks.map((p) => {
                  const r = started && p.start && p.last ? p.growth - 1 : null;
                  return (
                    <tr key={p.ticker} className="border-b border-border/70">
                      <td className="py-3 px-3">
                        <span className="font-semibold text-text">{p.ticker}</span>
                        <span className="block max-w-[240px] truncate font-sans text-[12px] text-text-muted">
                          {p.name}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-sans text-[12px] text-text-muted whitespace-nowrap">{p.sector}</td>
                      <td className="py-3 px-3 text-right text-text-muted">{formatCompactUsd(p.market_cap)}</td>
                      <td className="py-3 px-3 text-right">{price(p.start)}</td>
                      <td className="py-3 px-3 text-right">{price(p.last)}</td>
                      <td className={cn("py-3 px-3 text-right font-semibold", tone(r))}>{formatPct(r)}</td>
                      <td className="py-3 px-3 text-right text-text-muted">
                        {started ? formatPts(pickContribution(p, entry.picks.length)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </HScroll>
          <p className="mt-4 max-w-[720px] font-sans text-[12px] leading-relaxed text-text-dim">
            Every stock started at the same weight. &quot;Adds to total&quot; is that
            stock&apos;s share of the portfolio return, in percentage points. Prices
            are adjusted for splits, so the start price can differ from the
            price quoted on the day.
          </p>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-12 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-[560px]">
            <h2 className="font-sans text-[22px] font-bold tracking-tight">Think you can do better?</h2>
            <p className="mt-1 font-sans text-[14px] text-text-muted">
              Lock in your own {entry.picks.length >= 15 ? "15 or more" : ""} stocks and see
              where you land on the board.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={ENTER_PATH} className="btn-primary">Build your portfolio</Link>
            <Link href={CHALLENGE_PATH} className="btn-outline">See the leaderboard</Link>
          </div>
        </div>
      </section>
    </>
  );
}
