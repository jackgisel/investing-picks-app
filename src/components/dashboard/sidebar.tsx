"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  History,
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
  { label: "Pick History", href: "/dashboard/picks", icon: History },
  { label: "Trades", href: "/dashboard/trades", icon: ArrowLeftRight },
  { label: "Performance", href: "/dashboard/performance", icon: BarChart3 },
  { label: "Strategy", href: "/dashboard/strategy", icon: BookOpen },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-bg min-h-[calc(100vh-64px)] hidden lg:block">
      <nav className="py-6 px-3 space-y-0.5">
        <p className="font-mono text-[9px] text-text-dim tracking-[2px] px-3 mb-4">
          MENU
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-[13px] font-sans transition-colors ${
                isActive
                  ? "text-text bg-bg-tertiary border-l-2 border-accent-green"
                  : "text-text-muted hover:text-text hover:bg-bg-secondary"
              }`}
            >
              <item.icon size={16} className={isActive ? "text-accent-green" : ""} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="lg:hidden border-b border-border overflow-x-auto">
      <div className="flex items-center gap-1 px-4 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 text-[12px] font-sans whitespace-nowrap transition-colors ${
                isActive
                  ? "text-accent-green bg-bg-tertiary"
                  : "text-text-muted hover:text-text"
              }`}
            >
              <item.icon size={14} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
