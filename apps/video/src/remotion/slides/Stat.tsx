import { COLORS } from "../../theme";
import type { AccentName, StatItem } from "../../types";
import { SlideFrame } from "../components/SlideFrame";
import { StatCard } from "../components/StatCard";
import { STAGGER_FRAMES, useEnter } from "../motion";

export function StatSlide({
  chapter,
  accent,
  heading,
  stats,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  stats: StatItem[];
}) {
  const headingEnter = useEnter(0);

  return (
    <SlideFrame chapter={chapter} accent={accent}>
      <h2
        style={{
          opacity: headingEnter.opacity,
          transform: headingEnter.transform,
          fontFamily: "Outfit",
          fontSize: 44,
          fontWeight: 700,
          color: COLORS.text,
          margin: "0 0 56px 0",
        }}
      >
        {heading}
      </h2>
      <div style={{ display: "flex", gap: 28, flex: 1, alignItems: "center" }}>
        {stats.map((s, i) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            sub={s.sub}
            tone={s.tone ?? "neutral"}
            delayFrames={10 + i * STAGGER_FRAMES * 3}
          />
        ))}
      </div>
    </SlideFrame>
  );
}
