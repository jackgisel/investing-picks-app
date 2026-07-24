import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Server-side admin gate for every /dashboard/ops page.
 *
 * Middleware only proves a session cookie exists — this proves the signed-in
 * user is actually an admin. Non-admins get a 404, same as the API, so the
 * surface isn't discoverable.
 */
export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();
  return <>{children}</>;
}
