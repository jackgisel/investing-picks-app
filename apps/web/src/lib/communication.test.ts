import { describe, expect, it } from "vitest";
import {
  COMMUNICATION_PATH,
  COMMUNICATION_PIECES,
  LEGACY_COMMUNICATION_REDIRECTS,
  communicationHref,
  legacyCommunicationRedirect,
  parseCommunicationPiece,
} from "./communication";

describe("parseCommunicationPiece", () => {
  it("opens a known piece", () => {
    expect(parseCommunicationPiece("monday-market-note", null)).toBe(
      "monday-market-note",
    );
  });

  it("maps a retired tab onto the piece that replaced it", () => {
    expect(parseCommunicationPiece(null, "sunday-market-preview")).toBe(
      "monday-market-note",
    );
    expect(parseCommunicationPiece(null, "x-threads")).toBe("x");
    expect(parseCommunicationPiece(null, "friday-portfolio-review")).toBeNull();
  });

  it("opens the week desk for a missing or unknown value", () => {
    expect(parseCommunicationPiece(null, null)).toBeNull();
    expect(parseCommunicationPiece("not-a-piece", "not-a-tab")).toBeNull();
  });
});

describe("legacyCommunicationRedirect", () => {
  it("maps every retired admin comms URL onto the desk or a piece", () => {
    expect(legacyCommunicationRedirect("/dashboard/dca")).toBe(
      communicationHref("friday-stock-pick"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/weekly-review")).toBe(
      COMMUNICATION_PATH,
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/market-note")).toBe(
      communicationHref("monday-market-note"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/x-threads")).toBe(
      communicationHref("x"),
    );
    expect(legacyCommunicationRedirect("/dashboard/ops/product-updates")).toBe(
      communicationHref("product-updates"),
    );
  });

  it("leaves unrelated admin pages alone", () => {
    expect(legacyCommunicationRedirect("/dashboard/ops")).toBeNull();
    expect(legacyCommunicationRedirect("/dashboard/ops/book")).toBeNull();
  });

  it("only points legacy URLs at real pieces", () => {
    for (const piece of Object.values(LEGACY_COMMUNICATION_REDIRECTS)) {
      if (piece === null) continue;
      expect(COMMUNICATION_PIECES.some((item) => item.id === piece)).toBe(true);
    }
    expect(COMMUNICATION_PATH).toBe("/dashboard/ops/communication");
  });
});
