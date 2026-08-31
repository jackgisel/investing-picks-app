import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard/",
        "/insights",
        "/insights/",
        "/login",
        "/subscribe",
        "/welcome",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
