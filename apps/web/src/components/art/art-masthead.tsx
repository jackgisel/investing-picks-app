import Image from "next/image";
import type { ArtPiece } from "@/lib/art";

/**
 * Full-bleed dithered landscape for blog / editorial headers.
 *
 * The print sits behind a soft scrim so type stays readable. Fade the bottom
 * into the page ground so it meets the body without a hard crop line.
 */
export function ArtMasthead({
  art,
  className = "",
  /** Taller on featured/index; shorter on article headers. */
  size = "md",
}: {
  art: ArtPiece;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const height =
    size === "lg"
      ? "h-[220px] sm:h-[280px] lg:h-[320px]"
      : size === "sm"
        ? "h-[120px] sm:h-[140px]"
        : "h-[160px] sm:h-[200px] lg:h-[220px]";

  return (
    <div
      aria-hidden
      className={`relative overflow-hidden ${height} ${className}`}
    >
      <Image
        src={art.src}
        alt=""
        fill
        sizes="100vw"
        className="object-cover object-center"
        priority={size === "lg"}
      />
      {/* Keep ink readable in light mode; let more texture show through. */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-bg/10 dark:from-bg dark:via-bg/40 dark:to-bg/20" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}

/**
 * Compact art strip for article cards — same dither language, no full bleed.
 */
export function ArtThumb({
  art,
  className = "",
}: {
  art: ArtPiece;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-t-[inherit] ${className}`}
    >
      <Image
        src={art.src}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 33vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-bg/10 dark:bg-bg/25" />
    </div>
  );
}
