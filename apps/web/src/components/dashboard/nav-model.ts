import {
  LayoutDashboard,
  Briefcase,
  BookOpen,
  Settings,
  ScanSearch,
  FileText,
  Megaphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * The dashboard navigation model.
 *
 * Kept apart from sidebar.tsx so the routing rules — which item owns which
 * path, and who is allowed to see which group — can be tested as plain
 * functions, without a React renderer or a mocked usePathname.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Child routes with no nav entry of their own that belong to this item. */
  owns?: readonly string[];
}

export interface NavGroup {
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
      { label: "Positions", href: "/dashboard/positions", icon: Briefcase },
      { label: "Insights", href: "/dashboard/insights", icon: FileText },
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
      {
        label: "Research notes",
        href: "/dashboard/ops/insights",
        icon: FileText,
      },
      {
        label: "Product updates",
        href: "/dashboard/ops/product-updates",
        icon: Megaphone,
      },
    ],
  },
];

export function covers(pathname: string, base: string) {
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
export function activeHref(
  pathname: string,
  items: readonly NavItem[],
): string | null {
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

export function visibleGroups(isAdmin: boolean): readonly NavGroup[] {
  return NAV_GROUPS.filter((g) => !g.adminOnly || isAdmin);
}

export function flatten(groups: readonly NavGroup[]): readonly NavItem[] {
  return groups.flatMap((g) => g.items);
}
