import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  deleteProductUpdate,
  getProductUpdate,
  updateProductUpdate,
} from "@/lib/product-updates-db";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const update = await getProductUpdate((await params).id);
  if (!update) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ update });
}

/** Edits to a draft. A sent update is frozen. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<Params> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  await ensureMigrations();
  const { id } = await params;
  const updated = await updateProductUpdate(id, {
    subject: typeof b.subject === "string" ? b.subject : undefined,
    bodyMd: typeof b.bodyMd === "string" ? b.bodyMd : undefined,
  });

  if (!updated) {
    const existing = await getProductUpdate(id);
    return NextResponse.json(
      {
        error: existing
          ? "This update was already sent. Editing it would change what subscribers were mailed."
          : "Not found",
      },
      { status: existing ? 409 : 404 },
    );
  }
  return NextResponse.json({ update: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  const { id } = await params;
  if (!(await deleteProductUpdate(id))) {
    const existing = await getProductUpdate(id);
    return NextResponse.json(
      {
        error: existing
          ? "A sent update is a record of what went out and cannot be deleted."
          : "Not found",
      },
      { status: existing ? 409 : 404 },
    );
  }
  return NextResponse.json({ ok: true });
}
