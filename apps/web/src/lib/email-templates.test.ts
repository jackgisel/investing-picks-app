import { describe, expect, it } from "vitest";
import {
  renderDeleteAccountEmail,
  renderMarketNoteWelcomeEmail,
  renderMembershipWelcomeEmail,
  renderNewPickEmail,
  renderVerifyEmail,
  renderWeeklyReviewEmail,
} from "@/lib/email-templates";

const SITE = "https://outpick.xyz";

const pick = () =>
  renderNewPickEmail({
    recipientName: "Jack Gisel",
    ticker: "WDC",
    stats: [
      { label: "Entry date", value: "Jul 17, 2026" },
      { label: "Since entry", value: "+16.06%", direction: "up" },
    ],
    articleTitle: "Why WDC cleared every gate",
    articleDescription: "The full note covers the thesis.",
    articleUrl: `${SITE}/blog/wdc`,
    siteUrl: SITE,
  });

const review = () =>
  renderWeeklyReviewEmail({
    recipientName: "Jack Gisel",
    title: "Weekly review: a quiet week in a biweekly book",
    lede: "Nothing fired. The grades did not change.",
    articleUrl: `${SITE}/dashboard/insights/weekly-review-2026-w34`,
    siteUrl: SITE,
  });

const all = () => [
  pick(),
  review(),
  renderVerifyEmail({ name: null, verifyUrl: `${SITE}/v`, siteUrl: SITE }),
  renderDeleteAccountEmail({ name: "Jack", confirmUrl: `${SITE}/d`, siteUrl: SITE }),
  renderMarketNoteWelcomeEmail({ unsubscribeUrl: `${SITE}/u`, siteUrl: SITE }),
  renderMembershipWelcomeEmail({
    name: "Jack",
    welcomeUrl: `${SITE}/welcome`,
    siteUrl: SITE,
  }),
];

describe("every template", () => {
  it("renders a complete document with no interpolation leaks", () => {
    for (const html of all()) {
      expect(html.startsWith("<!doctype html>")).toBe(true);
      expect(html.trimEnd().endsWith("</html>")).toBe(true);
      // A missing optional arg reaching the output is the failure mode that
      // template literals make silent.
      expect(html).not.toContain("undefined");
      expect(html).not.toContain("[object Object]");
      expect(html).not.toContain("NaN");
    }
  });

  it("uses the light brand ground, not the retired black one", () => {
    for (const html of all()) {
      expect(html).toContain("#FFFFFF");
      expect(html).toContain('content="light dark"');
      expect(html).not.toContain("dark only");
      expect(html).not.toContain("#0C0C0C");
    }
  });

  it("imports only the two brand faces", () => {
    for (const html of all()) {
      expect(html).toContain("family=IBM+Plex+Mono");
      expect(html).toContain("family=Outfit");
      expect(html).not.toContain("IBM+Plex+Sans");
    }
  });
});

describe("membership welcome email", () => {
  it("orients the member without asserting a payment amount", () => {
    const html = renderMembershipWelcomeEmail({
      name: "Jack Gisel",
      welcomeUrl: `${SITE}/welcome`,
      siteUrl: SITE,
    });
    expect(html).toContain("Membership active");
    expect(html).toContain("Live book");
    expect(html).toContain("Research");
    expect(html).toContain(`${SITE}/welcome`);
    expect(html).not.toContain("$1");
    expect(html).not.toContain("$250");
    expect(html).not.toContain("$1,000");
  });
});

describe("new pick email", () => {
  it("leads with the ticker at display size", () => {
    const html = pick();
    const ticker = html.indexOf("WDC");
    const title = html.indexOf("Why WDC cleared every gate");
    expect(ticker).toBeGreaterThan(-1);
    // The symbol must come before the article headline in the document — that
    // ordering is the whole point of the redesign.
    expect(ticker).toBeLessThan(title);
    expect(html).toContain("font-size:56px");
  });

  it("colours a gain green and a loss red", () => {
    const up = renderNewPickEmail({
      recipientName: null,
      ticker: "AAA",
      stats: [{ label: "Since entry", value: "+10%", direction: "up" }],
      articleTitle: "t",
      articleDescription: "d",
      articleUrl: SITE,
      siteUrl: SITE,
    });
    const down = renderNewPickEmail({
      recipientName: null,
      ticker: "AAA",
      stats: [{ label: "Since entry", value: "-10%", direction: "down" }],
      articleTitle: "t",
      articleDescription: "d",
      articleUrl: SITE,
      siteUrl: SITE,
    });
    expect(up).toContain("#16A34A");
    expect(down).toContain("#DC2626");
  });

  it("omits the stat row entirely when there are no stats", () => {
    const html = renderNewPickEmail({
      recipientName: null,
      ticker: "AAA",
      articleTitle: "t",
      articleDescription: "d",
      articleUrl: SITE,
      siteUrl: SITE,
    });
    expect(html).not.toContain("Since entry");
    // An empty stats array must not leave a stray 0%-wide table behind.
    expect(html).not.toContain("width:0%");
  });

  it("escapes a hostile ticker or title", () => {
    const html = renderNewPickEmail({
      recipientName: null,
      ticker: "<script>alert(1)</script>",
      articleTitle: '"><img src=x onerror=alert(1)>',
      articleDescription: "d",
      articleUrl: SITE,
      siteUrl: SITE,
    });
    // The payload text survives as inert escaped characters — what must not
    // survive is the markup, so assert on the tags rather than the substring.
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("shows the test banner only when asked", () => {
    expect(pick()).not.toContain("Test send");
    const banner = renderNewPickEmail({
      recipientName: null,
      ticker: "AAA",
      articleTitle: "t",
      articleDescription: "d",
      articleUrl: SITE,
      siteUrl: SITE,
      banner: "Test send — not a live alert",
    });
    expect(banner).toContain("Test send");
  });
});

describe("weekly review email", () => {
  it("leads with the article, not a ticker", () => {
    const html = review();
    expect(html).toContain("Weekly review");
    expect(html).toContain("Weekly review: a quiet week in a biweekly book");
    expect(html).toContain("Read the review");
    expect(html).toContain("/dashboard/insights/weekly-review-2026-w34");
    expect(html).not.toContain("font-size:56px");
    expect(html).not.toContain("$");
  });
});
