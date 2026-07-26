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
      // Performance folded into the dashboard index — it repeated the same
      // live status banner, the same three stat tiles and the same chart.
      {
        source: "/dashboard/performance",
        destination: "/dashboard",
        permanent: false,
      },
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
