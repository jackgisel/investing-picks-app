import {
  formatStreetPct,
  formatStreetPrice,
  type StreetRange,
} from "@/lib/street-range";

/**
 * Analyst consensus low–mean–high vs mark. Labeled as Street context so it
 * cannot be read as an Outpick price target.
 */
export function StreetRangeBand({
  range,
  compact = false,
}: {
  range: StreetRange;
  compact?: boolean;
}) {
  const markPct =
    range.mark !== null && range.high > range.low
      ? Math.min(
          100,
          Math.max(0, ((range.mark - range.low) / (range.high - range.low)) * 100),
        )
      : null;

  return (
    <div className={compact ? "" : "rounded-md border border-border bg-bg-secondary/60 px-3 py-3"}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-mono text-[9px] font-medium tracking-[1.5px] text-text-dim">
          Street range
        </p>
        {range.upsideToMeanPct !== null ? (
          <p className="font-mono text-[10px] tabular-nums text-text-dim">
            {formatStreetPct(range.upsideToMeanPct)} to mean
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-2">
        {(
          [
            ["Low", range.low],
            ["Mark", range.mark],
            ["Mean", range.mean],
            ["High", range.high],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="font-mono text-[9px] tracking-[1.5px] text-text-dim">
              {label}
            </p>
            <p className="mt-0.5 font-mono text-[13px] font-semibold tabular-nums text-text">
              {value === null ? "—" : formatStreetPrice(value)}
            </p>
          </div>
        ))}
      </div>

      {markPct !== null ? (
        <div className="relative mt-3 h-1 rounded-full bg-border">
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text"
            style={{ left: `${markPct}%` }}
            title="Mark within Street range"
          />
        </div>
      ) : null}

      {!compact ? (
        <p className="mt-2 font-sans text-[10px] leading-relaxed text-text-dim">
          Analyst consensus, not an Outpick target
          {range.analystCount !== null
            ? ` · ${Math.round(range.analystCount)} analysts`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}

export function StreetRangeInline({ range }: { range: StreetRange }) {
  return (
    <span>
      <span className="block font-mono text-[13px] font-semibold tabular-nums text-text">
        {formatStreetPrice(range.mean)}
      </span>
      <span className="mt-1 block font-mono text-[9px] text-text-dim">
        {formatStreetPrice(range.low)}–{formatStreetPrice(range.high)}
        {range.upsideToMeanPct !== null
          ? ` · ${formatStreetPct(range.upsideToMeanPct)} vs mark`
          : ""}
      </span>
    </span>
  );
}
