import { describe, expect, it } from "vitest";
import { TOOL_DEFINITIONS } from "@/lib/tools/registry";
import {
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
