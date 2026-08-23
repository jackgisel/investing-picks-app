import Link from "next/link";
import {
  formatQuantRating,
  QUANT_RATING_EXPLAINER_PATH,
  QUANT_RATING_MAX,
  QUANT_RATING_MIN,
} from "@/lib/content-draft";

/**
 * Compact meter for a pick's quant rating on the insight page.
 *
 * Complements the prose (which must still write "X.X / 5" and link once) with
 * a visual the reader can scan without decoding a bare float.
 */
export function QuantRatingMeter({
  rating,
  asOf,
}: {
  rating: number;
  asOf?: string | null;
}) {
  const label = formatQuantRating(rating) ?? `${rating} / ${QUANT_RATING_MAX}`;
  const clamped = Math.min(
    QUANT_RATING_MAX,
    Math.max(QUANT_RATING_MIN, rating),
  );
  const pct =
    ((clamped - QUANT_RATING_MIN) / (QUANT_RATING_MAX - QUANT_RATING_MIN)) *
    100;

  return (
    <div className="mb-10 max-w-[680px] rounded-md border border-border bg-bg-secondary/60 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
          Quant rating
        </p>
        {asOf ? (
          <p className="font-mono text-[10px] tabular-nums text-text-dim">
            As of {asOf}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="font-mono text-[28px] font-bold leading-none tabular-nums tracking-tight text-text">
          {label}
        </p>
        <Link
          href={QUANT_RATING_EXPLAINER_PATH}
          className="font-sans text-[12px] text-accent-green underline decoration-accent-green/30 underline-offset-4 transition-colors hover:decoration-accent-green"
        >
          How ratings work
        </Link>
      </div>

      <div
        className="relative mt-4 h-1.5 rounded-full bg-border"
        role="img"
        aria-label={`Quant rating ${label}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent-green/80"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-text"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-text-dim">
        <span>{QUANT_RATING_MIN}</span>
        <span>{QUANT_RATING_MAX}</span>
      </div>
    </div>
  );
}

/**
 * Week vs S&P comparison for the Friday review — percentages only.
 */
export function WeekVsSpyBars({
  bookChangePct,
  spyChangePct,
}: {
  bookChangePct: number;
  spyChangePct: number;
}) {
  const maxAbs = Math.max(
    Math.abs(bookChangePct),
    Math.abs(spyChangePct),
    0.01,
  );

  const rows: { label: string; value: number }[] = [
    { label: "Book", value: bookChangePct },
    { label: "S&P 500", value: spyChangePct },
  ];

  return (
    <div className="mb-10 max-w-[680px] rounded-md border border-border bg-bg-secondary/60 px-4 py-4 sm:px-5">
      <p className="font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
        This week
      </p>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const width = (Math.abs(row.value) / maxAbs) * 100;
          const up = row.value >= 0;
          return (
            <div key={row.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="font-sans text-[13px] text-text-muted">
                  {row.label}
                </span>
                <span
                  className={`font-mono text-[13px] font-semibold tabular-nums ${
                    up ? "text-accent-green" : "text-accent-red"
                  }`}
                >
                  {up ? "+" : ""}
                  {row.value.toFixed(2)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full ${
                    up ? "bg-accent-green/70" : "bg-accent-red/70"
                  }`}
                  style={{ width: `${Math.max(width, 4)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
