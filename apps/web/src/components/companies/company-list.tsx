import Link from "next/link";
import { companyPath, displayName, type DirectoryCompany } from "@/lib/companies";

/** A short ranked list of companies with one highlighted number each. */
export function CompanyList({
  title,
  blurb,
  companies,
  value,
}: {
  title: string;
  blurb: string;
  companies: DirectoryCompany[];
  value: (c: DirectoryCompany) => string;
}) {
  if (companies.length === 0) return null;
  return (
    <div className="data-panel">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-sans text-[16px] font-bold tracking-tight text-text">{title}</h2>
        <p className="mt-0.5 font-sans text-[13px] text-text-muted">{blurb}</p>
      </div>
      <ol className="divide-y divide-border">
        {companies.map((c, i) => (
          <li key={c.ticker}>
            <Link
              href={companyPath(c.ticker)}
              className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-5 py-2.5 hover:bg-bg-tertiary/60 transition-colors"
            >
              <span className="font-mono text-[12px] text-text-dim">{i + 1}</span>
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-mono text-[13px] font-semibold text-text">{c.ticker}</span>
                <span className="truncate font-sans text-[13px] text-text-muted">
                  {displayName(c)}
                </span>
              </span>
              <span className="font-mono text-[13px] font-semibold text-text">{value(c)}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
