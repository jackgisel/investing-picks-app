import type { ArtPiece } from "@/lib/art";
import { ArtImage } from "@/components/art/art-image";
import { NearViewport } from "@/components/ui/near-viewport";

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
  fade = true,
  /**
   * The masthead is the largest thing above the fold wherever it appears, so
   * callers that render it at the top of a page should mark it as the LCP
   * image. Defaults on for the tall index variant.
   */
  priority = size === "lg",
}: {
  art: ArtPiece;
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * Blog headers fade into the page so type can sit on the print. Email-style
   * surfaces (research notes) want the crop, not the scrim.
   */
  fade?: boolean;
  priority?: boolean;
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
      <ArtImage
        art={art}
        sizes="100vw"
        className="object-center"
        priority={priority}
      />
      {fade ? (
        <>
          {/* Keep ink readable in light mode; let more texture show through. */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-bg/10 dark:from-bg dark:via-bg/40 dark:to-bg/20" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-bg to-transparent" />
        </>
      ) : null}
    </div>
  );
}

/**
 * Compact art strip for article cards — same dither language, no full bleed.
 *
 * `sizes` defaults to the blog grid (one column, then two, then three). The
 * featured card spans the container and passes its own.
 *
 * The strip is decoration, so it is not in the server HTML at all until the
 * card is within a viewport of the fold (NearViewport). The box keeps its
 * height meanwhile, so nothing shifts when the print lands.
 */
export function ArtThumb({
  art,
  className = "",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
}: {
  art: ArtPiece;
  className?: string;
  sizes?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-t-[inherit] ${className}`}
    >
      <NearViewport className="absolute inset-0">
        <ArtImage art={art} sizes={sizes} className="object-center" />
      </NearViewport>
      <div className="absolute inset-0 bg-bg/10 dark:bg-bg/25" />
    </div>
  );
}
