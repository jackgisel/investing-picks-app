import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_PATH,
  COMMUNICATION_TABS,
  DEFAULT_COMMUNICATION_TAB,
  LEGACY_COMMUNICATION_REDIRECTS,
  communicationHref,
  legacyCommunicationRedirect,
  parseCommunicationTab,
} from "./communication";

describe("parseCommunicationTab", () => {
  it("keeps a known tab", () => {
    expect(parseCommunicationTab("sunday-market-preview")).toBe(
      "sunday-market-preview",
    );
  });

  it("falls back for missing or unknown values", () => {
    expect(parseCommunicationTab(null)).toBe(DEFAULT_COMMUNICATION_TAB);
    expect(parseCommunicationTab("not-a-tab")).toBe(DEFAULT_COMMUNICATION_TAB);
  });
});

describe("legacyCommunicationRedirect", () => {
  it("maps every retired admin comms URL onto a Communication tab", () => {
    expect(legacyCommunicationRedirect("/dashboard/dca")).toBe(
      communicationHref("friday-stock-pick"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/weekly-review")).toBe(
      communicationHref("friday-portfolio-review"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/market-note")).toBe(
      communicationHref("sunday-market-preview"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/x-threads")).toBe(
      communicationHref("x-threads"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/product-updates")).toBe(
      communicationHref("product-updates"),
    );
  });

  it("leaves unrelated admin pages alone", () => {
    expect(legacyCommunicationRedirect("/dashboard/ops")).toBeNull();
    expect(legacyCommunicationRedirect("/dashboard/ops/book")).toBeNull();
    expect(legacyCommunicationRedirect("/dashboard/ops/feature-requests")).toBeNull();
  });

  it("covers every legacy comms URL exactly once", () => {
    const tabs = Object.values(LEGACY_COMMUNICATION_REDIRECTS);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect(tabs.every((tab) => COMMUNICATION_TABS.some((item) => item.id === tab))).toBe(
      true,
    );
    expect(COMMUNICATION_PATH).toBe("/dashboard/ops/communication");
  });

  it("includes an Invites tab that has no legacy URL", () => {
    expect(COMMUNICATION_TABS.map((tab) => tab.id)).toContain("invites");
    expect(Object.values(LEGACY_COMMUNICATION_REDIRECTS)).not.toContain("invites");
  });
});
