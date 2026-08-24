/**
 * How Outpick compares to an index fund and to a typical stock newsletter.
 *
 * Lifted out of the homepage's "who we are" section when that section was
 * folded into the philosophy band. The table does real work for a reader
 * deciding between three options, but it needs room to be read — it belongs on
 * /strategy, not above the fold.
 *
 * Two renderings of one dataset: a definition list under `md`, a real table
 * above it. The table is `min-w-[680px]` inside an `overflow-x-auto`, which is
 * why the stacked version exists rather than letting a five-column table
 * scroll on a phone.
 */

const COMPARISON: {
  dimension: string;
  index: string;
  newsletter: string;
  outpick: string;
}[] = [
  {
    dimension: "What you own",
    index: "500 companies, weighted by size",
    newsletter: "A list of alerts",
    outpick: "One researched business at a time",
  },
  {
    dimension: "Why you own it",
    index: "No reason — it's in the index",
    newsletter: "Because the pick was sent",
    outpick: "A written thesis you can check",
  },
  {
    dimension: "Track record",
    index: "The market, by definition",
    newsletter: "Selected highlights",
    outpick: "Live example portfolio, published in full",
  },
  {
    dimension: "Risk disclosed",
    index: "Market risk",
    newsletter: "Rarely published",
    outpick: "Wins and losses both shown",
  },
  {
    dimension: "What it costs",
    index: "A fraction of a percent",
    newsletter: "Tiers, upsells, sales calls",
    outpick: "One price. No upsells, no calls.",
  },
];

export function ComparisonTable() {
  return (
    <div>
      <div className="md:hidden space-y-5">
        <p className="sr-only">
          How Outpick compares to index funds and typical stock
          newsletters
        </p>
        {COMPARISON.map((row) => (
          <div
            key={row.dimension}
            className="border-b border-border pb-5 last:border-b-0 last:pb-0"
          >
            <p className="mb-3 font-sans text-[11px] font-bold tracking-[0.1em] uppercase text-text-dim">
              {row.dimension}
            </p>
            <dl className="space-y-3">
              <div>
                <dt className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
                  Index fund
                </dt>
                <dd className="mt-1 font-sans text-[14px] text-text-muted">
                  {row.index}
                </dd>
              </div>
              <div>
                <dt className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
                  Typical stock newsletter
                </dt>
                <dd className="mt-1 font-sans text-[14px] text-text-muted">
                  {row.newsletter}
                </dd>
              </div>
              <div className="rounded-soft bg-accent-green-soft/25 px-3 py-2.5">
                <dt className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-accent-green">
                  Outpick
                </dt>
                <dd className="mt-1 font-sans text-[14px] font-medium text-text">
                  {row.outpick}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[680px] border-collapse">
          <caption className="sr-only">
            How Outpick compares to index funds and typical stock
            newsletters
          </caption>
          <thead>
            <tr className="border-b border-border-strong">
              <th scope="col" className="w-[18%] px-4 py-4 text-left">
                <span className="sr-only">Dimension</span>
              </th>
              <th
                scope="col"
                className="w-[26%] px-4 py-4 text-left font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim"
              >
                Index fund
              </th>
              <th
                scope="col"
                className="w-[26%] px-4 py-4 text-left font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim"
              >
                Typical stock newsletter
              </th>
              <th
                scope="col"
                className="w-[30%] px-4 py-4 text-left font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-accent-green"
              >
                Outpick
              </th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON.map((row) => (
              <tr key={row.dimension} className="border-b border-border">
                <th
                  scope="row"
                  className="px-4 py-5 text-left align-top font-sans text-[11px] font-bold tracking-[0.1em] uppercase text-text-dim"
                >
                  {row.dimension}
                </th>
                <td className="px-4 py-5 align-top font-sans text-[14px] text-text-muted">
                  {row.index}
                </td>
                <td className="px-4 py-5 align-top font-sans text-[14px] text-text-muted">
                  {row.newsletter}
                </td>
                <td className="px-4 py-5 align-top font-sans text-[14px] text-text font-medium bg-accent-green-soft/25">
                  {row.outpick}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-sans text-[12px] text-text-dim mt-5 leading-relaxed max-w-[70ch]">
        Index funds are a good default and we are not arguing otherwise — most
        people should own them. This is about the part of a portfolio where you
        want a reason behind every position.
      </p>
    </div>
  );
}
