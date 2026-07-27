import { NextRequest, NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin";
import { getAccess, NO_STORE_HEADERS } from "@/lib/api-gate";
import { getServerUser } from "@/lib/server-session";
import {
  isSubjectType,
  resolveDisplayName,
  validateBody,
  type SubjectType,
} from "@/lib/comments";
import { createComment, listComments } from "@/lib/comments-db";
import { getDisplayName } from "@/lib/profile-db";

// Per-user response (canDelete, and the insight gate), so never shared-cached.
export const dynamic = "force-dynamic";

function parseSubject(
  req: NextRequest,
): { type: SubjectType; slug: string } | null {
  const type = req.nextUrl.searchParams.get("type");
  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!isSubjectType(type) || !slug) return null;
  return { type, slug };
}

/**
 * Reading follows the access of the thing being discussed: blog posts are
 * public, research notes are behind the paywall. Serving insight comments to
 * anyone would republish the research second-hand, in the quotes.
 */
async function canRead(type: SubjectType) {
  if (type === "blog") return true;
  return (await getAccess()).entitled;
}

export async function GET(req: NextRequest) {
  await ensureMigrations();

  const subject = parseSubject(req);
  if (!subject) {
    return NextResponse.json({ error: "Unknown thread" }, { status: 400 });
  }
  if (!(await canRead(subject.type))) {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }

  const user = await getServerUser();
  const viewer = user
    ? { id: user.id, isAdmin: (await getAdminUser()) !== null }
    : null;

  const comments = await listComments(subject.type, subject.slug, viewer);
  return NextResponse.json(
    { comments, count: comments.filter((c) => !c.deleted).length },
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(req: NextRequest) {
  await ensureMigrations();

  const subject = parseSubject(req);
  if (!subject) {
    return NextResponse.json({ error: "Unknown thread" }, { status: 400 });
  }

  // Posting is subscriber-only on every thread, including the public blog:
  // an open comment box on an indexed page is a spam target, and membership is
  // the only identity check this product has.
  const access = await getAccess();
  if (!access.entitled) {
    return NextResponse.json(
      {
        error:
          access.reason === "anonymous"
            ? "Sign in to comment."
            : "Commenting is for members.",
      },
      { status: access.reason === "anonymous" ? 401 : 402 },
    );
  }

  // A thread of identical "Member" rows is unreadable, so the name is required
  // before the first comment rather than silently defaulted.
  const displayName = await getDisplayName(access.userId);
  if (!displayName?.trim()) {
    return NextResponse.json(
      { error: "Set a display name before commenting.", code: "no_display_name" },
      { status: 409 },
    );
  }

  const payload = await req.json().catch(() => null);
  const parsed = validateBody(
    payload && typeof payload === "object" ? payload.body : undefined,
  );
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const rawParent =
    payload && typeof payload === "object" ? payload.parent_id : undefined;
  const parentId =
    typeof rawParent === "string" && rawParent.trim() ? rawParent.trim() : null;

  const created = await createComment({
    subjectType: subject.type,
    subjectSlug: subject.slug,
    userId: access.userId,
    parentId,
    body: parsed.body,
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 400 });
  }

  return NextResponse.json(
    {
      id: created.id,
      author: { id: access.userId, displayName: resolveDisplayName(displayName) },
    },
    { status: 201, headers: NO_STORE_HEADERS },
  );
}
