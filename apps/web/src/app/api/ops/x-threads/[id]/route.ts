import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import { validateThread } from "@/lib/x-client";
import { deleteThread, updateThreadPosts } from "@/lib/x-threads-db";

export const dynamic = "force-dynamic";

/**
 * Save hand-edited post bodies.
 *
 * Length is checked here as well as at post time. Catching it in the editor,
 * where it can still be fixed, is the whole point of showing the counter.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { posts?: unknown };
  if (
    !Array.isArray(body.posts) ||
    !body.posts.every((p) => typeof p === "string")
  ) {
    return NextResponse.json(
      { error: "posts must be an array of strings" },
      { status: 400 },
    );
  }
  const posts = (body.posts as string[]).map((p) => p.trim()).filter(Boolean);
  if (posts.length === 0) {
    return NextResponse.json({ error: "A thread needs at least one post" }, { status: 400 });
  }

  const tooLong = validateThread(posts);
  if (tooLong.length > 0) {
    return NextResponse.json(
      {
        error: `Over the limit: ${tooLong
          .map((e) => `post ${e.index + 1} (${e.chars} chars)`)
          .join(", ")}`,
      },
      { status: 400 },
    );
  }

  await ensureMigrations();
  const thread = await updateThreadPosts(id, posts);
  if (!thread) {
    return NextResponse.json(
      { error: "Only an unposted draft can be edited" },
      { status: 409 },
    );
  }
  return NextResponse.json({ thread });
}

/**
 * Discard a draft (or a rejected one) so its slot can be drafted again.
 *
 * This is the "redraft" the schema comments in `x-threads-db.ts` referred to
 * before it existed — an admin wanting a fresh spotlight thread the same day
 * had no way to clear the stale one and re-trigger generation.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  const deleted = await deleteThread(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Only an unposted thread can be discarded" },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
