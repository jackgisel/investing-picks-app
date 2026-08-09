import { describe, expect, it } from "vitest";
import {
  productUpdateText,
  renderProductUpdateBody,
} from "@/lib/product-updates";

/**
 * The one place in the email layer that turns author-supplied text into HTML.
 *
 * Escaping is the whole point: this is the only template that does not escape
 * its own input at the boundary, because it has to emit tags. So the tests that
 * matter are the ones proving a tag in the SOURCE never becomes a tag in the
 * output.
 */

describe("renderProductUpdateBody", () => {
  it("escapes HTML in the source", () => {
    const html = renderProductUpdateBody("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML inside a link label", () => {
    const html = renderProductUpdateBody("[<b>hi</b>](https://example.com)");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain('href="https://example.com"');
  });

  it("refuses a javascript: URL rather than linking it", () => {
    // The scheme allowlist. An admin is the author, but an anchor that runs
    // script is not something to leave available in a mail template.
    //
    // The literal text still appears — it is rendered as inert escaped prose,
    // which is the point. What must never happen is it reaching an href, so
    // that is what this asserts rather than the string being absent.
    const html = renderProductUpdateBody("[click](javascript:alert(1))");
    expect(html).not.toContain("<a href");
    expect(html).not.toMatch(/href=["']javascript:/);
    expect(html).toContain("[click]");
  });

  it("refuses a data: URL", () => {
    const html = renderProductUpdateBody("[x](data:text/html,<script>)");
    expect(html).not.toContain("<a href");
  });

  it("renders http and mailto links", () => {
    expect(renderProductUpdateBody("[a](https://x.com)")).toContain(
      'href="https://x.com"',
    );
    expect(renderProductUpdateBody("[b](mailto:a@b.c)")).toContain(
      'href="mailto:a@b.c"',
    );
  });

  it("renders bold, italic and code", () => {
    const html = renderProductUpdateBody("**bold** and *italic* and `code`");
    expect(html).toContain("<strong");
    expect(html).toContain("<em>");
    expect(html).toContain("<code");
  });

  it("renders bullet lists", () => {
    const html = renderProductUpdateBody("- one\n- two");
    expect(html).toContain("<ul");
    expect((html.match(/<li/g) ?? []).length).toBe(2);
  });

  it("renders headings", () => {
    expect(renderProductUpdateBody("## What shipped")).toContain("<h2");
  });

  it("gives every element an inline style", () => {
    // Email clients strip stylesheets. An element without inline styles is an
    // element that arrives unstyled, which is the reason this renderer exists
    // instead of a general-purpose markdown library.
    const html = renderProductUpdateBody(
      "## Head\n\nA paragraph.\n\n- a bullet",
    );
    for (const tag of ["<h2", "<p", "<ul", "<li"]) {
      const at = html.indexOf(tag);
      expect(at, `${tag} missing`).toBeGreaterThan(-1);
      expect(html.slice(at, html.indexOf(">", at))).toContain("style=");
    }
  });

  it("keeps paragraphs separate", () => {
    const html = renderProductUpdateBody("First.\n\nSecond.");
    expect((html.match(/<p /g) ?? []).length).toBe(2);
  });

  it("survives an empty body", () => {
    expect(renderProductUpdateBody("")).toBe("");
    expect(renderProductUpdateBody("   \n\n  ")).toBe("");
  });
});

describe("productUpdateText", () => {
  it("strips syntax and keeps the link target", () => {
    expect(productUpdateText("**Big** news: [here](https://x.com)")).toBe(
      "Big news: here (https://x.com)",
    );
  });

  it("drops heading markers", () => {
    expect(productUpdateText("## Title\n\nBody.")).toBe("Title\n\nBody.");
  });
});
