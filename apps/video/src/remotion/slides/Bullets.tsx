import { ACCENTS, COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { SlideFrame } from "../components/SlideFrame";
import { STAGGER_FRAMES, useEnter } from "../motion";

function BulletRow({ text, accent, index }: { text: string; accent: AccentName; index: number }) {
  const enter = useEnter(10 + index * STAGGER_FRAMES * 4);
  return (
    <div style={{ opacity: enter.opacity, transform: enter.transform, display: "flex", gap: 22, alignItems: "flex-start" }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: ACCENTS[accent],
          marginTop: 12,
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: "Outfit", fontSize: 30, color: COLORS.text, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

export function BulletsSlide({
  chapter,
  accent,
  heading,
  items,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  items: string[];
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
          margin: "0 0 48px 0",
        }}
      >
        {heading}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 34, flex: 1, justifyContent: "center" }}>
        {items.map((text, i) => (
          <BulletRow key={text} text={text} accent={accent} index={i} />
        ))}
      </div>
    </SlideFrame>
  );
}
