/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Cap ISR stale-while-revalidate. Next's default is one year, which is
  // how a successful Railway deploy of public HTML still served last week's
  // prerender (empty live return, old pricing copy). Must stay in sync with
  // PUBLIC_PAGE_EXPIRE_SECONDS in src/lib/public-cache.ts (60).
  expireTime: 60,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  async redirects() {
    // Insights moved inside the dashboard shell. These URLs were subscriber-
    // gated and noindex, so nothing public depended on them, but a blog post
    // and any bookmark a member kept still point here.
    //
    // 307, not 308: browsers cache permanent redirects hard, and this is a
    // layout decision we might revisit. Nothing about SEO argues for 308 —
    // both locations are noindex.
    return [
      { source: "/insights", destination: "/dashboard/insights", permanent: false },
      // /dashboard/performance is a real page again. It was folded into the
      // dashboard index when it merely repeated that page's banner, tiles and
      // chart; it now carries the range-selectable curve and the short-horizon
      // numbers, and the index carries neither. The redirect was deliberately
      // 307 so this could be undone without fighting a cached 308.
      // Portfolio, Pick history and Trades were three views of one object.
      { source: "/dashboard/portfolio", destination: "/dashboard/positions", permanent: false },
      { source: "/dashboard/picks", destination: "/dashboard/positions", permanent: false },
      { source: "/dashboard/trades", destination: "/dashboard/positions", permanent: false },
      {
        source: "/insights/:slug",
        destination: "/dashboard/insights/:slug",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
