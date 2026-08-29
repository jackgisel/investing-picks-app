import { COLORS } from "../../theme";
import type { AccentName, HoldingFact } from "../../types";
import { HoldingsTable } from "../charts/HoldingsTable";
import { SlideFrame } from "../components/SlideFrame";
import { useEnter } from "../motion";

export function HoldingsSlide({
  chapter,
  accent,
  heading,
  caption,
  holdings,
  limit,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  caption?: string;
  holdings: HoldingFact[];
  limit?: number;
}) {
  const headingEnter = useEnter(0);
  const rows = typeof limit === "number" ? holdings.slice(0, limit) : holdings;

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
        <HoldingsTable holdings={rows} width={1664} height={720} />
      </div>
    </SlideFrame>
  );
}
