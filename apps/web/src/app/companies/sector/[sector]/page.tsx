import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { HScroll } from "@/components/ui/h-scroll";
import {
  companyPath,
  getCompanyDirectory,
  median,
  sectorFromSlug,
  sectorPath,
  type DirectoryCompany,
} from "@/lib/companies";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { formatCompactUsd } from "@/lib/market-cap";
import {
  formatEmployees,
  formatGrowth,
  formatPerEmployee,
  shapeLabel,
} from "@/lib/workforce";
import { cn } from "@/lib/utils";

type Params = { sector: string };

export const revalidate = 3600;

const SORTS = {
  employees: { label: "Employees", key: (c: DirectoryCompany) => c.employees },
  rev_per_employee: { label: "Revenue / employee", key: (c: DirectoryCompany) => c.rev_per_employee },
  employees_yoy: { label: "Staff growth", key: (c: DirectoryCompany) => c.employees_yoy },
  revenue: { label: "Revenue", key: (c: DirectoryCompany) => c.revenue },
} as const;
type SortId = keyof typeof SORTS;

async function load(slug: string) {
  const directory = await getCompanyDirectory();
  if (!directory) return null;
  const sector = sectorFromSlug(directory.companies, slug);
  if (!sector) return null;
  const companies = directory.companies.filter((c) => c.sector === sector);
  return { sector, companies };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { sector: slug } = await params;
  const data = await load(slug);
  if (!data) return { robots: { index: false, follow: true } };
  const title = `${data.sector} companies by employees and revenue per employee`;
  const description = `Headcount, revenue per employee and staff growth for ${data.companies.length} ${data.sector} companies, from their annual reports.`;
  const url = `${SITE_URL}${sectorPath(data.sector)}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: SITE_NAME, type: "website" },
  };
}

export default async function SectorPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sector: slug } = await params;
  const sp = await searchParams;
  const data = await load(slug);
  if (!data) notFound();
  const { sector, companies } = data;
  const sort: SortId = sp.sort && sp.sort in SORTS ? (sp.sort as SortId) : "employees";
  const key = SORTS[sort].key;
  const rows = [...companies].sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });

  const live = companies.filter((c) => !c.stale);
  const industries = [...new Set(live.map((c) => c.industry).filter(Boolean) as string[])]
    .map((industry) => {
      const list = live.filter((c) => c.industry === industry);
      return {
        industry,
        count: list.length,
        median: median(list.map((c) => c.rev_per_employee ?? NaN)),
      };
    })
    .filter((i) => i.count >= 3)
    .sort((a, b) => (b.median ?? 0) - (a.median ?? 0));

  const th =
    "py-3 px-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim whitespace-nowrap";

  return (
    <>
      <section className="border-b border-border">
        <div className="container-op pt-8 pb-12">
          <Breadcrumbs
            items={[
              { label: "Companies", href: "/companies" },
              { label: sector, href: sectorPath(sector) },
            ]}
            className="mb-10"
          />
          <p className="section-label section-label-mint">Sector data</p>
          <h1 className="font-sans text-[32px] sm:text-[42px] font-extrabold leading-[1.1] tracking-tight max-w-[820px]">
            {sector}: employees and revenue per employee
          </h1>
          <p className="mt-4 max-w-[640px] font-sans text-[16px] leading-relaxed text-text-muted">
            {companies.length} companies. The median one brings in{" "}
            <span className="font-mono text-text">
              {formatPerEmployee(median(live.map((c) => c.rev_per_employee ?? NaN)))}
            </span>{" "}
            of revenue per employee and employs{" "}
            <span className="font-mono text-text">
              {formatEmployees(median(live.map((c) => c.employees)))}
            </span>{" "}
            people.
          </p>
        </div>
      </section>

      {industries.length > 1 && (
        <section className="border-b border-border">
          <div className="container-op py-10">
            <h2 className="mb-4 font-sans text-[18px] font-bold tracking-tight">
              Median revenue per employee by industry
            </h2>
            <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
              {industries.map((i) => (
                <li
                  key={i.industry}
                  className="flex items-baseline justify-between gap-3 border-b border-border/70 py-2"
                >
                  <span className="truncate font-sans text-[14px] text-text">{i.industry}</span>
                  <span className="shrink-0 font-mono text-[13px] text-text-muted">
                    {formatPerEmployee(i.median)}
                    <span className="ml-2 text-text-dim">({i.count})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="border-b border-border">
        <div className="container-op py-10">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span className="mr-1 font-sans text-[12px] font-bold uppercase tracking-[0.12em] text-text-dim">
              Sort by
            </span>
            {(Object.keys(SORTS) as SortId[]).map((id) => (
              <Link
                key={id}
                href={id === "employees" ? sectorPath(sector) : `${sectorPath(sector)}?sort=${id}`}
                aria-current={id === sort ? "true" : undefined}
                scroll={false}
                className={cn(
                  "press rounded-pill border px-4 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.08em]",
                  id === sort
                    ? "border-transparent bg-inverse text-inverse-fg"
                    : "border-border-strong bg-bg text-text hover:bg-bg-secondary",
                )}
              >
                {SORTS[id].label}
              </Link>
            ))}
          </div>
          <HScroll>
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-b border-border-strong text-left">
                  <th className={cn(th, "w-10")}>#</th>
                  <th className={th}>Company</th>
                  <th className={th}>Industry</th>
                  <th className={cn(th, "text-right")}>Employees</th>
                  <th className={cn(th, "text-right")}>Staff YoY</th>
                  <th className={cn(th, "text-right")}>Revenue</th>
                  <th className={cn(th, "text-right")}>Revenue / employee</th>
                  <th className={th}>Shape</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[13px]">
                {rows.map((c, i) => (
                  <tr key={c.ticker} className="border-b border-border/70 hover:bg-bg-secondary/60">
                    <td className="py-2.5 px-3 text-text-dim">{i + 1}</td>
                    <td className="py-2.5 px-3">
                      <Link href={companyPath(c.ticker)} className="group block">
                        <span className="font-semibold text-text group-hover:underline underline-offset-2">
                          {c.ticker}
                        </span>
                        <span className="block max-w-[240px] truncate font-sans text-[12px] text-text-muted">
                          {c.name}
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate font-sans text-[12px] text-text-muted">
                      {c.industry}
                    </td>
                    <td className="py-2.5 px-3 text-right">{formatEmployees(c.employees)}</td>
                    <td className="py-2.5 px-3 text-right text-text-muted">{formatGrowth(c.employees_yoy)}</td>
                    <td className="py-2.5 px-3 text-right">{formatCompactUsd(c.revenue)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatPerEmployee(c.rev_per_employee)}</td>
                    <td className="py-2.5 px-3 font-sans text-[12px] text-text-muted whitespace-nowrap">
                      {c.stale ? "Old filing" : shapeLabel(c.shape)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </HScroll>
        </div>
      </section>
    </>
  );
}

