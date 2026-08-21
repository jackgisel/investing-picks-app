import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Insight } from "@/lib/insights";

/**
 * The approve path's one job: publish and announce exactly once.
 *
 * What is tested here is that the ROUTE honours the claim — it sends only when
 * `claimForPublish` hands it a row, and never otherwise. That the claim itself
 * is atomic is a property of the SQL, not of this file: it is a single
 * `UPDATE … WHERE email_sent_at IS NULL … RETURNING`, and Postgres serialises
 * concurrent updates to the same row, so the second writer re-evaluates the
 * predicate against the first one's committed result and matches nothing.
 * These tests cover the half that could regress in TypeScript.
 */

const claimForPublish = vi.fn();
const getInsightById = vi.fn();
const announcePick = vi.fn();
const requireAdmin = vi.fn();

vi.mock("@/lib/insights-db", () => ({ claimForPublish, getInsightById }));
vi.mock("@/lib/pick-announce", () => ({ announcePick }));
vi.mock("@/lib/admin", () => ({ requireAdmin }));
vi.mock("@/lib/auth", () => ({ ensureMigrations: async () => {} }));

const { POST } = await import("@/app/api/ops/insights/[id]/approve/route");

const DRAFT: Insight = {
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
  autoPublishAt: "2026-07-18T00:00:00.000Z",
  createdAt: "2026-07-17T00:00:00.000Z",
  updatedAt: "2026-07-17T00:00:00.000Z",
  confirmedAt: null,
  lede: "A lede.",
  tldr: ["a", "b", "c", "d", "e"],
  bodyMd: "## Business overview\n\nText.",
  keyTakeaway: "A takeaway.",
  generationError: null,
  emailSentAt: null,
};

const params = Promise.resolve({ id: "1" });
const call = () => POST(new Request("http://x/approve"), { params });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  requireAdmin.mockResolvedValue({ ok: true, user: { id: "u", email: "a@b.c" } });
  announcePick.mockResolvedValue({ sent: 3, failed: 0, total: 3, errors: [] });
});

describe("approve", () => {
  it("sends when it wins the claim", async () => {
    getInsightById.mockResolvedValue(DRAFT);
    claimForPublish.mockResolvedValue({ ...DRAFT, status: "approved" });

    const res = await call();

    expect(res.status).toBe(200);
    expect(announcePick).toHaveBeenCalledTimes(1);
    expect(announcePick).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: "WDC", insightSlug: "wdc-note" }),
    );
  });

  it("does NOT send when the claim is lost", async () => {
    // The shape of a double-click: the row is already stamped, so the
    // conditional UPDATE matched nothing.
    getInsightById.mockResolvedValue({
      ...DRAFT,
      status: "approved",
      emailSentAt: "2026-07-17T10:00:00.000Z",
    });
    claimForPublish.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ alreadySent: true });
    expect(announcePick).not.toHaveBeenCalled();
  });

  it("two concurrent approvals produce exactly one send", async () => {
    getInsightById.mockResolvedValue(DRAFT);
    // Only the first caller gets a row back, which is what the SQL guarantees.
    claimForPublish
      .mockResolvedValueOnce({ ...DRAFT, status: "approved" })
      .mockResolvedValue(null);

    const [a, b] = await Promise.all([call(), call()]);

    expect(announcePick).toHaveBeenCalledTimes(1);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("refuses a note with no body rather than mailing an empty one", async () => {
    getInsightById.mockResolvedValue({ ...DRAFT, bodyMd: null });

    const res = await call();

    expect(res.status).toBe(400);
    expect(claimForPublish).not.toHaveBeenCalled();
    expect(announcePick).not.toHaveBeenCalled();
  });

  it("refuses to publish when Resend is not configured", async () => {
    // Publishing without a mailer would flip the row to approved and burn the
    // one-shot claim without anyone being told.
    delete process.env.RESEND_API_KEY;
    getInsightById.mockResolvedValue(DRAFT);

    const res = await call();

    expect(res.status).toBe(503);
    expect(claimForPublish).not.toHaveBeenCalled();
  });

  it("reports a partial send instead of rolling back", async () => {
    getInsightById.mockResolvedValue(DRAFT);
    claimForPublish.mockResolvedValue({ ...DRAFT, status: "approved" });
    announcePick.mockResolvedValue({
      sent: 2,
      failed: 1,
      total: 3,
      errors: [{ email: "x@y.z", error: "bounced" }],
    });

    const res = await call();
    const body = await res.json();

    // Still published: some subscribers already have the link, and there is no
    // un-send that could make pretending otherwise true.
    expect(body).toMatchObject({ ok: false, published: true, sent: 2, failed: 1 });
  });

  it("404s an unknown note without touching the claim", async () => {
    getInsightById.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(404);
    expect(claimForPublish).not.toHaveBeenCalled();
  });
});
