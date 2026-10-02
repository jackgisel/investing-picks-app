import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightMeta } from "@/lib/insights";

/**
 * The auto-publisher mails the list with no human in the loop, so what matters
 * is the set of things that must stop it: the kill switch, a missing mailer, a
 * lost claim. The deadline itself is enforced in SQL by
 * `listDraftsDueForPublish` and is not re-checked here — mocking the query and
 * then asserting on the filter it applies would test the mock.
 */

const listDraftsDueForPublish = vi.fn();
const claimForPublish = vi.fn();
const announcePick = vi.fn();
const announceExit = vi.fn();
const announceAdd = vi.fn();
const announcePickCycle = vi.fn();
const openCycleSiblings = vi.fn();
const claimCycleSiblings = vi.fn();

vi.mock("@/lib/insights-db", () => ({
  listDraftsDueForPublish,
  claimForPublish,
}));
vi.mock("@/lib/pick-announce", () => ({
  announcePick,
  announceExit,
  announceAdd,
  announcePickCycle,
}));
vi.mock("@/lib/pick-cycle", async () => {
  const real = await vi.importActual<typeof import("@/lib/pick-cycle")>(
    "@/lib/pick-cycle",
  );
  return {
    siblingStillComing: real.siblingStillComing,
    fetchRecentTrades: async () => [],
    openCycleSiblings,
    claimCycleSiblings,
  };
});

const { autoPublishDueDrafts } = await import("@/lib/insight-auto-publish");

const DUE: InsightMeta = {
  id: "1",
  slug: "wdc-note",
  ticker: "WDC",
  postType: "pick",
  status: "draft",
  title: "Stock buy: a claim",
  description: "A description.",
  readingTime: 8,
  tags: [],
  author: null,
  quarter: null,
  publishedAt: null,
  autoPublishAt: "2026-08-08T00:00:00.000Z",
  createdAt: "2026-08-07T00:00:00.000Z",
  updatedAt: "2026-08-07T00:00:00.000Z",
  confirmedAt: null,
  publicSampleAt: null,
};

const claimed = (over: Partial<InsightMeta> = {}) => ({
  ...DUE,
  status: "approved",
  lede: "A lede.",
  tldr: [],
  bodyMd: "## Business overview\n\nText.",
  keyTakeaway: "A takeaway.",
  generationError: null,
  emailSentAt: "2026-08-08T00:01:00.000Z",
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  delete process.env.AUTO_PUBLISH_ENABLED;
  announcePick.mockResolvedValue({ sent: 3, failed: 0, total: 3, errors: [] });
  announcePickCycle.mockResolvedValue({ sent: 3, failed: 0, total: 3, errors: [] });
  openCycleSiblings.mockResolvedValue([]);
  claimCycleSiblings.mockImplementation(async (s: InsightMeta[]) =>
    s.map((m) => claimed(m)),
  );
});

describe("autoPublishDueDrafts", () => {
  it("publishes a due draft and announces it once", async () => {
    listDraftsDueForPublish.mockResolvedValue([DUE]);
    claimForPublish.mockResolvedValue(claimed());

    const result = await autoPublishDueDrafts();

    expect(announcePick).toHaveBeenCalledTimes(1);
    expect(announcePick).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: "WDC", insightSlug: "wdc-note" }),
    );
    expect(result.published).toEqual([
      { ticker: "WDC", slug: "wdc-note", sent: 3, failed: 0 },
    ]);
  });

  it("does NOT send when the claim is lost", async () => {
    // An admin approved or rejected between the SELECT and the UPDATE. This is
    // the race the shared claim exists to settle, and losing it must be silent
    // and harmless rather than a duplicate email.
    listDraftsDueForPublish.mockResolvedValue([DUE]);
    claimForPublish.mockResolvedValue(null);

    const result = await autoPublishDueDrafts();

    expect(announcePick).not.toHaveBeenCalled();
    expect(result.published).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });

  it("sends nothing at all when the kill switch is off", async () => {
    process.env.AUTO_PUBLISH_ENABLED = "false";
    listDraftsDueForPublish.mockResolvedValue([DUE]);

    const result = await autoPublishDueDrafts();

    expect(result.disabled).toBe(true);
    // Not even a query — the switch has to short-circuit before the claim, or
    // it would publish and merely decline to say so.
    expect(listDraftsDueForPublish).not.toHaveBeenCalled();
    expect(claimForPublish).not.toHaveBeenCalled();
    expect(announcePick).not.toHaveBeenCalled();
  });

  it("refuses to claim when Resend is not configured", async () => {
    // Claiming without a mailer would flip the row to approved and burn the
    // one-shot send with no email leaving.
    delete process.env.RESEND_API_KEY;
    listDraftsDueForPublish.mockResolvedValue([DUE]);

    const result = await autoPublishDueDrafts();

    expect(claimForPublish).not.toHaveBeenCalled();
    expect(result.errors).toHaveLength(1);
  });

  it("keeps going when one note fails", async () => {
    const other: InsightMeta = { ...DUE, id: "2", ticker: "AMD", slug: "amd" };
    listDraftsDueForPublish.mockResolvedValue([DUE, other]);
    claimForPublish
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue(claimed({ id: "2", ticker: "AMD", slug: "amd" }));

    const result = await autoPublishDueDrafts();

    expect(result.errors).toEqual([
      { ticker: "WDC", error: "connection reset" },
    ]);
    expect(result.published).toHaveLength(1);
    expect(result.published[0].ticker).toBe("AMD");
  });

  it("reports a partial send rather than treating it as a failure", async () => {
    // There is no un-send: once announcePick has mailed some of the list the
    // note is published, and the failures are something to chase individually.
    listDraftsDueForPublish.mockResolvedValue([DUE]);
    claimForPublish.mockResolvedValue(claimed());
    announcePick.mockResolvedValue({
      sent: 2,
      failed: 1,
      total: 3,
      errors: [{ email: "x@y.z", error: "bounced" }],
    });

    const result = await autoPublishDueDrafts();

    expect(result.published).toEqual([
      { ticker: "WDC", slug: "wdc-note", sent: 2, failed: 1 },
    ]);
    expect(result.errors).toEqual([]);
  });

  it("publishes a stale add without mailing the list", async () => {
    const due: InsightMeta = {
      ...DUE,
      id: "3",
      slug: "add-sezl-2020-01-01",
      ticker: "SEZL",
      postType: "add",
    };
    listDraftsDueForPublish.mockResolvedValue([due]);
    claimForPublish.mockResolvedValue(
      claimed({
        id: "3",
        slug: "add-sezl-2020-01-01",
        ticker: "SEZL",
        postType: "add",
      }),
    );

    const result = await autoPublishDueDrafts();

    expect(announceAdd).not.toHaveBeenCalled();
    expect(announcePick).not.toHaveBeenCalled();
    expect(result.published).toEqual([
      { ticker: "SEZL", slug: "add-sezl-2020-01-01", sent: 0, failed: 0 },
    ]);
  });

  describe("a multi-pick cycle", () => {
    const MU: InsightMeta = { ...DUE, id: "2", ticker: "MU", slug: "mu-note" };
    const inFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    it("sends one email for both notes when both are due", async () => {
      listDraftsDueForPublish.mockResolvedValue([DUE, MU]);
      claimForPublish.mockResolvedValue(claimed());
      openCycleSiblings.mockResolvedValue([MU]);

      const result = await autoPublishDueDrafts();

      expect(announcePickCycle).toHaveBeenCalledTimes(1);
      expect(
        announcePickCycle.mock.calls[0][0].map((n: InsightMeta) => n.ticker),
      ).toEqual(["WDC", "MU"]);
      expect(announcePick).not.toHaveBeenCalled();
      // MU was claimed inside WDC's send, so the loop must not claim it again.
      expect(claimForPublish).toHaveBeenCalledTimes(1);
      expect(result.published.map((p) => p.ticker)).toEqual(["WDC", "MU"]);
    });

    it("holds a due note while its sibling is still in review", async () => {
      const justDue = new Date(Date.now() - 60 * 1000).toISOString();
      listDraftsDueForPublish.mockResolvedValue([
        { ...DUE, autoPublishAt: justDue },
      ]);
      openCycleSiblings.mockResolvedValue([
        { ...MU, autoPublishAt: inFuture },
      ]);

      const result = await autoPublishDueDrafts();

      expect(claimForPublish).not.toHaveBeenCalled();
      expect(announcePick).not.toHaveBeenCalled();
      expect(result.skipped).toEqual([
        { ticker: "WDC", reason: "held to send with MU" },
      ]);
    });

    it("stops holding once the note is a full day overdue", async () => {
      const stale = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      listDraftsDueForPublish.mockResolvedValue([
        { ...DUE, autoPublishAt: stale },
      ]);
      claimForPublish.mockResolvedValue(claimed());
      openCycleSiblings.mockResolvedValue([
        { ...MU, status: "pending", autoPublishAt: null },
      ]);

      await autoPublishDueDrafts();

      expect(announcePick).toHaveBeenCalledTimes(1);
      expect(announcePickCycle).not.toHaveBeenCalled();
    });
  });
});
