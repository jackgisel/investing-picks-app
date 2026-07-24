import { cn } from "@/lib/utils";

/** Brand pastels — accents only (tags, pick tip). Never rainbow-letter the wordmark. */
export const BRAND = {
  yellow: "#F5D76E",
  peach: "#F0A86C",
  lilac: "#C4B0E0",
  mint: "#A8D9A0",
  ink: "#0A0A0A",
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
      className={className}
      aria-hidden
    >
      <path
        d="M21.2 5.4A11 11 0 1 0 26.6 11.2"
        stroke={BRAND.ink}
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
