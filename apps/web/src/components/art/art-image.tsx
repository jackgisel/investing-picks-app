import type { ArtPiece } from "@/lib/art";
import { artSrcSet } from "@/lib/art";

/**
 * A dithered print as a plain `<img>` that fills its (relative) parent.
 *
 * Deliberately not `next/image`. The prints are 2–8 flat tones, and the
 * optimiser's lossy WebP is the worst possible encoder for that: it turned the
 * 111KB /art/fuji.png into a 902KB response at w=1920 and made /blog ship
 * 2.6MB of thumbnails. The palette PNGs in /public (plus their pre-rendered
 * `-<width>w` siblings, see scripts/optimize-art.mjs) are 3–20× smaller and
 * pixel-exact, and skipping the optimiser also lets the CDN cache them.
 *
 * `priority` marks the image as the page's LCP candidate: eager with a high
 * fetch priority. React 19's server renderer hoists a matching
 * `<link rel="preload" as="image" imagesrcset imagesizes>` into the `<head>`
 * for any non-lazy `<img>` it renders in the shell, so the request starts
 * before the parser reaches the element. Do not add `ReactDOM.preload()` for
 * this: Flight ships that hint with the RSC payload, so a prefetched
 * `<Link href="/blog">` in the navbar made every other page download the blog
 * masthead. Everything else lazy-loads.
 */
export function ArtImage({
  art,
  sizes,
  className = "",
  priority = false,
}: {
  art: ArtPiece;
  /** Layout width hint for the srcset, e.g. `100vw` or `(max-width: 640px) 100vw, 33vw`. */
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={art.src}
      srcSet={artSrcSet(art)}
      sizes={sizes}
      alt=""
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
