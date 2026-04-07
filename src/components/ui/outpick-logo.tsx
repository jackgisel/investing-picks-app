interface LogoProps {
  size?: number;
  className?: string;
}

export function OutpickLogo({ size = 24, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main arc — nearly complete circle, tight gap in upper-right */}
      <path
        d="M21.07 5.12A12 12 0 1 0 26.88 10.93"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      {/* Breakaway dot — the pick that escapes average */}
      <circle cx={26.6} cy={5.4} r={2} fill="currentColor" />
    </svg>
  );
}

export function OutpickWordmark({ size = 24, className }: LogoProps) {
  return (
    <span className={`flex items-center gap-3 ${className ?? ""}`}>
      <OutpickLogo size={size} className="text-accent-green" />
      <span className="font-mono text-[13px] font-semibold tracking-[2.5px] text-text hidden sm:inline">
        OUTPICK
      </span>
    </span>
  );
}
