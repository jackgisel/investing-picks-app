import { COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { OutpickWordmark } from "../components/OutpickMark";
import { SlideFrame } from "../components/SlideFrame";
import { useEnter } from "../motion";

export function TitleSlide({
  chapter,
  accent,
  title,
  subtitle,
  periodLabel,
}: {
  chapter: string;
  accent: AccentName;
  title: string;
  subtitle: string;
  periodLabel: string;
}) {
  const mark = useEnter(0);
  const heading = useEnter(6);
  const sub = useEnter(14);
  const chip = useEnter(22);

  return (
    <SlideFrame chapter={chapter} accent={accent} contentStyle={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36, textAlign: "center" }}>
        <div style={{ opacity: mark.opacity, transform: mark.transform }}>
          <OutpickWordmark size={30} />
        </div>
        <h1
          style={{
            opacity: heading.opacity,
            transform: heading.transform,
            fontFamily: "Outfit",
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: "-0.01em",
            color: COLORS.text,
            maxWidth: 1400,
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            opacity: sub.opacity,
            transform: sub.transform,
            fontFamily: "Outfit",
            fontSize: 30,
            color: COLORS.textMuted,
            maxWidth: 1200,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </p>
        <span
          style={{
            opacity: chip.opacity,
            transform: chip.transform,
            fontFamily: "'IBM Plex Mono'",
            fontSize: 18,
            color: COLORS.textDim,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 999,
            padding: "10px 24px",
          }}
        >
          {periodLabel}
        </span>
      </div>
    </SlideFrame>
  );
}
