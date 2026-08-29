/**
 * The Outpick mark, copied verbatim from `apps/web/src/components/ui/
 * outpick-logo.tsx` (`OutpickLogo`) — same viewBox, same path, same ring +
 * conviction-tip construction. The site renders the ring with `currentColor`
 * so it inverts with the page theme; the deck is always dark, so it is
 * pinned to `COLORS.text` here instead of relying on CSS inheritance.
 */

import { COLORS } from "../../theme";

export function OutpickMark({ size = 28, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M21.2 5.4A11 11 0 1 0 26.6 11.2" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={25.8} cy={6.2} r={2.35} fill={COLORS.mint} />
    </svg>
  );
}

export function OutpickWordmark({ size = 24, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.45 }}>
      <OutpickMark size={size} color={color} />
      <span
        style={{
          fontFamily: "Outfit",
          fontSize: size * 0.85,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color,
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        Outpick
      </span>
    </span>
  );
}
