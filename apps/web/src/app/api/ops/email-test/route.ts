import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { SITE_URL } from "@/lib/constants";
import {
  sendDeleteAccountEmail,
  sendMarketNoteWelcomeEmail,
  sendNewPickEmail,
  sendVerifyEmail,
} from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Send a template to the signed-in admin's own address, to check that Resend is
 * configured and that the rendering holds up in a real client.
 *
 * The recipient is NOT a parameter — it is always `guard.user.email`. That is
 * the whole safety property: `notify-pick` exists to mail every opted-in
 * subscriber, and a test route that took a `to` field would be one typo away
 * from being the same thing with less review. This route cannot reach anyone
 * but the person holding the admin session.
 *
 * The payloads below are obvious fakes (TEST ticker, a token that unsubscribes
 * nothing) so that a message which escapes into a real inbox cannot be mistaken
 * for a real pick alert.
 *
 * POST /api/ops/email-test          → sends all templates
 * POST /api/ops/email-test {"template":"verify"}
 */

const TEMPLATES = ["verify", "new-pick", "delete-account", "market-note"] as const;
type Template = (typeof TEMPLATES)[number];

async function sendOne(
  template: Template,
  to: string,
  name: string | null
): Promise<{ ok: boolean; error?: string }> {
  switch (template) {
    case "verify":
      return sendVerifyEmail({
        to,
        name,
        verifyUrl: `${SITE_URL}/verify-email?token=test-token-not-valid`,
      });
    case "new-pick":
      return sendNewPickEmail({
        to,
        recipientName: name,
        ticker: "TEST",
        articleTitle: "This is a test of the new pick email",
        articleDescription:
          "Sent from /api/ops/email-test. Nothing here is a real pick and the link below does not resolve to a real article.",
        articleSlug: "test-not-a-real-article",
      });
    case "delete-account":
      return sendDeleteAccountEmail({
        to,
        name,
        confirmUrl: `${SITE_URL}/account/delete?token=test-token-not-valid`,
      });
    case "market-note":
      // A token that matches no subscriber row: the unsubscribe links render
      // and are clickable, and clicking one is a no-op rather than removing a
      // real address.
      return sendMarketNoteWelcomeEmail({ to, token: "test-token-not-valid" });
  }
}

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set on this deployment" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}) as { template?: unknown });
  const requested =
    typeof body.template === "string" ? body.template.trim() : "";

  if (requested && !TEMPLATES.includes(requested as Template)) {
    return NextResponse.json(
      { error: `Unknown template '${requested}'`, valid: TEMPLATES },
      { status: 400 }
    );
  }

  const to = guard.user.email;
  const name = guard.user.name ?? null;
  const selected: Template[] = requested
    ? [requested as Template]
    : [...TEMPLATES];

  const results: { template: Template; ok: boolean; error?: string }[] = [];
  for (const template of selected) {
    const res = await sendOne(template, to, name);
    results.push({ template, ...res });
  }

  const failed = results.filter((r) => !r.ok);
  return NextResponse.json(
    {
      ok: failed.length === 0,
      to,
      sent: results.length - failed.length,
      failed: failed.length,
      results,
    },
    { status: failed.length === 0 ? 200 : 502 }
  );
}
