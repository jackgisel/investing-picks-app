import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getAdminUser } from "@/lib/admin";
import { getServerUser } from "@/lib/server-session";
import { deleteComment } from "@/lib/comments-db";

export const dynamic = "force-dynamic";

/**
 * Soft-delete a comment. The author may remove their own; an admin may remove
 * any. Both "not yours" and "does not exist" answer 404 so that walking ids
 * cannot be used to enumerate comments on threads the caller cannot see.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureMigrations();

  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  // BIGSERIAL ids only. Postgres would reject a non-numeric literal anyway,
  // but as a 22P02 error rather than the 404 the caller should see.
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const removed = await deleteComment(id, {
    id: user.id,
    isAdmin: (await getAdminUser()) !== null,
  });
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
