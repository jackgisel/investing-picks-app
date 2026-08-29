import { interpolate } from "remotion";
import { COLORS, BENCHMARK_STYLES, PICKS_COLOR } from "../../theme";
import type { AccentName, ChartFact } from "../../types";
import { PicksBenchmarkChart } from "../charts/PicksBenchmarkChart";
import { SlideFrame } from "../components/SlideFrame";
import { formatPct } from "../format";
import { useDrawProgress, useEnter } from "../motion";

function LegendSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width={26} height={6} viewBox="0 0 26 6" aria-hidden>
      <line x1={0} y1={3} x2={26} y2={3} stroke={color} strokeWidth={2.5} strokeDasharray={dash} />
    </svg>
  );
}

export function PicksChartSlide({
  chapter,
  accent,
  heading,
  caption,
  chart,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  caption?: string;
  chart: ChartFact;
}) {
  const headingEnter = useEnter(0);
  const legendEnter = useEnter(12);
  // Draw across most of the scene, finishing well before the tail hold.
  const progress = useDrawProgress(6, 130);
  // Every final value — the in-chart callout AND the legend's numbers —
  // fades in together right as the line finishes drawing, so the legend
  // doesn't spoil the outcome for a viewer still watching the draw
  // (DESIGN.md: "final value labels fade in at the end of the draw").
  const valueOpacity = interpolate(progress, [0.92, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SlideFrame chapter={chapter} accent={accent}>
      <div style={{ opacity: headingEnter.opacity, transform: headingEnter.transform }}>
        <h2 style={{ fontFamily: "Outfit", fontSize: 44, fontWeight: 700, color: COLORS.text, margin: 0 }}>
          {heading}
        </h2>
        {caption && (
          <p style={{ fontFamily: "Outfit", fontSize: 18, color: COLORS.textMuted, margin: "10px 0 0 0" }}>
            {caption}
          </p>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 24 }}>
        <PicksBenchmarkChart chart={chart} progress={progress} width={1560} height={540} />
      </div>
      <div
        style={{
          opacity: legendEnter.opacity,
          transform: legendEnter.transform,
          display: "flex",
          gap: 32,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LegendSwatch color={PICKS_COLOR} />
          <span style={{ fontFamily: "Outfit", fontSize: 17, fontWeight: 700, color: COLORS.text }}>
            Outpick picks
          </span>
          {chart.picksLatestPct !== null && (
            <span
              style={{
                opacity: valueOpacity,
                fontFamily: "'IBM Plex Mono'",
                fontSize: 17,
                fontWeight: 700,
                color: PICKS_COLOR,
              }}
            >
              {formatPct(chart.picksLatestPct)}
            </span>
          )}
        </span>
        {chart.benchmarks.map((b) => {
          const style = BENCHMARK_STYLES[b.key] ?? { color: COLORS.textDim, dash: "4 4" };
          return (
            <span key={b.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <LegendSwatch color={style.color} dash={style.dash} />
              <span style={{ fontFamily: "Outfit", fontSize: 16, color: COLORS.textMuted }}>{b.label}</span>
              {b.latestPct !== null && (
                <span style={{ opacity: valueOpacity, fontFamily: "'IBM Plex Mono'", fontSize: 15, color: COLORS.textDim }}>
                  {formatPct(b.latestPct)}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </SlideFrame>
  );
}
