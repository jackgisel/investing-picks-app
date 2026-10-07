import type { Metadata } from "next";
import Link from "next/link";
import { CompanyList } from "@/components/companies/company-list";
import { CompanySearch } from "@/components/companies/company-search";
import {
  getCompanyDirectory,
  sectorPath,
  sectorSummaries,
  type DirectoryCompany,
} from "@/lib/companies";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatCompactUsd } from "@/lib/market-cap";
import {
  formatEmployees,
  formatGrowth,
  formatPerEmployee,
  MIN_REVENUE,
} from "@/lib/workforce";

export const revalidate = 3600;

const TITLE = "Public company employee counts and revenue per employee";
const DESCRIPTION =
  "How many people work at each US listed company, how that changed year by year, and how much revenue each employee brings in. Taken from annual reports.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/companies` },
  openGraph: {
    title: `${TITLE} | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: `${SITE_URL}/companies`,
    siteName: SITE_NAME,
    type: "website",
  },
};

function top(
  list: DirectoryCompany[],
  key: (c: DirectoryCompany) => number | null,
  n = 10,
  asc = false,
) {
  return list
    .filter((c) => typeof key(c) === "number" && Number.isFinite(key(c)))
    .sort((a, b) => (asc ? key(a)! - key(b)! : key(b)! - key(a)!))
    .slice(0, n);
}

export default async function CompaniesPage() {
  const directory = await getCompanyDirectory();
  const all = directory?.companies ?? [];
  const live = all.filter((c) => !c.stale);
  // The ranked lists use the leaderboard's revenue floor, so a 40-person
  // shell company cannot top "fastest hiring" by adding 30 people.
  const sizable = live.filter((c) => c.revenue >= MIN_REVENUE);
  const sectors = sectorSummaries(all);
  const totalEmployees = live.reduce((n, c) => n + c.employees, 0);

  return (
    <>
      <section className="border-b border-border">
        <div className="container-op py-14 sm:py-16">
          <p className="section-label section-label-mint">Company data</p>
          <h1 className="font-sans text-[34px] sm:text-[44px] font-extrabold leading-[1.1] tracking-tight max-w-[820px]">
            How many people work there, and what each one brings in.
          </h1>
          <p className="mt-4 max-w-[640px] font-sans text-[17px] leading-relaxed text-text-muted">
            Year by year headcount and revenue for{" "}
            {all.length > 0 ? `${all.length.toLocaleString("en-US")} US listed companies` : "US listed companies"}
            , taken from each one&apos;s annual report. Free, and every number
            links back to the filing year it came from.
          </p>
          <CompanySearch className="mt-8" />
          {live.length > 0 && (
            <dl className="mt-10 grid max-w-[640px] grid-cols-3 gap-6">
              <div>
                <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">Companies</dt>
                <dd className="mt-1 font-mono text-[22px] font-semibold">{all.length.toLocaleString("en-US")}</dd>
              </div>
              <div>
                <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">Employees covered</dt>
                <dd className="mt-1 font-mono text-[22px] font-semibold">{formatEmployees(totalEmployees)}</dd>
              </div>
              <div>
                <dt className="font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">Sectors</dt>
                <dd className="mt-1 font-mono text-[22px] font-semibold">{sectors.length}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>

      {all.length === 0 ? (
        <section className="container-op py-14">
          <p className="font-sans text-[15px] text-text-muted">
            The company data is not loading right now. Try again in a moment.
          </p>
        </section>
      ) : (
        <>
          <section className="border-b border-border">
            <div className="container-op py-12">
              <h2 className="mb-6 font-sans text-[22px] font-bold tracking-tight">Browse by sector</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sectors.map((s) => (
                  <Link
                    key={s.slug}
                    href={sectorPath(s.sector)}
                    className="data-card group block hover:border-border-strong transition-colors"
                  >
                    <p className="font-sans text-[16px] font-bold text-text group-hover:opacity-70 transition-opacity">
                      {s.sector}
                    </p>
                    <p className="mt-2 font-sans text-[13px] text-text-muted">
                      <span className="font-mono text-text">{s.count}</span> companies ·{" "}
                      <span className="font-mono text-text">{formatPerEmployee(s.median_rev_per_employee)}</span>{" "}
                      median revenue per employee
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <section className="border-b border-border">
            <div className="container-op py-12 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CompanyList
                title="Biggest employers"
                blurb="Most employees at the latest fiscal year end."
                companies={top(live, (c) => c.employees)}
                value={(c) => formatEmployees(c.employees)}
              />
              <CompanyList
                title="Most revenue per employee"
                blurb={`Companies with at least ${formatCompactUsd(MIN_REVENUE)} in revenue.`}
                companies={top(sizable, (c) => c.rev_per_employee)}
                value={(c) => formatPerEmployee(c.rev_per_employee)}
              />
              <CompanyList
                title="Fastest growing headcount"
                blurb="Largest percentage increase in employees over the last fiscal year."
                companies={top(sizable, (c) => c.employees_yoy)}
                value={(c) => formatGrowth(c.employees_yoy)}
              />
              <CompanyList
                title="Biggest headcount cuts"
                blurb="Largest percentage drop in employees over the last fiscal year."
                companies={top(sizable, (c) => c.employees_yoy, 10, true)}
                value={(c) => formatGrowth(c.employees_yoy)}
              />
            </div>
            <div className="container-op pb-12">
              <Link href="/workforce" className="btn-outline">
                Open the full leaderboard
              </Link>
            </div>
          </section>
        </>
      )}

      <p className="container-op py-8 max-w-[760px] font-sans text-[12px] leading-relaxed text-text-dim">
        Source: employee counts and revenue as stated in each company&apos;s
        annual reports (Form 10-K). Companies report headcount once a year and
        sometimes round it. This is data, not a recommendation.
      </p>
    </>
  );
}
