import { COLORS } from "../../theme";
import type { AccentName, PeriodFact } from "../../types";
import { PeriodBars } from "../charts/PeriodBars";
import { SlideFrame } from "../components/SlideFrame";
import { useDrawProgress, useEnter } from "../motion";

export function PeriodBarsSlide({
  chapter,
  accent,
  heading,
  caption,
  periods,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  caption?: string;
  periods: PeriodFact[];
}) {
  const headingEnter = useEnter(0);
  const progress = useDrawProgress(10, 40);

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
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PeriodBars periods={periods} progress={progress} width={1400} />
      </div>
    </SlideFrame>
  );
}
