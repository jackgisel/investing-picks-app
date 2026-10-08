import { describe, expect, it } from "vitest";
import { TOOL_BY_ID, TOOL_DEFINITIONS } from "@/lib/tools/registry";
import {
  buildToolJsonLd,
  buildToolMetadata,
  buildToolsIndexMetadata,
  toolShareImageUrl,
} from "@/lib/tools/metadata";

describe("tool metadata", () => {
  it("uses absolute share image URLs and canonical paths", () => {
    const index = buildToolsIndexMetadata();
    expect(index.alternates?.canonical).toBe("/tools");
    const og = index.openGraph?.images?.[0];
    expect(og && typeof og === "object" && "url" in og ? og.url : og).toBe(
      "https://outpick.xyz/tools/opengraph-image",
    );
    expect(index.twitter?.images?.[0]).toBe(
      "https://outpick.xyz/tools/opengraph-image",
    );
  });

  it("noindexes ticker query variants", () => {
    const tool = TOOL_DEFINITIONS[0];
    const bare = buildToolMetadata(tool);
    expect(bare.robots).toEqual({ index: true, follow: true });

    const withTicker = buildToolMetadata(tool, { ticker: "MSFT" });
    expect(withTicker.robots).toEqual({ index: false, follow: true });
    expect(withTicker.alternates?.canonical).toBe(tool.path);

    const withShareQuery = buildToolMetadata(tool, { shares: "100", avg: "60" });
    expect(withShareQuery.robots).toEqual({ index: false, follow: true });
    expect(withShareQuery.alternates?.canonical).toBe(tool.path);
  });

  it("emits WebApplication and FAQPage JSON-LD from the same FAQ copy", () => {
    const tool = TOOL_BY_ID["average-down-calculator"];
    const jsonLd = buildToolJsonLd(tool);
    expect(jsonLd["@graph"][0]).toMatchObject({
      "@type": "WebApplication",
      name: "Average Down Calculator",
      applicationCategory: "FinanceApplication",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    });
    const faq = jsonLd["@graph"][1];
    const crumbs = jsonLd["@graph"][2];
    expect(faq["@type"]).toBe("FAQPage");
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement.map((c) => c.name)).toEqual([
      "Home",
      "Free tools",
      "Average Down Calculator",
    ]);
    expect(faq.mainEntity).toHaveLength(tool.faq.length);
    for (const [i, item] of tool.faq.entries()) {
      expect(faq.mainEntity[i]?.name).toBe(item.q);
      expect(faq.mainEntity[i]?.acceptedAnswer.text).toBe(item.a);
    }
    expect(tool.faq.some((item) => item.q === "Is this financial advice?")).toBe(
      true,
    );
    expect(tool.metaTitle.length).toBeGreaterThanOrEqual(55);
    expect(tool.metaTitle.length).toBeLessThanOrEqual(60);
    expect(tool.metaDescription.length).toBeGreaterThanOrEqual(140);
    expect(tool.metaDescription.length).toBeLessThanOrEqual(160);
    expect(tool.metaTitle.startsWith("Average Down Calculator")).toBe(true);
  });

  it("covers every tool with large image cards", () => {
    for (const tool of TOOL_DEFINITIONS) {
      const meta = buildToolMetadata(tool);
      expect(meta.title).toBe(tool.metaTitle);
      expect(meta.description).toBe(tool.metaDescription);
      expect(toolShareImageUrl(tool.path)).toBe(
        `https://outpick.xyz${tool.path}/opengraph-image`,
      );
      expect(meta.openGraph?.images?.[0]).toMatchObject({
        url: toolShareImageUrl(tool.path),
        width: 1200,
        height: 630,
      });
      expect(meta.twitter?.card).toBe("summary_large_image");
      expect(meta.twitter?.images?.[0]).toBe(toolShareImageUrl(tool.path));
    }
  });
});
