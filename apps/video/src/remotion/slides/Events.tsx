import { ACCENTS, COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { SlideFrame } from "../components/SlideFrame";
import { STAGGER_FRAMES, useEnter } from "../motion";

function EventRow({
  label,
  detail,
  accent,
  index,
}: {
  label: string;
  detail: string;
  accent: AccentName;
  index: number;
}) {
  const enter = useEnter(10 + index * STAGGER_FRAMES * 4);
  return (
    <div
      style={{
        opacity: enter.opacity,
        transform: enter.transform,
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
        padding: "22px 0",
        borderBottom: `1px solid ${COLORS.border}`,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 999, background: ACCENTS[accent], marginTop: 10, flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontFamily: "Outfit", fontSize: 24, fontWeight: 700, color: COLORS.text }}>{label}</span>
        <span style={{ fontFamily: "Outfit", fontSize: 19, color: COLORS.textMuted, lineHeight: 1.4 }}>{detail}</span>
      </div>
    </div>
  );
}

export function EventsSlide({
  chapter,
  accent,
  heading,
  items,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  items: { label: string; detail: string }[];
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
          margin: "0 0 32px 0",
        }}
      >
        {heading}
      </h2>
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
          {items.map((item, i) => (
            <EventRow key={item.label} label={item.label} detail={item.detail} accent={accent} index={i} />
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
