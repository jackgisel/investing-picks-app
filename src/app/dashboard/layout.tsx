import type { Metadata } from "next";
import { Sidebar, MobileNav } from "@/components/dashboard/sidebar";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <Sidebar />
      <div className="flex-1 min-w-0">
        <MobileNav />
        <div className="p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
