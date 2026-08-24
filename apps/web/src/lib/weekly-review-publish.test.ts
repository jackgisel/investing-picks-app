import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Insight } from "@/lib/insights";

/**
 * Confirm does not publish. Noon without confirm skips. Noon with confirm
 * claims once. The SQL is the real gate; these tests cover the TypeScript
 * that must honour it.
 */

const getInsightBySlug = vi.fn();
const getInsightById = vi.fn();
const claimForWeeklyReviewPublish = vi.fn();
const claimDispatch = vi.fn();
const announceWeeklyReview = vi.fn();
const sendWeeklyReviewOpsEmail = vi.fn();
const adminEmails = vi.fn();

vi.mock("@/lib/insights-db", () => ({
  getInsightBySlug,
  getInsightById,
  claimForWeeklyReviewPublish,
  createPendingWeeklyReview: vi.fn(),
  markGenerationFailed: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("@/lib/weekly-review-announce", () => ({ announceWeeklyReview }));

vi.mock("@/lib/email-dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email-dispatch")>();
  return { ...actual, claimDispatch };
});

vi.mock("@/lib/email", () => ({ sendWeeklyReviewOpsEmail }));
vi.mock("@/lib/admin", () => ({ adminEmails }));

const { publishWeeklyReview } = await import("@/lib/weekly-review-sync");

const FRIDAY = new Date("2026-08-21T19:05:00.000Z");

const DRAFT: Insight = {
  id: "7",
  slug: "weekly-review-2026-w34",
  ticker: null,
  postType: "weekly_review",
  status: "draft",
  title: "Weekly review: a quiet week",
  description: "The book held. Nothing fired.",
  readingTime: 6,
  tags: ["weekly"],
  author: null,
  quarter: null,
  publishedAt: null,
  autoPublishAt: "2026-08-21T19:00:00.000Z",
  confirmedAt: null,
  publicSampleAt: null,
  createdAt: "2026-08-21T17:00:00.000Z",
  updatedAt: "2026-08-21T17:00:00.000Z",
  lede: "A quiet week in a biweekly book.",
  tldr: ["a", "b", "c", "d", "e"],
  bodyMd: "## The week\n\nHeld.",
  keyTakeaway: "Hold.",
  generationError: null,
  emailSentAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  getInsightBySlug.mockResolvedValue(DRAFT);
  getInsightById.mockResolvedValue(DRAFT);
  adminEmails.mockReturnValue(["ops@outpick.xyz"]);
  sendWeeklyReviewOpsEmail.mockResolvedValue({ ok: true });
  claimDispatch.mockResolvedValue(true);
  announceWeeklyReview.mockResolvedValue({
    sent: 4,
    failed: 0,
    total: 4,
    errors: [],
  });
});

describe("publishWeeklyReview", () => {
  it("does not send when the draft is unconfirmed", async () => {
    const result = await publishWeeklyReview({ now: FRIDAY });

    expect(result.skipped).toBe("not_confirmed");
    expect(claimForWeeklyReviewPublish).not.toHaveBeenCalled();
    expect(announceWeeklyReview).not.toHaveBeenCalled();
    expect(sendWeeklyReviewOpsEmail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "skipped" }),
    );
  });

  it("does not email admins about a skip when ops asked it not to", async () => {
    await publishWeeklyReview({
      now: FRIDAY,
      notifyIfUnconfirmed: false,
    });
    expect(sendWeeklyReviewOpsEmail).not.toHaveBeenCalled();
  });

  it("sends when confirmed and the claim wins", async () => {
    const confirmed = {
      ...DRAFT,
      confirmedAt: "2026-08-21T18:00:00.000Z",
      publicSampleAt: null,
    };
    getInsightBySlug.mockResolvedValue(confirmed);
    claimForWeeklyReviewPublish.mockResolvedValue({
      ...confirmed,
      status: "approved",
      emailSentAt: FRIDAY.toISOString(),
    });

    const result = await publishWeeklyReview({ now: FRIDAY });

    expect(claimForWeeklyReviewPublish).toHaveBeenCalledWith("7");
    expect(announceWeeklyReview).toHaveBeenCalledTimes(1);
    expect(announceWeeklyReview).toHaveBeenCalledWith(
      expect.objectContaining({
        insightSlug: "weekly-review-2026-w34",
        title: "Weekly review: a quiet week",
      }),
    );
    expect(result.sent).toBe(4);
    expect(result.skipped).toBeUndefined();
  });

  it("does NOT send when the claim is lost", async () => {
    getInsightBySlug.mockResolvedValue({
      ...DRAFT,
      confirmedAt: "2026-08-21T18:00:00.000Z",
      publicSampleAt: null,
    });
    claimForWeeklyReviewPublish.mockResolvedValue(null);

    const result = await publishWeeklyReview({ now: FRIDAY });

    expect(announceWeeklyReview).not.toHaveBeenCalled();
    expect(result.skipped).toBe("already_sent");
  });

  it("skips a review that is already approved", async () => {
    getInsightBySlug.mockResolvedValue({
      ...DRAFT,
      status: "approved",
      confirmedAt: "2026-08-21T18:00:00.000Z",
      publicSampleAt: null,
      emailSentAt: "2026-08-21T19:00:00.000Z",
    });

    const result = await publishWeeklyReview({ now: FRIDAY });

    expect(claimForWeeklyReviewPublish).not.toHaveBeenCalled();
    expect(announceWeeklyReview).not.toHaveBeenCalled();
    expect(result.skipped).toBe("already_sent");
  });

  it("refuses to claim when Resend is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    getInsightBySlug.mockResolvedValue({
      ...DRAFT,
      confirmedAt: "2026-08-21T18:00:00.000Z",
      publicSampleAt: null,
    });

    const result = await publishWeeklyReview({ now: FRIDAY });

    expect(claimForWeeklyReviewPublish).not.toHaveBeenCalled();
    expect(result.skipped).toBe("no_mailer");
  });

  it("publishes a late confirm by id the same way noon would", async () => {
    const confirmed = {
      ...DRAFT,
      confirmedAt: FRIDAY.toISOString(),
      publicSampleAt: null,
    };
    getInsightById.mockResolvedValue(confirmed);
    claimForWeeklyReviewPublish.mockResolvedValue({
      ...confirmed,
      status: "approved",
      emailSentAt: FRIDAY.toISOString(),
    });

    const result = await publishWeeklyReview({
      now: FRIDAY,
      id: "7",
      notifyIfUnconfirmed: false,
    });

    expect(getInsightById).toHaveBeenCalledWith("7");
    expect(announceWeeklyReview).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(4);
  });
});
