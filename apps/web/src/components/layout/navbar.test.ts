import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "navbar.tsx"), "utf8");

describe("navbar crawlability", () => {
  it("uses a real hub link plus a separate chevron to open the menu", () => {
    expect(src).toMatch(/href=\{s\.href\}/);
    expect(src).toMatch(/aria-expanded=\{open\}/);
    expect(src).toMatch(/aria-controls=\{megaPanelId\(s\.id\)\}/);
    expect(src).toMatch(/aria-label=\{`\$\{s\.label\} menu`\}/);
  });

  it("keeps dropdown and mobile links in the server HTML when closed", () => {
    expect(src).not.toMatch(/\{openSection && \(/);
    expect(src).not.toMatch(/\{mobileOpen && \(/);
    expect(src).toMatch(/hidden=\{!open\}/);
    expect(src).toMatch(/hidden=\{!mobileOpen\}/);
    expect(src).toMatch(/id=\{megaPanelId\(s\.id\)\}/);
  });
});
