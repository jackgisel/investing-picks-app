import { preload } from "react-dom";
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
 * `priority` marks the image as the page's LCP candidate: eager, high fetch
 * priority, and a hoisted preload so it is requested from the `<head>` rather
 * than when the parser reaches it. Everything else lazy-loads.
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
  const srcSet = artSrcSet(art);
  if (priority) {
    preload(art.src, {
      as: "image",
      imageSrcSet: srcSet,
      imageSizes: sizes,
      fetchPriority: "high",
    });
  }
  return (
    <img
      src={art.src}
      srcSet={srcSet}
      sizes={sizes}
      alt=""
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
    />
  );
}
