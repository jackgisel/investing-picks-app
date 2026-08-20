import { TONE_BG, TONE_TINT, type PastelTone } from "@/lib/tones";

/**
 * The illustrative pieces of the Strategy page.
 *
 * All of it is drawn from the house tone ring rather than imported artwork, so
 * the diagrams stay legible in both themes and cost nothing to load. Each of
 * the five factors owns a tone and keeps it across every diagram on the page —
 * the colour is the through-line that makes "growth" the same idea in the
 * factor list, the funnel and the worked example.
 */

export const FACTOR_TONE: Record<string, PastelTone> = {
  Growth: "mint",
  Revisions: "cyan",
  Profitability: "yellow",
  Momentum: "peach",
  Valuation: "lilac",
};

/** Relative emphasis, stated as a tier rather than a number. */
export type Emphasis = "primary" | "supporting" | "light";

const EMPHASIS_BARS: Record<Emphasis, number> = {
  primary: 3,
  supporting: 2,
  light: 1,
};

const EMPHASIS_LABEL: Record<Emphasis, string> = {
  primary: "Primary",
  supporting: "Supporting",
  light: "Light touch",
};

/**
 * Emphasis as three segments, not a percentage.
 *
 * The exact factor weights are the research and are no longer served by the
 * API. Tiers say what a reader actually needs — which factors move the score
 * most — without handing over the model.
 */
export function EmphasisMeter({
  emphasis,
  tone,
}: {
  emphasis: Emphasis;
  tone: PastelTone;
}) {
  const filled = EMPHASIS_BARS[emphasis];
  return (
    <span className="flex items-center gap-2">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`h-1 w-4 rounded-full ${
              i < filled ? TONE_BG[tone] : "bg-bg-tertiary"
            }`}
          />
        ))}
      </span>
      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-text-dim">
        {EMPHASIS_LABEL[emphasis]}
      </span>
    </span>
  );
}

export function FactorCard({
  name,
  question,
  measures,
  emphasis,
}: {
  name: string;
  question: string;
  measures: string[];
  emphasis: Emphasis;
}) {
  const tone = FACTOR_TONE[name];
  return (
    <div className="data-card flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${TONE_BG[tone]}`} aria-hidden />
        <h3 className="font-sans text-[15px] font-bold tracking-tight text-text">
          {name}
        </h3>
      </div>
      <p className="font-sans text-[13px] leading-relaxed text-text-muted">
        {question}
      </p>
      <ul className="mt-3.5 flex flex-wrap gap-1.5">
        {measures.map((m) => (
          <li
            key={m}
            className={`rounded-lg px-2 py-1 font-mono text-[10px] text-text-muted ${TONE_TINT[tone]}`}
          >
            {m}
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-4">
        <EmphasisMeter emphasis={emphasis} tone={tone} />
      </div>
    </div>
  );
}

/**
 * The sector-relative idea, as a worked example.
 *
 * This is the single least intuitive thing about the model and the thing that
 * most distinguishes it, so it gets a picture rather than a sentence: the same
 * raw number is unremarkable in one sector and exceptional in another.
 */
export function SectorRelativeExample() {
  const rows = [
    {
      sector: "Software",
      tone: "lilac" as PastelTone,
      typical: "72%",
      percentile: 18,
      verdict: "Below average",
    },
    {
      sector: "Grocery retail",
      tone: "mint" as PastelTone,
      typical: "26%",
      percentile: 94,
      verdict: "Exceptional",
    },
  ];

  return (
    <div className="data-card">
      <p className="panel-label panel-label-cyan mb-4">Worked example</p>
      <p className="mb-5 max-w-[560px] font-sans text-[13px] leading-relaxed text-text-muted">
        Take one company with a{" "}
        <span className="font-mono font-semibold text-text">38% gross margin</span>.
        Scored against the whole market that number means very little. Scored
        against its own sector it means two opposite things:
      </p>

      <div className="space-y-4">
        {rows.map((r) => (
          <div key={r.sector}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full ${TONE_BG[r.tone]}`}
                  aria-hidden
                />
                <span className="font-sans text-[13px] font-semibold text-text">
                  {r.sector}
                </span>
                <span className="font-mono text-[11px] text-text-dim">
                  sector typically {r.typical}
                </span>
              </span>
              <span className="font-mono text-[12px] font-semibold tabular-nums text-text">
                {r.percentile}th
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-bg-tertiary">
              <div
                className={`h-full rounded-full ${TONE_BG[r.tone]}`}
                style={{ width: `${r.percentile}%` }}
              />
            </div>
            <p className="mt-1.5 font-sans text-[12px] text-text-dim">
              {r.verdict} for a {r.sector.toLowerCase()} business.
            </p>
          </div>
        ))}
      </div>

      <p className="mt-5 border-t border-border pt-4 font-sans text-[12px] leading-relaxed text-text-dim">
        Every factor is percentile-ranked inside its own sector before anything
        is combined. A grade is always a statement about a company relative to
        its peers, never against the market at large.
      </p>
    </div>
  );
}

/** The funnel from universe to a single published pick. */
export function PickFunnel() {
  const stages = [
    {
      label: "US-listed universe",
      note: "Every name we can price and value",
      width: 100,
      tone: "lilac" as PastelTone,
    },
    {
      label: "Investable filter",
      note: "Size and share price floors — no micro-caps, no penny stocks",
      width: 74,
      tone: "cyan" as PastelTone,
    },
    {
      label: "Fully scored",
      note: "Every factor must have data. A missing factor disqualifies a name rather than quietly re-weighting the model",
      width: 52,
      tone: "mint" as PastelTone,
    },
    {
      label: "Clears every gate",
      note: "Minimum rating plus per-factor floors on revisions and growth",
      width: 26,
      tone: "yellow" as PastelTone,
    },
    {
      label: "One pick",
      note: "The highest-conviction name still standing, published with the full thesis",
      width: 10,
      tone: "coral" as PastelTone,
    },
  ];

  return (
    <div className="data-card">
      <p className="panel-label panel-label-lilac mb-1">
        From the whole market to one name
      </p>
      <p className="mb-5 font-sans text-[12px] text-text-dim">
        Each evaluation runs the full funnel again from scratch. Widths are
        illustrative, not a live count.
      </p>
      <ol className="space-y-3.5">
        {stages.map((s, i) => (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline gap-2.5">
              <span className="font-mono text-[10px] tabular-nums text-text-dim">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-sans text-[13px] font-semibold text-text">
                {s.label}
              </span>
            </div>
            <div
              className={`h-7 rounded-lg ${TONE_BG[s.tone]}`}
              style={{ width: `${s.width}%` }}
              aria-hidden
            />
            <p className="mt-1.5 max-w-[520px] font-sans text-[12px] leading-relaxed text-text-dim">
              {s.note}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** What happens to a position after it is bought. */
export function PositionLifecycle({
  winnerThresholdPct,
  underwaterDays,
  capPct,
  trimToPct,
}: {
  winnerThresholdPct: number | null;
  underwaterDays: number | null;
  capPct: number | null;
  trimToPct: number | null;
}) {
  const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n)}%`);

  const steps = [
    {
      tone: "mint" as PastelTone,
      title: "Bought",
      body: "Funded equally with every other pick, so conviction is expressed by what we buy, not by how much.",
    },
    {
      tone: "cyan" as PastelTone,
      title: "Held and re-scored",
      body: "Re-ranked against its sector every cycle. The rating moves before the position does.",
    },
    {
      tone: "yellow" as PastelTone,
      title: `Trimmed above ${pct(capPct)} of the book`,
      body: `A single winner is not allowed to become the portfolio. Trimmed back toward ${pct(trimToPct)}.`,
    },
    {
      tone: "peach" as PastelTone,
      title: `Cost basis recovered at +${pct(winnerThresholdPct)}`,
      body: "When a pick has run far enough, we sell exactly the original stake and let the rest ride. From then on the position is playing with profit — and it is no longer capped.",
    },
    {
      tone: "coral" as PastelTone,
      title: "Exited",
      body: `Either the rating breaks down, or the position spends ${underwaterDays ?? "—"} days underwater without recovering. Both are rules, decided in advance.`,
    },
  ];

  return (
    <div className="data-card">
      <p className="panel-label panel-label-peach mb-5">
        The life of a position
      </p>
      <ol className="relative space-y-6 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-border">
        {steps.map((s) => (
          <li key={s.title} className="relative pl-7">
            <span
              className={`absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 border-bg ${TONE_BG[s.tone]}`}
              aria-hidden
            />
            <p className="font-sans text-[13px] font-semibold text-text">
              {s.title}
            </p>
            <p className="mt-1 max-w-[520px] font-sans text-[12px] leading-relaxed text-text-muted">
              {s.body}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
