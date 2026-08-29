import { ACCENTS, COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { SlideFrame } from "../components/SlideFrame";
import { useEnter } from "../motion";

export function QuoteSlide({
  chapter,
  accent,
  text,
  attribution,
}: {
  chapter: string;
  accent: AccentName;
  text: string;
  attribution?: string;
}) {
  const mark = useEnter(0);
  const quoteEnter = useEnter(6);
  const attrEnter = useEnter(16);

  return (
    <SlideFrame chapter={chapter} accent={accent} contentStyle={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, textAlign: "center", maxWidth: 1440 }}>
        <span
          style={{
            opacity: mark.opacity,
            transform: mark.transform,
            fontFamily: "Outfit",
            fontSize: 96,
            fontWeight: 800,
            color: ACCENTS[accent],
            lineHeight: 0.6,
          }}
        >
          "
        </span>
        <p
          style={{
            opacity: quoteEnter.opacity,
            transform: quoteEnter.transform,
            fontFamily: "Outfit",
            fontSize: 48,
            fontWeight: 600,
            color: COLORS.text,
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {text}
        </p>
        {attribution && (
          <span
            style={{
              opacity: attrEnter.opacity,
              transform: attrEnter.transform,
              fontFamily: "'IBM Plex Mono'",
              fontSize: 18,
              color: COLORS.textDim,
              letterSpacing: "0.04em",
            }}
          >
            {attribution}
          </span>
        )}
      </div>
    </SlideFrame>
  );
}
