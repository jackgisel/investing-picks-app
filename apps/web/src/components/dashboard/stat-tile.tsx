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
 * performance, SummaryCard on portfolio.
 *
 * The icon sits in a tinted chip rather than being another grey glyph: it is
 * the one place a tile can carry a house colour without tinting a number, and
 * the dashboard previously used none of the palette at all.
 *
 * `loading` renders a block sized to the eventual value instead of a pulsing
 * em-dash, so the first paint does not look like an empty page and nothing
 * shifts when the number lands.
 */
export function StatTile({
  label,
  value,
  icon: Icon,
  tone = "cyan",
  valueTone = "neutral",
  loading = false,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  tone?: PastelTone;
  valueTone?: ValueTone;
  loading?: boolean;
}) {
  return (
    <div className="data-card">
      <div className="flex items-center gap-2 mb-2.5">
        {Icon && (
          <span
            className={`inline-flex items-center justify-center rounded-lg p-1.5 ${TONE_TINT[tone]}`}
            aria-hidden
          >
            <Icon size={13} className="text-text-muted" />
          </span>
        )}
        <span className="field-label">{label}</span>
      </div>
      {loading ? (
        <span className="block h-[26px] w-20 rounded bg-bg-tertiary animate-pulse" />
      ) : (
        <span
          className={`block font-mono text-xl font-bold tabular-nums leading-[26px] ${VALUE_CLASS[valueTone]}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}
