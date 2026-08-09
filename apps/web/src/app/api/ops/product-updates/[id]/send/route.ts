import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { sendProductUpdateEmail } from "@/lib/email";
import { getOptedInRecipients } from "@/lib/preferences";
import {
  claimProductUpdateSend,
  getProductUpdate,
} from "@/lib/product-updates-db";
import {
  productUpdateText,
  renderProductUpdateBody,
} from "@/lib/product-updates";

export const dynamic = "force-dynamic";

/**
 * Mail a product update to everyone opted in. One gate, one irreversible act.
 *
 * Same ordering as approving a research note: claim first, then send. A crash
 * mid-send leaves an update that reached part of the list — recoverable, and
 * visible — rather than one that looks unsent and can be mailed again from
 * scratch, which is not, because there is no un-send.
 *
 * Audience is `"everyone"`, the only send in the codebase that is. A product
 * update carries no paid content, and a free account that asked to hear about
 * new features has no reason to be excluded. Everything that names a ticker
 * goes to subscribers only.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set; refusing to send without it" },
      { status: 503 },
    );
  }

  await ensureMigrations();
  const { id } = await params;

  const before = await getProductUpdate(id);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!before.subject.trim() || !before.bodyMd.trim()) {
    return NextResponse.json(
      { error: "Fill in the subject and body before sending." },
      { status: 400 },
    );
  }

  const recipients = await getOptedInRecipients("productUpdates", "everyone");
  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nobody is opted in to product updates. The toggle is off by default, so this is expected on a young list.",
      },
      { status: 409 },
    );
  }

  const claimed = await claimProductUpdateSend(id, recipients.length);
  if (!claimed) {
    return NextResponse.json(
      {
        error:
          before.sentAt !== null
            ? "Already sent. Subscribers were mailed this update; it will not go again."
            : `Cannot send an update with status '${before.status}'.`,
        alreadySent: before.sentAt !== null,
      },
      { status: 409 },
    );
  }

  const bodyHtml = renderProductUpdateBody(claimed.bodyMd);
  const bodyText = productUpdateText(claimed.bodyMd);

  const CHUNK = 5;
  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];

  for (let i = 0; i < recipients.length; i += CHUNK) {
    const results = await Promise.all(
      recipients.slice(i, i + CHUNK).map((r) =>
        sendProductUpdateEmail({
          to: r.email,
          userId: r.id,
          recipientName: r.name,
          subject: claimed.subject,
          bodyHtml,
          bodyText,
        }).then((res) => ({ email: r.email, ...res })),
      ),
    );
    for (const r of results) {
      if (r.ok) sent += 1;
      else {
        failed += 1;
        errors.push({ email: r.email, error: r.error ?? "unknown" });
      }
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    sent,
    failed,
    total: recipients.length,
    errors,
  });
}
