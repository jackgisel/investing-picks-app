import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { ensureMigrations } from "@/lib/auth";
import {
  createProductUpdate,
  listProductUpdates,
} from "@/lib/product-updates-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  await ensureMigrations();
  return NextResponse.json({ updates: await listProductUpdates() });
}

/** Start a new draft. Body is filled in by the editor afterwards. */
export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const subject =
    body && typeof (body as Record<string, unknown>).subject === "string"
      ? ((body as Record<string, unknown>).subject as string).trim()
      : "";
  if (!subject) {
    return NextResponse.json({ error: "A subject is required" }, { status: 400 });
  }

  await ensureMigrations();
  return NextResponse.json({ update: await createProductUpdate(subject) });
}
