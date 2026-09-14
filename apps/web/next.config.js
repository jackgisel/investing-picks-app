/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // First-party DataFast proxy so ad blockers do not drop pageviews or
  // revenue cookies. `/api/events` is reserved for the app, so events go to
  // `/datafast-events` via data-api-url on the tracking script.
  async rewrites() {
    return [
      {
        source: "/js/script.js",
        destination: "https://datafa.st/js/script.js",
      },
      {
        source: "/datafast-events",
        destination: "https://datafa.st/api/events",
      },
    ];
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
      // Admin communication pages folded into one tabbed surface.
      {
        source: "/dashboard/dca",
        destination: "/dashboard/ops/communication?tab=friday-stock-pick",
        permanent: false,
      },
      {
        source: "/dashboard/ops/weekly-review",
        destination:
          "/dashboard/ops/communication?tab=friday-portfolio-review",
        permanent: false,
      },
      {
        source: "/dashboard/ops/market-note",
        destination:
          "/dashboard/ops/communication?tab=sunday-market-preview",
        permanent: false,
      },
      {
        source: "/dashboard/ops/x-threads",
        destination: "/dashboard/ops/communication?tab=x-threads",
        permanent: false,
      },
      {
        source: "/dashboard/ops/product-updates",
        destination: "/dashboard/ops/communication?tab=product-updates",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
