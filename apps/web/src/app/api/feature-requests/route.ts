import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { adminEmails } from "@/lib/admin";
import { NO_STORE_HEADERS } from "@/lib/api-gate";
import { sendFeatureRequestEmail } from "@/lib/email";
import { getServerUser } from "@/lib/server-session";
import { DAILY_LIMIT, validateFeatureRequest } from "@/lib/feature-requests";
import {
  countRecentByUser,
  createFeatureRequest,
  listOwnFeatureRequests,
} from "@/lib/feature-requests-db";
import { getDisplayName } from "@/lib/profile-db";

// Per-user: everyone sees a different list, so never shared-cached.
export const dynamic = "force-dynamic";

/**
 * Gated on being signed in, NOT on `requireSubscriber`.
 *
 * A lapsed member telling us what would bring them back is the most useful
 * message this product can receive, and putting that behind the paywall means
 * never hearing it. The dashboard is already behind the login middleware, so
 * "signed in" is the real floor here anyway.
 */
async function requireUser() {
  const user = await getServerUser();
  if (!user) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }
  return { ok: true as const, user };
}

export async function GET() {
  await ensureMigrations();
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const requests = await listOwnFeatureRequests(guard.user.id);
  return NextResponse.json({ requests }, { headers: NO_STORE_HEADERS });
}

export async function POST(req: NextRequest) {
  await ensureMigrations();
  const guard = await requireUser();
  if (!guard.ok) return guard.response;

  const payload = await req.json().catch(() => null);
  const parsed = validateFeatureRequest(
    payload && typeof payload === "object" ? payload.title : undefined,
    payload && typeof payload === "object" ? payload.body : undefined,
  );
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  // Checked before the insert, not after: every accepted request mails the
  // admin list, so an unbounded POST here is an unbounded send.
  const recent = await countRecentByUser(guard.user.id);
  if (recent >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        error: `That's ${DAILY_LIMIT} requests today — the limit. Please send the rest tomorrow.`,
      },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }

  const created = await createFeatureRequest({
    userId: guard.user.id,
    title: parsed.title,
    body: parsed.body,
  });

  await notifyAdmins(created.id, parsed.title, parsed.body, guard.user);

  return NextResponse.json(
    { request: created },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}

/**
 * Tell the owner. Never fails the request.
 *
 * The row is already committed by the time this runs, so a Resend outage must
 * not turn into a 500 that tells the member their idea was lost — it was not.
 * The failure goes to the logs, and the request is still sitting in the ops
 * list waiting to be read.
 */
async function notifyAdmins(
  id: string,
  title: string,
  body: string,
  user: { id: string; name: string | null; email: string },
) {
  const to = adminEmails();
  if (to.length === 0) return;

  try {
    // The public display name when they have one — it is what the ops list
    // shows too, so both surfaces name the same person the same way.
    const displayName = await getDisplayName(user.id);
    const result = await sendFeatureRequestEmail({
      to,
      id,
      title,
      body,
      fromLabel: displayName?.trim() || user.name?.trim() || user.email,
      fromEmail: user.email,
    });
    if (!result.ok) {
      console.error(`[feature-request] notify failed for ${id}:`, result.error);
    }
  } catch (e) {
    console.error(`[feature-request] notify threw for ${id}:`, e);
  }
}
