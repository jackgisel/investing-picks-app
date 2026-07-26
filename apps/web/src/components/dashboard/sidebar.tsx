"use client";

import { Fragment } from "react";
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
  FileText,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Child routes with no nav entry of their own that belong to this item. */
  owns?: readonly string[];
}

interface NavGroup {
  /** Eyebrow above the group. Omitted for the product nav, which needs none. */
  label?: string;
  /** Rendered only when the server says the viewer is an admin. */
  adminOnly?: boolean;
  items: readonly NavItem[];
}

/**
 * Two groups, not one flat list.
 *
 * The operator tools used to sit inline as items 8 and 9 of the same menu a
 * subscriber uses, which made the product look like it had ten top-level
 * concerns when it has eight. They are a different job — running the book
 * rather than reading it — so they get their own labelled section, pinned
 * below the product nav and rendered for nobody else.
 */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Portfolio", href: "/dashboard/portfolio", icon: Briefcase },
      { label: "Pick history", href: "/dashboard/picks", icon: History },
      { label: "Trades", href: "/dashboard/trades", icon: ArrowLeftRight },
      { label: "Performance", href: "/dashboard/performance", icon: BarChart3 },
      { label: "Insights", href: "/insights", icon: FileText },
      { label: "Strategy", href: "/dashboard/strategy", icon: BookOpen },
      { label: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    items: [
      {
        label: "Decision ledger",
        href: "/dashboard/ops",
        icon: ScanSearch,
        owns: ["/dashboard/ops/evaluations"],
      },
      {
        label: "Virtual book",
        href: "/dashboard/ops/book",
        icon: Wallet,
        owns: ["/dashboard/ops/positions"],
      },
    ],
  },
];

function covers(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The href of the nav item that should be highlighted, or null.
 *
 * Longest match wins, so /dashboard/ops/book highlights "Virtual book" rather
 * than "Decision ledger" — the previous prefix test had to special-case
 * /dashboard and /dashboard/ops by hand, and still left the two-level ops
 * routes highlighting nothing at all.
 */
function activeHref(pathname: string, items: readonly NavItem[]): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const item of items) {
    for (const base of [item.href, ...(item.owns ?? [])]) {
      if (covers(pathname, base) && base.length > bestLen) {
        best = item.href;
        bestLen = base.length;
      }
    }
  }
  return best;
}

function visibleGroups(isAdmin: boolean): readonly NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);
}

function flatten(groups: readonly NavGroup[]): readonly NavItem[] {
  return groups.flatMap((g) => g.items);
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const groups = visibleGroups(isAdmin);
  const active = activeHref(pathname, flatten(groups));

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-bg min-h-[calc(100vh-72px)] hidden lg:flex lg:flex-col lg:justify-between">
      <nav aria-label="Dashboard" className="py-6 px-3">
        {groups.map((group) => (
          <div
            key={group.label ?? "product"}
            className={cn(
              "space-y-1",
              group.label && "mt-6 pt-5 border-t border-border",
            )}
          >
            {group.label && (
              <p className="px-3 pb-1 font-sans text-[10px] font-bold tracking-[0.16em] uppercase text-text-dim">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 text-[13px] font-sans font-medium rounded-pill transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
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
          </div>
        ))}
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

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const groups = visibleGroups(isAdmin);
  const items = flatten(groups);
  const active = activeHref(pathname, items);
  // The strip is one scrolling row, so the admin group is marked by a rule
  // before its first item rather than by a heading.
  const adminStartsAt = groups[0]?.items.length ?? 0;

  return (
    <nav
      aria-label="Dashboard"
      className="lg:hidden border-b border-border overflow-x-auto bg-bg"
    >
      <div className="flex items-center gap-1.5 px-4 py-3">
        {items.map((item, i) => {
          const isActive = item.href === active;
          return (
            <Fragment key={item.href}>
              {items.length > adminStartsAt && i === adminStartsAt && (
                <span
                  className="mx-1 h-5 w-px shrink-0 self-center bg-border"
                  aria-hidden
                />
              )}
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              ref={
                isActive
                  ? (el) =>
                      // The strip scrolls, and the active pill is often past
                      // the right edge on a phone — without this the user
                      // lands on a nav that appears to have nothing selected.
                      el?.scrollIntoView({ block: "nearest", inline: "center" })
                  : undefined
              }
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 text-[12px] font-sans font-semibold whitespace-nowrap rounded-pill transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
                isActive
                  ? "bg-inverse text-inverse-fg"
                  : "text-text-muted hover:text-text bg-bg-secondary"
              )}
            >
              <item.icon size={14} />
              {item.label}
            </Link>
            </Fragment>
          );
        })}
        <span className="shrink-0 ml-1">
          <ThemeToggle />
        </span>
      </div>
    </nav>
  );
}
