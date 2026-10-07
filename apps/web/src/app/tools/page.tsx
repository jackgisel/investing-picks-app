import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { CompanySearch } from "@/components/companies/company-search";
import { CHALLENGE_PATH, HOLD_YEARS, MIN_PICKS } from "@/lib/challenge/rules";
import { TOOL_GROUPS } from "@/lib/site-nav";
import { buildToolsIndexMetadata } from "@/lib/tools/metadata";
import { TOOL_BY_ID } from "@/lib/tools/registry";

export const metadata = buildToolsIndexMetadata();

export default function ToolsIndexPage() {
  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[720px]">
          <p className="section-label">Free tools</p>
          <h1 className="section-title !text-[36px] sm:!text-[44px] !font-extrabold leading-[1.1]">
            Tools for picking stocks yourself.
          </h1>
          <p className="section-sub mb-0 !max-w-[600px]">
            A long-running stock picking game, worksheets that do the valuation
            arithmetic, and company data from annual reports. All free, no card,
            and the calculators work without an account.
          </p>
        </div>
      </div>

      <section className="border-b border-border">
        <div className="container-op py-12">
          <Link
            href={CHALLENGE_PATH}
            className="group grid grid-cols-1 items-center gap-8 overflow-hidden rounded-soft border border-border-strong bg-bg-secondary p-6 sm:p-10 md:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="section-label section-label-yellow">Game</p>
              <h2 className="font-sans text-[30px] sm:text-[38px] font-extrabold uppercase leading-[1.05] tracking-tight">
                Beat the S&amp;P 500
              </h2>
              <p className="mt-3 max-w-[560px] font-sans text-[16px] leading-relaxed text-text-muted">
                Lock in {MIN_PICKS} or more stocks and we score them against the
                index after every close for {HOLD_YEARS} years. Public leaderboard,
                a new class each quarter, and no edits once you are in.
              </p>
              <span className="btn-primary mt-6">
                Play free <ArrowRight size={16} aria-hidden />
              </span>
            </div>
            <Trophy
              aria-hidden
              strokeWidth={1.2}
              className="hidden h-36 w-36 text-accent-yellow transition-transform duration-300 ease-out-strong group-hover:-rotate-6 md:block"
            />
          </Link>
        </div>
      </section>

      {TOOL_GROUPS.map((group) => (
        <section key={group.label} className="border-b border-border">
          <div className="container-op py-12">
            <h2 className="mb-6 font-sans text-[22px] font-bold tracking-tight">{group.label}</h2>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {group.ids.map((id) => {
                const tool = TOOL_BY_ID[id];
                return (
                  <li key={id}>
                    <Link
                      href={tool.path}
                      className="group flex h-full flex-col rounded-soft border border-border bg-bg-secondary/30 px-6 py-6 transition-colors hover:border-border-strong sm:px-7"
                    >
                      <h3 className="font-sans text-[18px] font-bold text-text">{tool.h1}</h3>
                      <p className="mt-2 flex-1 font-sans text-[14px] leading-relaxed text-text-muted">
                        {tool.subtitle}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text">
                        Open
                        <ArrowRight
                          size={14}
                          aria-hidden
                          className="transition-transform duration-150 group-hover:translate-x-0.5"
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}

      <section className="border-b border-border">
        <div className="container-op py-12">
          <p className="section-label section-label-mint">Free data</p>
          <h2 className="font-sans text-[22px] font-bold tracking-tight">
            Look up any company&apos;s headcount
          </h2>
          <p className="mt-1 max-w-[620px] font-sans text-[14px] text-text-muted">
            Employees, revenue and revenue per employee, year by year, from each
            company&apos;s annual report.
          </p>
          <CompanySearch className="mt-6" />
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/companies" className="btn-outline">Browse by sector</Link>
            <Link href="/workforce" className="btn-outline">Revenue per employee leaderboard</Link>
          </div>
        </div>
      </section>
    </>
  );
}
