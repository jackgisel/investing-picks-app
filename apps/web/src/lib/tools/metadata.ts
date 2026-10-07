import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import type { ToolDefinition } from "@/lib/tools/registry";

export function toolCanonicalPath(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

export function toolShareImageUrl(path: string): string {
  return `${toolCanonicalPath(path)}/opengraph-image`;
}

export function buildToolMetadata(
  tool: ToolDefinition,
  searchParams?: { ticker?: string | string[] },
): Metadata {
  const tickerParam = searchParams?.ticker;
  const hasTickerQuery =
    typeof tickerParam === "string"
      ? tickerParam.trim().length > 0
      : Array.isArray(tickerParam) && tickerParam.some((t) => t.trim());

  const canonical = tool.path;
  const image = toolShareImageUrl(tool.path);

  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    alternates: { canonical },
    robots: hasTickerQuery
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      title: tool.metaTitle,
      description: tool.metaDescription,
      url: toolCanonicalPath(tool.path),
      siteName: SITE_NAME,
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: tool.metaTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: tool.metaTitle,
      description: tool.metaDescription,
      images: [image],
    },
  };
}

export function buildToolsIndexMetadata(): Metadata {
  const path = "/tools";
  const title = "Free investing tools, calculators and a stock picking game";
  const description =
    "Free tools from Outpick: a ten year Beat the S&P 500 challenge, intrinsic value and free cash flow worksheets, margin and moat checks, downside risk, and portfolio weight math.";
  const image = toolShareImageUrl(path);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: toolCanonicalPath(path),
      siteName: SITE_NAME,
      type: "website",
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
