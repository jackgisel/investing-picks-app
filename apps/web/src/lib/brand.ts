export const SITE_BRAND =
  process.env.NEXT_PUBLIC_OUTPICK_BRAND === "classic"
    ? "classic"
    : "heritage";

export type SiteBrand = typeof SITE_BRAND;
