import type { Metadata } from "next";
import { Sidebar, MobileNav } from "@/components/dashboard/sidebar";
import { getAdminUser } from "@/lib/admin";

export const metadata: Metadata = {
  title: "Dashboard",
};

// The nav's contents depend on who is signed in, so this layout can't be
// prerendered — same reason /dashboard/ops/layout.tsx opts out.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Presentation only. /dashboard/ops/layout.tsx is still the gate that
  // decides whether those pages render at all — this just stops the nav
  // advertising them to people it will then 404.
  const isAdmin = (await getAdminUser()) !== null;

  return (
    <div className="flex min-h-[calc(100vh-72px)] bg-bg">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex-1 min-w-0">
        <MobileNav isAdmin={isAdmin} />
        <div className="p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
