import { afterEach, describe, expect, it, vi } from "vitest";
import {
  COOKIE_CONSENT_STORAGE_KEY,
  cookieConsentRecord,
} from "@/lib/cookie-consent";
import { DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL } from "@/lib/datafast";
import { trackMarketNoteSubscribeSuccess } from "@/lib/datafast-goals";
import { stubDatafastBrowser } from "@/lib/datafast-test-helpers";

describe("trackMarketNoteSubscribeSuccess", () => {
  let datafast = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires newsletter_subscribe when analytics cookies are accepted", () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(true),
    );

    trackMarketNoteSubscribeSuccess("market-note-page");

    expect(datafast).toHaveBeenCalledWith(DATAFAST_NEWSLETTER_SUBSCRIBE_GOAL, {
      source: "market-note-page",
    });
  });

  it("does not fire when consent was declined", () => {
    ({ datafast } = stubDatafastBrowser());
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      cookieConsentRecord(false),
    );

    trackMarketNoteSubscribeSuccess("market-note-page");

    expect(datafast).not.toHaveBeenCalled();
  });
});
