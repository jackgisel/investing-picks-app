"use client";

import { useEffect, useRef } from "react";
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
import { HScroll } from "@/components/ui/h-scroll";

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
        <Link href="/dashboard" className="inline-flex">
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

function navPillClass(isActive: boolean) {
  return cn(
    "flex items-center gap-2 px-3.5 py-2 text-[12px] font-sans font-semibold whitespace-nowrap rounded-pill transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    isActive
      ? "bg-inverse text-inverse-fg"
      : "text-text-muted hover:text-text bg-bg-secondary",
  );
}

export function MobileNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const groups = visibleGroups(isAdmin);
  const memberItems = groups[0]?.items ?? [];
  const adminItems = groups.find((g) => g.adminOnly)?.items ?? [];
  const active = activeHref(pathname, flatten(groups));
  const adminNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = adminNavRef.current;
    if (!nav) return;
    const current = nav.querySelector("[aria-current='page']");
    if (!(current instanceof HTMLElement)) return;
    const left =
      current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left) });
  }, [pathname]);

  return (
    <div className="lg:hidden border-b border-border bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Link href="/dashboard" className="inline-flex min-w-0">
          <OutpickWordmark size={18} />
        </Link>
        <AccountMenu align="right" placement="bottom" />
      </div>
      <nav aria-label="Dashboard" className="px-4 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {memberItems.map((item) => {
            const isActive = item.href === active;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={navPillClass(isActive)}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </div>
        {adminItems.length > 0 && (
          <HScroll
            className="mt-2 -mx-4"
            innerClassName="flex items-center gap-1.5 px-4"
            scrollRef={adminNavRef}
          >
            {adminItems.map((item) => {
              const isActive = item.href === active;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={navPillClass(isActive)}
                >
                  <item.icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </HScroll>
        )}
      </nav>
    </div>
  );
}
