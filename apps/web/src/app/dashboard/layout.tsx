import type { Metadata } from "next";
import { Sidebar, MobileNav } from "@/components/dashboard/sidebar";
import { DashboardAdminProvider } from "@/components/dashboard/admin-context";
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
    <DashboardAdminProvider isAdmin={isAdmin}>
      <div className="flex min-h-[calc(100vh-72px)] bg-bg">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex-1 min-w-0">
          <MobileNav isAdmin={isAdmin} />
          {/* One width, centered, owned by the shell. Every page used to cap
            itself — five different values across twelve files — inside a
            flex child that was not capped at all, so on a wide display the
            content hugged the sidebar with several hundred pixels of dead
            gutter to its right. */}
        <div className="mx-auto w-full max-w-[1400px] px-5 py-6 lg:px-8 lg:py-7">
          {children}
        </div>
        </div>
      </div>
    </DashboardAdminProvider>
  );
}
