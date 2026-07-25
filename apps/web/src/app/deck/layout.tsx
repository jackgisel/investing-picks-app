import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio Review Deck",
  robots: { index: false, follow: false },
};

/**
 * The deck renders live portfolio data — tickers, entries, current P&L — which
 * is the paid product. Same admin gate as /dashboard/ops: non-admins get a 404
 * so the route isn't discoverable.
 */
export default async function DeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();
  return <>{children}</>;
}
