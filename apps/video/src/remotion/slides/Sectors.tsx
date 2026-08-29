import { COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { SectorBars } from "../charts/SectorBars";
import { SlideFrame } from "../components/SlideFrame";
import { useEnter } from "../motion";

export function SectorsSlide({
  chapter,
  accent,
  heading,
  caption,
  sectors,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  caption?: string;
  sectors: { sector: string; count: number; sharePct: number }[];
}) {
  const headingEnter = useEnter(0);

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
        <SectorBars sectors={sectors} width={1400} />
      </div>
    </SlideFrame>
  );
}
