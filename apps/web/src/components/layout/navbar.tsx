"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Menu, Search, X } from "lucide-react";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { PillButton } from "@/components/ui/pill-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { SearchPalette } from "@/components/search/search-palette";
import { useSession, signOut } from "@/lib/auth-client";
import { navSections, type NavLink, type NavSection } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

export type NavArticle = { title: string; href: string; detail: string };

const triggerClass =
  "inline-flex items-center gap-1 rounded-sm font-sans text-[12px] font-bold uppercase tracking-[0.14em] text-text transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2";

function isActive(pathname: string, section: NavSection): boolean {
  const roots: Record<NavSection["id"], string[]> = {
    research: ["/blog", "/research"],
    tools: ["/tools"],
    data: ["/companies", "/workforce"],
    outpick: ["/strategy", "/track-record", "/market-note", "/faq", "/what-we-are-not"],
  };
  return roots[section.id].some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function megaPanelId(id: NavSection["id"]): string {
  return `mega-panel-${id}`;
}

function mobileSectionId(id: NavSection["id"]): string {
  return `mobile-nav-${id}`;
}

function MenuLink({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className="group -mx-3 block rounded-lg px-3 py-2.5 transition-colors hover:bg-bg-secondary"
    >
      <span className="flex items-center gap-2 font-sans text-[14px] font-semibold text-text">
        {link.label}
        {link.badge && (
          <span className="rounded-pill bg-accent-yellow px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-on-accent">
            {link.badge}
          </span>
        )}
      </span>
      {link.blurb && (
        <span className="mt-0.5 block font-sans text-[13px] leading-snug text-text-muted line-clamp-2">
          {link.blurb}
        </span>
      )}
    </Link>
  );
}

function MegaPanel({
  section,
  latest,
  onNavigate,
}: {
  section: NavSection;
  latest: NavArticle[];
  onNavigate: () => void;
}) {
  const showLatest = section.id === "research" && latest.length > 0;
  return (
    <div className="container-op grid grid-cols-12 gap-8 py-8">
      <div
        className={cn(
          "grid gap-8",
          section.feature ? "col-span-8" : "col-span-12",
          section.groups.length > 1 || showLatest ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        {section.groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">
              {g.label}
            </p>
            <div className={cn(g.links.length > 4 && !showLatest && "grid grid-cols-2 gap-x-6")}>
              {g.links.map((l) => (
                <MenuLink key={l.href} link={l} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        {showLatest && (
          <div>
            <p className="mb-2 font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-text-dim">
              Latest
            </p>
            {latest.map((a) => (
              <MenuLink key={a.href} link={{ label: a.title, href: a.href, blurb: a.detail }} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
      {section.feature && (
        <Link
          href={section.feature.href}
          onClick={onNavigate}
          className="group col-span-4 flex flex-col justify-between rounded-soft bg-bg-secondary p-6 transition-colors hover:bg-bg-tertiary"
        >
          <div>
            {section.feature.badge && (
              <span className="rounded-pill bg-accent-yellow px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-on-accent">
                {section.feature.badge}
              </span>
            )}
            <p className="mt-4 font-sans text-[22px] font-extrabold leading-tight tracking-tight text-text">
              {section.feature.label}
            </p>
            <p className="mt-2 font-sans text-[14px] leading-relaxed text-text-muted">
              {section.feature.blurb}
            </p>
          </div>
          <span className="mt-6 inline-flex items-center gap-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-text">
            {section.feature.cta}
            <ArrowRight size={14} aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}
    </div>
  );
}

export function Navbar({
  latest = [],
  hasSampleResearch = false,
}: {
  latest?: NavArticle[];
  hasSampleResearch?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openId, setOpenId] = useState<NavSection["id"] | null>(null);
  const [mobileSection, setMobileSection] = useState<NavSection["id"] | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const sections = navSections({ hasSampleResearch });

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  const closeAll = useCallback(() => {
    setOpenId(null);
    setMobileOpen(false);
  }, []);

  // Any navigation closes every menu.
  useEffect(() => {
    closeAll();
  }, [pathname, closeAll]);

  // Cmd/Ctrl+K and "/" open search from anywhere on the public site.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setOpenId(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  function clearTimers() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }

  // Hover intent: a short delay on open so sweeping the pointer across the bar
  // does not flash every panel, and a longer one on close so moving down into
  // the panel never drops it.
  function hoverOpen(id: NavSection["id"]) {
    clearTimers();
    openTimer.current = setTimeout(() => setOpenId(id), openId ? 0 : 90);
  }
  function hoverClose() {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpenId(null), 160);
  }

  const openSection = sections.find((s) => s.id === openId) ?? null;

  return (
    <>
      <nav
        aria-label="Main"
        onPointerLeave={(e) => e.pointerType === "mouse" && hoverClose()}
        className={cn(
          "sticky top-0 border-b border-border",
          mobileOpen ? "z-[110] bg-bg" : "z-50 bg-bg/95 backdrop-blur-sm",
          openSection && "bg-bg",
        )}
      >
        <div className="flex h-[var(--nav-h)] items-center justify-between gap-6 container-op pt-[env(safe-area-inset-top)]">
          <div className="flex min-w-0 items-center gap-8">
            <Link href={session ? "/dashboard" : "/"} className="shrink-0" aria-label="Outpick home">
              <OutpickWordmark />
            </Link>

            <ul className="hidden items-center gap-6 lg:flex">
              {sections.map((s) => {
                const open = openId === s.id;
                return (
                  <li
                    key={s.id}
                    className="inline-flex items-center gap-1"
                    onPointerEnter={(e) => e.pointerType === "mouse" && hoverOpen(s.id)}
                  >
                    <Link
                      href={s.href}
                      className={cn(
                        triggerClass,
                        isActive(pathname, s) && "underline decoration-2 underline-offset-[10px]",
                      )}
                    >
                      {s.label}
                    </Link>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={megaPanelId(s.id)}
                      aria-haspopup="true"
                      aria-label={`${s.label} menu`}
                      onClick={() => setOpenId(open ? null : s.id)}
                      className="inline-flex items-center rounded-sm text-text transition-opacity hover:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
                    >
                      <ChevronDown
                        size={13}
                        aria-hidden
                        className={cn("transition-transform duration-150", open && "rotate-180")}
                      />
                    </button>
                  </li>
                );
              })}
              <li onPointerEnter={(e) => e.pointerType === "mouse" && hoverClose()}>
                <Link
                  href="/pricing"
                  className={cn(
                    triggerClass,
                    pathname === "/pricing" && "underline decoration-2 underline-offset-[10px]",
                  )}
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="press inline-flex h-9 items-center gap-2 rounded-pill border border-border px-3.5 font-sans text-[13px] text-text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              <Search size={15} aria-hidden />
              <span>Search</span>
              <kbd className="hidden rounded border border-border px-1.5 font-mono text-[11px] text-text-dim xl:inline">
                ⌘K
              </kbd>
            </button>
            {session ? (
              <>
                <PillButton href="/dashboard" className="text-[11px] px-4 py-2">
                  Dashboard
                </PillButton>
                <UserMenu
                  userId={session.user.id}
                  accountName={session.user.name ?? null}
                  email={session.user.email ?? ""}
                  onSignOut={handleSignOut}
                />
              </>
            ) : (
              <>
                <ThemeToggle />
                <PillButton href="/login" className="text-[11px] px-4 py-2">
                  Log in
                </PillButton>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text"
            >
              <Search size={20} />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="-mr-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-sheet"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Panels stay in the server HTML so crawlers see every href. Closed
            menus are hidden, not unmounted. */}
        {sections.map((s) => {
          const open = openId === s.id;
          return (
            <div
              key={s.id}
              id={megaPanelId(s.id)}
              hidden={!open}
              onPointerEnter={(e) => e.pointerType === "mouse" && clearTimers()}
              className={cn(
                "absolute inset-x-0 top-full border-b border-border bg-bg shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)]",
                open ? "hidden lg:block" : "hidden",
              )}
            >
              <MegaPanel section={s} latest={latest} onNavigate={closeAll} />
            </div>
          );
        })}

        <div
          id="mobile-nav-sheet"
          hidden={!mobileOpen}
          className={cn(
            "fixed inset-x-0 bottom-0 top-[var(--nav-h)] z-[110] overflow-y-auto overscroll-contain bg-bg px-6 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:hidden",
            !mobileOpen && "hidden",
          )}
        >
          <ul className="divide-y divide-border">
            {sections.map((s) => {
              const open = mobileSection === s.id;
              const regionId = mobileSectionId(s.id);
              return (
                <li key={s.id}>
                  <div className="flex w-full items-center">
                    <Link
                      href={s.href}
                      onClick={closeAll}
                      className="flex-1 py-4 font-sans text-[14px] font-bold uppercase tracking-[0.1em] text-text"
                    >
                      {s.label}
                    </Link>
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={regionId}
                      aria-haspopup="true"
                      aria-label={`${s.label} menu`}
                      onClick={() => setMobileSection(open ? null : s.id)}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text"
                    >
                      <ChevronDown size={18} aria-hidden className={cn("transition-transform", open && "rotate-180")} />
                    </button>
                  </div>
                  <div id={regionId} hidden={!open} className={cn(!open && "hidden", "pb-4")}>
                    {s.feature && (
                      <Link
                        href={s.feature.href}
                        onClick={closeAll}
                        className="mb-2 flex items-center justify-between rounded-xl bg-bg-secondary px-4 py-3"
                      >
                        <span>
                          <span className="block font-sans text-[15px] font-bold text-text">{s.feature.label}</span>
                          <span className="block font-sans text-[12px] text-text-muted">{s.feature.cta}</span>
                        </span>
                        <ArrowRight size={16} aria-hidden />
                      </Link>
                    )}
                    {s.groups.flatMap((g) => g.links).map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={closeAll}
                        className="block py-2.5 pl-1 font-sans text-[15px] text-text"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </li>
              );
            })}
            <li>
              <Link
                href="/pricing"
                onClick={closeAll}
                className="block py-4 font-sans text-[14px] font-bold uppercase tracking-[0.1em] text-text"
              >
                Pricing
              </Link>
            </li>
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-4 pb-1">
            <span className="font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-text-dim">
              Theme
            </span>
            <ThemeToggle />
          </div>

          {session ? (
            <div className="space-y-3 pt-4">
              <Link href="/dashboard" onClick={closeAll} className="btn-primary w-full text-center text-[11px]">
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="block w-full py-2 text-center font-sans text-[12px] font-semibold uppercase tracking-[0.1em] text-text-dim"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-4">
              <Link href="/tools/beat-the-sp-500" onClick={closeAll} className="btn-primary w-full text-center text-[11px]">
                Play Beat the S&amp;P
              </Link>
              <Link href="/login" onClick={closeAll} className="btn-outline w-full text-center text-[11px]">
                Log in
              </Link>
            </div>
          )}
        </div>
      </nav>
      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
