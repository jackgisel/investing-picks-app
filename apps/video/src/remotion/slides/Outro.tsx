import { COLORS } from "../../theme";
import type { AccentName } from "../../types";
import { OutpickWordmark } from "../components/OutpickMark";
import { SlideFrame } from "../components/SlideFrame";
import { STAGGER_FRAMES, useEnter } from "../motion";

function OutroLine({ text, index }: { text: string; index: number }) {
  const enter = useEnter(16 + index * STAGGER_FRAMES * 4);
  return (
    <p
      style={{
        opacity: enter.opacity,
        transform: enter.transform,
        fontFamily: "Outfit",
        fontSize: 26,
        color: COLORS.textMuted,
        margin: 0,
      }}
    >
      {text}
    </p>
  );
}

export function OutroSlide({
  chapter,
  accent,
  heading,
  lines,
}: {
  chapter: string;
  accent: AccentName;
  heading: string;
  lines: string[];
}) {
  const mark = useEnter(0);
  const headingEnter = useEnter(8);

  return (
    <SlideFrame chapter={chapter} accent={accent} contentStyle={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, textAlign: "center" }}>
        <div style={{ opacity: mark.opacity, transform: mark.transform }}>
          <OutpickWordmark size={30} />
        </div>
        <h2
          style={{
            opacity: headingEnter.opacity,
            transform: headingEnter.transform,
            fontFamily: "Outfit",
            fontSize: 52,
            fontWeight: 800,
            color: COLORS.text,
            margin: 0,
            maxWidth: 1300,
          }}
        >
          {heading}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          {lines.map((text, i) => (
            <OutroLine key={text} text={text} index={i} />
          ))}
        </div>
      </div>
    </SlideFrame>
  );
}
