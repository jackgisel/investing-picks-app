/**
 * Dithered landscape prints — two-tone, risograph texture.
 *
 * These are editorial texture, not product photography. Keep them off the
 * landing hero (that plane is the lunar shot). They belong on blog mastheads,
 * content emails, login, and secondary marketing surfaces where the page is
 * otherwise flat type on white.
 *
 * Shared pool pieces (`ART`) are fine for login, emails outside the weekly
 * window, and as a fallback. Blog posts should prefer a unique `meta.cover`
 * under /public/art/covers/ (claim from /art/pool/spare-*.png via
 * `nextSpareCover()`). Weekly review and pick emails use /art/pool/{ISO-week}.png
 * when that week was pre-generated — see `lib/art-pool.ts`.
 */

export type ArtPiece = {
  id: string;
  /** Public path under /public */
  src: string;
  /** Short alt for decorative use — empty string if aria-hidden on the parent */
  label: string;
  /** Ink colour baked into the dither (for matching UI accents) */
  ink: string;
};

export const ART: readonly ArtPiece[] = [
  {
    id: "rio",
    src: "/art/rio.png",
    label: "Dithered view of Rio de Janeiro",
    ink: "#1B4D3E",
  },
  {
    id: "fuji",
    src: "/art/fuji.png",
    label: "Dithered view of Mount Fuji and a pagoda",
    ink: "#2F5A8C",
  },
  {
    id: "citadel",
    src: "/art/citadel.png",
    label: "Dithered mountain city with a classical temple",
    ink: "#1E3A8A",
  },
  {
    id: "harbor",
    src: "/art/harbor.png",
    label: "Dithered coastal harbor town",
    ink: "#0F5C5C",
  },
] as const;

/** Fixed piece for the login surface — calm, not a blog-cover collision. */
export const LOGIN_ART: ArtPiece = ART[1]; // fuji

/** Stable pick from a string key (slug, ticker, week id). */
export function artForKey(key: string): ArtPiece {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return ART[h % ART.length];
}

/**
 * Resolve art for a blog article.
 *
 * Prefer an explicit cover path on the meta; otherwise fall back to the shared
 * pool so unpublished / WIP posts still render.
 */
export function artForArticle(meta: {
  slug: string;
  cover?: string;
}): ArtPiece {
  if (meta.cover) {
    return {
      id: meta.slug,
      src: meta.cover,
      label: `Cover for ${meta.slug}`,
      ink: ART[0].ink,
    };
  }
  return artForKey(meta.slug);
}

/** Absolute URL for email <img> tags. */
export function artAbsoluteUrl(piece: ArtPiece, siteUrl: string): string {
  const base = siteUrl.replace(/\/$/, "");
  return `${base}${piece.src}`;
}
