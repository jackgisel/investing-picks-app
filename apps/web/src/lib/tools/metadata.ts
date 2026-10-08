import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import type { ToolDefinition } from "@/lib/tools/registry";

export function toolCanonicalPath(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

export function toolShareImageUrl(path: string): string {
  return `${toolCanonicalPath(path)}/opengraph-image`;
}

function queryParamHasValue(value: string | string[] | undefined): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.some((t) => t.trim());
  return false;
}

export function buildToolMetadata(
  tool: ToolDefinition,
  searchParams?: Record<string, string | string[] | undefined>,
): Metadata {
  const hasQuery =
    !!searchParams && Object.values(searchParams).some(queryParamHasValue);

  const canonical = tool.path;
  const image = toolShareImageUrl(tool.path);

  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    alternates: { canonical },
    robots: hasQuery
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

export function toolBreadcrumbItems(tool: ToolDefinition): {
  label: string;
  href: string;
}[] {
  const name = tool.metaTitle.includes(":")
    ? tool.metaTitle.slice(0, tool.metaTitle.indexOf(":")).trim()
    : tool.h1;
  return [
    { label: "Home", href: "/" },
    { label: "Free tools", href: "/tools" },
    { label: name, href: tool.path },
  ];
}

export type ToolJsonLd = {
  "@context": "https://schema.org";
  "@graph": [
    {
      "@type": "WebApplication";
      name: string;
      url: string;
      description: string;
      applicationCategory: "FinanceApplication";
      operatingSystem: "Any";
      isAccessibleForFree: true;
      offers: {
        "@type": "Offer";
        price: "0";
        priceCurrency: "USD";
      };
    },
    {
      "@type": "FAQPage";
      mainEntity: Array<{
        "@type": "Question";
        name: string;
        acceptedAnswer: { "@type": "Answer"; text: string };
      }>;
    },
    {
      "@type": "BreadcrumbList";
      itemListElement: Array<{
        "@type": "ListItem";
        position: number;
        name: string;
        item: string;
      }>;
    },
  ];
};

export function buildToolJsonLd(tool: ToolDefinition): ToolJsonLd {
  const url = toolCanonicalPath(tool.path);
  const name = tool.metaTitle.includes(":")
    ? tool.metaTitle.slice(0, tool.metaTitle.indexOf(":")).trim()
    : tool.h1;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name,
        url,
        description: tool.metaDescription,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: tool.faq.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: toolBreadcrumbItems(tool).map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.label,
          item: item.href === "/" ? SITE_URL : toolCanonicalPath(item.href),
        })),
      },
    ],
  };
}
