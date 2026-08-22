import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Weekly $1,000" };

/**
 * Hidden from members until a few live Fridays have accumulated.
 * Direct URLs 404 the same way /dashboard/ops does.
 */
export default async function DcaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();
  return <>{children}</>;
}
