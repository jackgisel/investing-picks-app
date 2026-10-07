import { NextResponse } from "next/server";
import { getUserEntries } from "@/lib/challenge/db";
import { cohortFor, entryPath, nyDate } from "@/lib/challenge/rules";
import { getServerUser } from "@/lib/server-session";

export const dynamic = "force-dynamic";

/** Who is signed in, and whether they already entered this quarter. */
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ signedIn: false });
  const entries = await getUserEntries(user.id).catch(() => []);
  const cohort = cohortFor(nyDate(new Date()));
  const current = entries.find((e) => e.cohort === cohort);
  return NextResponse.json(
    {
      signedIn: true,
      name: user.name,
      cohort,
      current: current ? entryPath(current.id) : null,
      entries: entries.map((e) => ({ ...e, href: entryPath(e.id) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
