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
  ScanSearch,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
  { label: "Pick History", href: "/dashboard/picks", icon: History },
  { label: "Trades", href: "/dashboard/trades", icon: ArrowLeftRight },
  { label: "Performance", href: "/dashboard/performance", icon: BarChart3 },
  { label: "Strategy", href: "/dashboard/strategy", icon: BookOpen },
  { label: "Ops ledger", href: "/dashboard/ops", icon: ScanSearch },
  { label: "Ops book", href: "/dashboard/ops/book", icon: Wallet },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
] as const;

function isItemActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/ops") return pathname === "/dashboard/ops";
  return pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-bg min-h-[calc(100vh-72px)] hidden lg:flex lg:flex-col lg:justify-between">
      <nav className="py-6 px-3 space-y-1">
        <p className="font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-text-dim px-3 mb-3">
          Menu
        </p>
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 text-[13px] font-sans font-medium rounded-pill transition-colors",
                isActive
                  ? "bg-inverse text-inverse-fg"
                  : "text-text-muted hover:text-text hover:bg-bg-secondary"
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-border flex items-center justify-between">
        <span className="font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-text-dim">
          Theme
        </span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="lg:hidden border-b border-border overflow-x-auto bg-bg">
      <div className="flex items-center gap-1.5 px-4 py-3">
        {NAV_ITEMS.map((item) => {
          const isActive = isItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-[12px] font-sans font-semibold whitespace-nowrap rounded-pill transition-colors",
                isActive
                  ? "bg-inverse text-inverse-fg"
                  : "text-text-muted hover:text-text bg-bg-secondary"
              )}
            >
              <item.icon size={14} />
              {item.label}
            </Link>
          );
        })}
        <span className="shrink-0 ml-1">
          <ThemeToggle />
        </span>
      </div>
    </div>
  );
}
