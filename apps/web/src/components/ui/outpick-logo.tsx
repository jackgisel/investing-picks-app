import { cn } from "@/lib/utils";

/**
 * Brand pastels — accents only (tags, pick tip). Never rainbow-letter the
 * wordmark. These hold up unchanged on both light and dark grounds (see the
 * dark-mode token spec — decorative accents are already mid-tone pastels),
 * so they stay as literal hex. `ink` is deliberately NOT in this table: the
 * research-ring stroke needs to flip with the theme (near-black on light,
 * near-white on dark), so it renders with `currentColor` instead — see
 * `OutpickLogo` below.
 */
export const BRAND = {
  yellow: "#F5D76E",
  peach: "#F0A86C",
  lilac: "#C4B0E0",
  mint: "#A8D9A0",
} as const;

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Outpick mark — “The Pick”
 * An ink research ring closed by a mint conviction tip.
 * One accent color. Built for trust, not play.
 */
export function OutpickLogo({ size = 24, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-text", className)}
      aria-hidden
    >
      {/* The ring is `currentColor`, not a literal ink hex, so it inverts with
          the theme (near-black on light, near-white on dark) instead of
          disappearing into a dark background. `text-text` on the <svg> sets
          the default; any ancestor with its own text color (e.g. the
          wordmark's text-text span) will already match, so this is a no-op
          there and only matters when the mark is used on its own. */}
      <path
        d="M21.2 5.4A11 11 0 1 0 26.6 11.2"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
      <circle cx={25.8} cy={6.2} r={2.35} fill={BRAND.mint} />
    </svg>
  );
}

/**
 * Wordmark — solid ink type + optional pick mark.
 * Pastels live in the mark tip only.
 */
export function OutpickWordmark({
  size = 22,
  className,
  mark = true,
}: LogoProps & { mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark && <OutpickLogo size={size} />}
      <span className="font-sans text-[18px] sm:text-[22px] font-extrabold tracking-[0.1em] text-text uppercase leading-none">
        Outpick
      </span>
    </span>
  );
}
