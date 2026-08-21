"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  activeHref,
  flatten,
  visibleGroups,
} from "./nav-model";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { UserMenu } from "@/components/layout/user-menu";
import { useSession, signOut } from "@/lib/auth-client";

function AccountMenu({
  align = "left",
  placement = "top",
}: {
  align?: "left" | "right";
  placement?: "top" | "bottom";
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;
  if (!user) return null;

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <UserMenu
      userId={user.id}
      accountName={user.name ?? null}
      email={user.email ?? ""}
      onSignOut={handleSignOut}
      align={align}
      placement={placement}
    />
  );
}

export function Sidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const groups = visibleGroups(isAdmin);
  const active = activeHref(pathname, flatten(groups));

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-bg lg:sticky lg:top-0 lg:flex lg:h-screen lg:self-start lg:flex-col lg:overflow-y-auto">
      <div className="px-5 pt-5 pb-3">
        <Link href="/" className="inline-flex">
          <OutpickWordmark size={20} />
        </Link>
      </div>
      <nav aria-label="Dashboard" className="flex-1 py-3 px-3">
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
      <div className="mt-auto border-t border-border px-4 py-4">
        <AccountMenu />
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
    <div className="lg:hidden border-b border-border bg-bg">
      <div className="flex items-center justify-between gap-3 px-4 h-14">
        <Link href="/" className="inline-flex min-w-0">
          <OutpickWordmark size={18} />
        </Link>
        <AccountMenu align="right" placement="bottom" />
      </div>
      <nav aria-label="Dashboard" className="overflow-x-auto">
        <div className="flex items-center gap-1.5 px-4 pb-3">
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
        </div>
      </nav>
    </div>
  );
}
