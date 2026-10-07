import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { HistoryChart } from "@/components/workforce/history-chart";
import { YearBars } from "@/components/companies/year-bars";
import { MarketNoteSignup } from "@/components/marketing/market-note-signup";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { HScroll } from "@/components/ui/h-scroll";
import {
  companyPath,
  displayName,
  getCompanyDirectory,
  getCompanyHistory,
  nearestPeers,
  normalizeTicker,
  peerStats,
  sectorPath,
  shapeSentence,
} from "@/lib/companies";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatCompactUsd } from "@/lib/market-cap";
import {
  fiscalYearLabel,
  fiscalYearShort,
  formatEmployees,
  formatGrowth,
  formatOpenings,
  formatOpeningsRate,
  formatPerEmployee,
  shapeLabel,
} from "@/lib/workforce";
import { cn } from "@/lib/utils";

type Params = { ticker: string };

// Headcount changes once a year per company; a day is plenty fresh.
export const revalidate = 86400;

async function load(raw: string) {
  const ticker = normalizeTicker(raw);
  if (!ticker) return null;
  const [directory, history] = await Promise.all([
    getCompanyDirectory(),
    getCompanyHistory(ticker),
  ]);
  const company = directory?.companies.find((c) => c.ticker === ticker);
  if (!company || !history || history.series.length === 0) return null;
  return { ticker, company, history, companies: directory!.companies };
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function changeWord(v: number | null, up: string, down: string): string | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (Math.abs(v) < 0.0005) return "unchanged from a year earlier";
  return `${v > 0 ? up : down} ${Math.abs(v * 100).toFixed(1)}% from a year earlier`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { ticker: raw } = await params;
  const data = await load(raw);
  if (!data) return { robots: { index: false, follow: true } };
  const { company } = data;
  const name = displayName(company);
  const title = `${name} (${company.ticker}) employees, headcount history and revenue per employee`;
  const description = `${name} had ${formatEmployees(company.employees)} employees in fiscal ${fiscalYearLabel(company.period)}, with ${formatPerEmployee(company.rev_per_employee)} of revenue per employee. Year by year headcount and revenue from its annual reports.`;
  const url = `${SITE_URL}${companyPath(company.ticker)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function CompanyPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { ticker: raw } = await params;
  // One URL per company: /companies/aapl, never /companies/AAPL.
  if (raw !== raw.toLowerCase()) permanentRedirect(companyPath(raw));
  const data = await load(raw);
  if (!data) notFound();
  const { company, history, companies } = data;

  const name = displayName(company);
  const series = history.series;
  const latest = series[series.length - 1];
  const fy = fiscalYearLabel(latest.period);
  const stats = peerStats(companies, company);
  const peers = nearestPeers(stats, company);
  const openings = history.openings_current;
  const shape = shapeSentence(company.shape);

  const hcChange = changeWord(latest.employees_yoy, "up", "down");
  const revChange = changeWord(latest.revenue_yoy, "up", "down");

  const faq: { q: string; a: string }[] = [
    {
      q: `How many employees does ${name} have?`,
      a: `${name} reported ${formatEmployees(latest.employees)} employees for the fiscal year ending ${fy}, in the annual report it filed on ${longDate(latest.filing_date)}${hcChange ? `. That is ${hcChange}` : ""}.`,
    },
    {
      q: `What is ${name}'s revenue per employee?`,
      a: `${name} brought in ${formatCompactUsd(latest.revenue)} of revenue in fiscal ${fy}, which is ${formatPerEmployee(latest.rev_per_employee)} per employee${
        stats.rank && stats.label
          ? `. That ranks ${stats.rank} of ${stats.ranked.length} companies we track in ${stats.label}, where the median is ${formatPerEmployee(stats.median_rev_per_employee)}`
          : ""
      }.`,
    },
  ];
  if (openings.openings !== null && openings.openings_as_of) {
    faq.push({
      q: `Is ${name} hiring?`,
      a: `${name}'s public job board listed ${formatOpenings(openings.openings)} open roles on ${longDate(openings.openings_as_of)}, about ${formatOpeningsRate(openings.openings_per_1000)}.`,
    });
  }
  faq.push({
    q: "Where do these numbers come from?",
    a: "Employee counts and revenue are taken from each company's own annual report (Form 10-K). Open roles are counted from the company's public job board where we have matched one. Companies report headcount once a year, sometimes rounded, so small changes can be noise.",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const tiles: { label: string; value: string; sub: string | null }[] = [
    {
      label: "Employees",
      value: formatEmployees(latest.employees),
      sub: latest.employees_yoy !== null ? `${formatGrowth(latest.employees_yoy)} YoY` : null,
    },
    {
      label: "Revenue",
      value: formatCompactUsd(latest.revenue),
      sub: latest.revenue_yoy !== null ? `${formatGrowth(latest.revenue_yoy)} YoY` : null,
    },
    {
      label: "Revenue / employee",
      value: formatPerEmployee(latest.rev_per_employee),
      sub: stats.median_rev_per_employee
        ? `Peer median ${formatPerEmployee(stats.median_rev_per_employee)}`
        : null,
    },
    {
      label: stats.basis === "sector" ? "Rank in sector" : "Rank in industry",
      value: stats.rank ? `${stats.rank} of ${stats.ranked.length}` : "—",
      sub: stats.label,
    },
  ];
  if (openings.openings !== null) {
    tiles.push({
      label: "Open roles",
      value: formatOpenings(openings.openings),
      sub: formatOpeningsRate(openings.openings_per_1000),
    });
  }

  const crumbs = [{ label: "Companies", href: "/companies" }];
  if (company.sector) crumbs.push({ label: company.sector, href: sectorPath(company.sector) });
  crumbs.push({ label: company.ticker, href: companyPath(company.ticker) });

  const th =
    "py-3 px-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim whitespace-nowrap";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-border">
        <div className="container-op pt-8 pb-12">
          <Breadcrumbs items={crumbs} className="mb-10" />
          <p className="section-label section-label-mint">Company data</p>
          <h1 className="font-sans text-[32px] sm:text-[42px] font-extrabold leading-[1.1] tracking-tight max-w-[820px]">
            {name} employees and revenue per employee
          </h1>
          <p className="mt-3 font-sans text-[15px] text-text-muted">
            <span className="font-mono font-semibold text-text">{company.ticker}</span>
            {company.industry ? ` · ${company.industry}` : ""}
            {company.market_cap ? ` · ${formatCompactUsd(company.market_cap)} market cap` : ""}
          </p>

          <p className="mt-8 max-w-[720px] font-sans text-[17px] leading-relaxed text-text">
            {name} had <strong>{formatEmployees(latest.employees)} employees</strong> at the end
            of fiscal {fy}
            {hcChange ? `, ${hcChange}` : ""}. Revenue for the year was{" "}
            {formatCompactUsd(latest.revenue)}
            {revChange ? `, ${revChange}` : ""}, or{" "}
            <strong>{formatPerEmployee(latest.rev_per_employee)} per employee</strong>.
            {shape ? ` ${shape}` : ""}
          </p>
          {company.stale && (
            <p className="mt-3 max-w-[720px] font-sans text-[13px] text-text-dim">
              The latest annual report we hold is more than two years old, so these
              numbers may be out of date.
            </p>
          )}

          <div
            className={cn(
              "mt-8 grid grid-cols-2 gap-3",
              tiles.length > 4 ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-4",
            )}
          >
            {tiles.map((t) => (
              <div key={t.label} className="data-card">
                <p className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
                  {t.label}
                </p>
                <p className="mt-2 font-mono text-[22px] font-semibold text-text">{t.value}</p>
                {t.sub && (
                  <p className="mt-1 truncate font-sans text-[12px] text-text-muted" title={t.sub}>
                    {t.sub}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-12 space-y-8">
          <div>
            <h2 className="font-sans text-[22px] font-bold tracking-tight">
              Headcount against revenue
            </h2>
            <p className="mt-1 mb-5 max-w-[620px] font-sans text-[14px] text-text-muted">
              Both lines start at 100 in the first year we hold, so you can see
              which one grew faster.
            </p>
            <HistoryChart history={history} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <YearBars
              title="Employees, last six fiscal years"
              points={series.map((p) => ({ label: fiscalYearShort(p.period), value: p.employees }))}
              format={formatEmployees}
              color="var(--chart-headcount)"
            />
            <YearBars
              title="Revenue per employee, last six fiscal years"
              points={series.map((p) => ({
                label: fiscalYearShort(p.period),
                value: p.rev_per_employee ?? NaN,
              }))}
              format={formatPerEmployee}
              color="var(--chart-revenue)"
            />
          </div>

        </div>
      </section>

      {peers.length > 0 && (
        <section className="border-b border-border bg-bg-secondary/40">
          <div className="container-op py-12">
            <h2 className="font-sans text-[22px] font-bold tracking-tight">
              {name} against similar companies
            </h2>
            <p className="mt-1 mb-6 max-w-[620px] font-sans text-[14px] text-text-muted">
              The closest {stats.basis === "sector" ? "sector" : "industry"} peers by
              revenue, from {stats.label}.
            </p>
            <HScroll innerClassName="pr-7">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr className="border-b border-border-strong text-left">
                    <th className={th}>Company</th>
                    <th className={cn(th, "text-right")}>Employees</th>
                    <th className={cn(th, "text-right")}>Revenue</th>
                    <th className={cn(th, "text-right")}>Revenue / employee</th>
                    <th className={th}>Shape</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-[13px]">
                  {[company, ...peers]
                    .sort((a, b) => (b.rev_per_employee ?? 0) - (a.rev_per_employee ?? 0))
                    .map((c) => {
                      const self = c.ticker === company.ticker;
                      return (
                        <tr
                          key={c.ticker}
                          className={cn("border-b border-border/70", self && "bg-bg-tertiary/60")}
                        >
                          <td className="py-3 px-3">
                            {self ? (
                              <span className="font-semibold text-text">{c.ticker}</span>
                            ) : (
                              <Link
                                href={companyPath(c.ticker)}
                                className="font-semibold text-text underline-offset-2 hover:underline"
                              >
                                {c.ticker}
                              </Link>
                            )}
                            <div className="max-w-[260px] truncate font-sans text-[12px] text-text-muted">
                              {c.name}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right">{formatEmployees(c.employees)}</td>
                          <td className="py-3 px-3 text-right">{formatCompactUsd(c.revenue)}</td>
                          <td className="py-3 px-3 text-right font-semibold">
                            {formatPerEmployee(c.rev_per_employee)}
                          </td>
                          <td className="py-3 px-3 font-sans text-[12px] text-text-muted whitespace-nowrap">
                            {shapeLabel(c.shape)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </HScroll>
            {company.sector && (
              <Link href={sectorPath(company.sector)} className="btn-outline mt-6">
                Every {company.sector} company
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="border-b border-border">
        <div className="container-op py-12 max-w-[760px]">
          <h2 className="mb-6 font-sans text-[22px] font-bold tracking-tight">
            Questions about {name}
          </h2>
          <dl className="space-y-6">
            {faq.map((f) => (
              <div key={f.q}>
                <dt className="font-sans text-[16px] font-semibold text-text">{f.q}</dt>
                <dd className="mt-1.5 font-sans text-[15px] leading-relaxed text-text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="container-op py-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="soft-card">
            <p className="section-label">Free game</p>
            <h2 className="font-sans text-[22px] font-bold tracking-tight">
              Think you can pick better than the S&amp;P 500?
            </h2>
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-text-muted">
              Pick 15 stocks, lock them in, and we score them against the index
              every trading day for ten years. Free, with a public leaderboard.
            </p>
            <Link href="/tools/beat-the-sp-500" className="btn-primary mt-5">
              Enter the challenge
            </Link>
          </div>
          <MarketNoteSignup source={`company:${company.ticker}`} variant="panel" />
        </div>
      </section>

      <p className="container-op py-8 max-w-[760px] font-sans text-[12px] leading-relaxed text-text-dim">
        Source: employee counts and revenue as stated in {name}&apos;s annual
        reports (Form 10-K), latest filed {longDate(latest.filing_date)}. This
        is data, not a recommendation to buy or sell {company.ticker}.
      </p>
    </>
  );
}
