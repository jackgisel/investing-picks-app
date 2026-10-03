import type { Metadata } from "next";
import Link from "next/link";
import { GrowthScatter } from "@/components/workforce/growth-scatter";
import { WorkforceTable } from "@/components/workforce/workforce-table";
import { PillButton } from "@/components/ui/pill-button";
import { getAccess } from "@/lib/api-gate";
import { formatCompactUsd } from "@/lib/market-cap";
import {
  FREE_ROWS,
  MEMBER_ROWS,
  MIN_EMPLOYEES,
  MIN_REVENUE,
  WORKFORCE_ORDERS,
  WORKFORCE_SHAPES,
  formatPerEmployee,
  getWorkforceBoard,
  isWorkforceOrder,
  isWorkforceShape,
  type WorkforceOrder,
  type WorkforceShape,
} from "@/lib/workforce";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  alternates: { canonical: "/workforce" },
  title: "Revenue per employee leaderboard",
  description:
    "Which public companies earn the most revenue per employee, and which are growing sales faster than headcount. Built from each company's own annual report.",
};

// Reads the visitor's session to decide how much of the board to show.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ order?: string; sector?: string; shape?: string }>;

function hrefFor(
  order: WorkforceOrder,
  sector?: string | null,
  shape?: WorkforceShape | null,
) {
  const q = new URLSearchParams();
  if (order !== "rev_per_employee") q.set("order", order);
  if (sector) q.set("sector", sector);
  if (shape) q.set("shape", shape);
  const s = q.toString();
  return s ? `/workforce?${s}` : "/workforce";
}

export default async function WorkforcePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const order: WorkforceOrder = isWorkforceOrder(sp.order) ? sp.order : "rev_per_employee";
  const access = await getAccess();
  const entitled = access.entitled;

  // Members' rows and filters never reach the HTML of a visitor who is not one.
  const sector = entitled ? (sp.sector ?? null) : null;
  const shape: WorkforceShape | null =
    entitled && isWorkforceShape(sp.shape) ? sp.shape : null;
  const board = await getWorkforceBoard({
    order,
    sector,
    shape,
    limit: entitled ? MEMBER_ROWS : FREE_ROWS,
  });
  const rows = board?.rows ?? [];

  return (
    <>
      <div className="container-op border-b border-border py-14 sm:py-16">
        <div className="max-w-[680px]">
          <p className="section-label section-label-mint">Workforce data</p>
          <h1 className="section-title">Who earns the most per employee.</h1>
          <p className="section-sub mb-0">
            Every public company states its headcount in its annual report. We
            collect those numbers ourselves and set them against revenue, to
            see which businesses do more with fewer people, and which are
            growing sales faster than they hire.
          </p>
        </div>
      </div>

      <div className="container-op py-10">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {WORKFORCE_ORDERS.map((o) => (
            <Link
              key={o.id}
              href={hrefFor(o.id, sector, shape)}
              aria-current={o.id === order ? "page" : undefined}
              className={cn(
                "rounded-pill border px-4 py-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.08em] transition-colors",
                o.id === order
                  ? "border-transparent bg-inverse text-inverse-fg"
                  : "border-border-strong bg-bg text-text hover:bg-bg-secondary",
              )}
            >
              {o.label}
            </Link>
          ))}
        </div>

        {entitled && board && board.sectors.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Link
              href={hrefFor(order, null, shape)}
              className={cn(
                "rounded-pill border px-3 py-1 font-sans text-[12px]",
                !sector ? "border-border-strong bg-bg-secondary font-semibold" : "border-border text-text-muted hover:text-text",
              )}
            >
              All sectors
            </Link>
            {board.sectors.map((s) => (
              <Link
                key={s}
                href={hrefFor(order, s, shape)}
                className={cn(
                  "rounded-pill border px-3 py-1 font-sans text-[12px]",
                  s === sector ? "border-border-strong bg-bg-secondary font-semibold" : "border-border text-text-muted hover:text-text",
                )}
              >
                {s}
              </Link>
            ))}
          </div>
        )}

        {entitled ? (
          <section className="mb-10 rounded-soft border border-border p-4 sm:p-6">
            <h2 className="font-sans text-[18px] font-bold tracking-tight text-text">
              Revenue growth against headcount growth
            </h2>
            <p className="mb-4 mt-1 max-w-[620px] font-sans text-[13px] text-text-muted">
              Each dot is a company. The higher and further left, the more it
              grew sales without growing its workforce.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link
                href={hrefFor(order, sector, null)}
                className={cn(
                  "rounded-pill border px-3 py-1 font-sans text-[12px]",
                  !shape ? "border-border-strong bg-bg-secondary font-semibold" : "border-border text-text-muted hover:text-text",
                )}
              >
                All shapes
              </Link>
              {WORKFORCE_SHAPES.map((s) => (
                <Link
                  key={s.id}
                  href={hrefFor(order, sector, s.id)}
                  title={s.blurb}
                  className={cn(
                    "rounded-pill border px-3 py-1 font-sans text-[12px]",
                    s.id === shape ? "border-border-strong bg-bg-secondary font-semibold" : "border-border text-text-muted hover:text-text",
                  )}
                >
                  {s.label}
                  {board ? ` (${board.shape_counts[s.id] ?? 0})` : ""}
                </Link>
              ))}
            </div>
            <GrowthScatter shape={shape} sector={sector} />
          </section>
        ) : (
          <section className="mb-10 rounded-soft border border-border bg-bg-secondary p-6">
            <h2 className="font-sans text-[18px] font-bold tracking-tight text-text">
              Revenue growth against headcount growth
            </h2>
            <p className="mt-1 max-w-[560px] font-sans text-[13px] leading-relaxed text-text-muted">
              Members see every company on one chart, sorted into five shapes:
              leaner, efficient growth, hiring ahead, contracting, and hiring
              into decline.
            </p>
          </section>
        )}

        {rows.length === 0 ? (
          <div className="rounded-soft border border-border bg-bg-secondary px-6 py-10">
            <p className="font-sans text-[15px] font-semibold text-text">
              {board === null
                ? "The board is not loading right now."
                : sector || shape
                  ? "No companies match these filters."
                  : "The first headcount numbers are still being collected."}
            </p>
            <p className="mt-1 max-w-[520px] font-sans text-[14px] text-text-muted">
              {board === null
                ? "Try again in a moment."
                : sector || shape
                  ? "Pick another sector or shape, or clear the filters."
                  : "Check back shortly. Nothing here is estimated, so the board stays empty until the filings are in."}
            </p>
          </div>
        ) : (
          <>
            <WorkforceTable rows={rows} entitled={entitled} />
            <p className="mt-4 font-sans text-[12px] leading-relaxed text-text-muted">
              Showing {rows.length} of {board?.universe} companies with at
              least {formatCompactUsd(MIN_REVENUE)} in revenue and{" "}
              {MIN_EMPLOYEES} employees.
              {board?.median_rev_per_employee
                ? ` Median revenue per employee: ${formatPerEmployee(board.median_rev_per_employee)}.`
                : ""}{" "}
              Leverage is revenue growth minus headcount growth over the last
              fiscal year, in percentage points.
              {board && board.excluded_sectors.length > 0
                ? ` ${board.excluded_sectors.join(" and ")} ${board.excluded_sectors.length > 1 ? "are" : "is"} left out of this view, because revenue there means interest and rent rather than sales, which makes revenue per employee a different thing.${entitled ? " Pick the sector above to see it." : ""}`
                : ""}
            </p>
          </>
        )}

        {!entitled && (
          <div className="mt-10 rounded-soft border border-border-strong bg-bg-secondary p-6 sm:p-8">
            <p className="font-sans text-[18px] font-bold tracking-tight text-text">
              See the full board and the history behind each name.
            </p>
            <p className="mt-2 max-w-[560px] font-sans text-[14px] leading-relaxed text-text-muted">
              Members get the top {MEMBER_ROWS}, sector filters, and a year by
              year chart of headcount against revenue for every company.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <PillButton href="/subscribe" arrow>
                Start your membership
              </PillButton>
              <Link href="/track-record" className="btn-outline">
                See the track record
              </Link>
            </div>
          </div>
        )}

        <p className="mt-10 max-w-[680px] font-sans text-[12px] leading-relaxed text-text-dim">
          Source: employee counts and revenue as stated in each company's most
          recent annual reports (Form 10-K). Companies report headcount once a
          year and sometimes only a rounded figure, so treat small differences
          as noise. Revenue per employee runs very differently across
          industries; compare within a sector. This is data, not a
          recommendation.
        </p>
      </div>
    </>
  );
}
