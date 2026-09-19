import { TONE_TINT, type PastelTone } from "@/lib/tones";

export type ValueTone = "neutral" | "green" | "red";

const VALUE_CLASS: Record<ValueTone, string> = {
  neutral: "text-text",
  green: "text-accent-green",
  red: "text-accent-red",
};

/**
 * The number tile used across the dashboard.
 *
 * Replaces three byte-identical copies — StatCard on the index, MetricCard on
 * performance, SummaryCard on portfolio — and now PeriodTile on Performance,
 * which was this plus a caption.
 *
 * The icon sits in a tinted chip rather than being another grey glyph: it is
 * the one place a tile can carry a house colour without tinting a number, and
 * the dashboard previously used none of the palette at all.
 *
 * `caption` is the one-line definition under the number. A dashboard figure
 * without one is a claim the reader has to guess the basis of — "Picks
 * return" and "Book return" differ by 18 points on a partly-invested book and
 * only the caption says why. `note` is a second, quieter line for coverage
 * or provenance ("10 of 11 picks").
 *
 * `loading` renders a block sized to the eventual value instead of a pulsing
 * em-dash, so the first paint does not look like an empty page and nothing
 * shifts when the number lands.
 */
export function StatTile({
  label,
  value,
  caption,
  note,
  icon: Icon,
  tone = "cyan",
  valueTone = "neutral",
  loading = false,
}: {
  label: string;
  value: string;
  caption?: string | null;
  note?: string | null;
  icon?: React.ElementType;
  tone?: PastelTone;
  valueTone?: ValueTone;
  loading?: boolean;
}) {
  return (
    <div className="data-card">
      <div className="mb-2.5 flex items-center gap-2">
        {Icon && (
          <span
            className={`inline-flex items-center justify-center rounded-lg p-1.5 ${TONE_TINT[tone]}`}
            aria-hidden
          >
            <Icon size={13} strokeWidth={2} className="text-text-muted" />
          </span>
        )}
        <span className="field-label">{label}</span>
      </div>
      {loading ? (
        <span className="block h-[26px] w-20 animate-pulse rounded bg-bg-tertiary" />
      ) : (
        <span
          className={`block font-mono text-xl font-bold leading-[26px] tabular-nums ${VALUE_CLASS[valueTone]}`}
        >
          {value}
        </span>
      )}
      {caption && (
        <span className="mt-1.5 block font-sans text-[11px] leading-snug text-text-dim">
          {caption}
        </span>
      )}
      {note && (
        <span className="mt-0.5 block font-sans text-[10px] text-text-dim">
          {note}
        </span>
      )}
    </div>
  );
}
