import { NextResponse } from "next/server";
import { ensureMigrations } from "@/lib/auth";
import { getServerUser } from "@/lib/server-session";
import {
  getPreferences,
  setPreferences,
  type NotificationPrefs,
} from "@/lib/preferences";

export async function GET() {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prefs = await getPreferences(user.id);
  return NextResponse.json({ preferences: prefs });
}

export async function PUT(req: Request) {
  await ensureMigrations();
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = (body ?? {}) as Partial<Record<keyof NotificationPrefs, unknown>>;
  const current = await getPreferences(user.id);

  // Merge so partial updates work, and coerce booleans defensively.
  const next: NotificationPrefs = {
    newPicks:
      typeof incoming.newPicks === "boolean" ? incoming.newPicks : current.newPicks,
    weeklySummary:
      typeof incoming.weeklySummary === "boolean"
        ? incoming.weeklySummary
        : current.weeklySummary,
    performanceAlerts:
      typeof incoming.performanceAlerts === "boolean"
        ? incoming.performanceAlerts
        : current.performanceAlerts,
    productUpdates:
      typeof incoming.productUpdates === "boolean"
        ? incoming.productUpdates
        : current.productUpdates,
  };

  const saved = await setPreferences(user.id, next);
  return NextResponse.json({ preferences: saved });
}
