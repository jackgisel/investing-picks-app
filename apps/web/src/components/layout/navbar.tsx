"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { PillButton } from "@/components/ui/pill-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { useSession, signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Strategy", href: "/#strategy" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
] as const;

const MOBILE_EXTRA_LINKS = [
  { label: "Track record", href: "/track-record" },
  { label: "How it works", href: "/#what-how" },
  { label: "FAQ", href: "/#faq" },
] as const;

const MOBILE_LINKS = [...NAV_LINKS, ...MOBILE_EXTRA_LINKS] as const;

const linkClassName =
  "font-sans text-[12px] font-bold tracking-[0.14em] uppercase text-text hover:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 rounded-sm";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

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

  return (
    <nav
      className={cn(
        "sticky top-0 border-b border-border",
        mobileOpen
          ? "z-[110] bg-bg"
          : "z-50 bg-bg/95 backdrop-blur-sm",
      )}
    >
      <div className="flex h-[calc(72px+env(safe-area-inset-top))] items-center justify-between container-op pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-7 min-w-0">
          <Link href={session ? "/dashboard" : "/"} className="shrink-0">
            <OutpickWordmark />
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={linkClassName}>
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3">
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

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 -mr-2 text-text shrink-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-sheet"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="mobile-nav-sheet"
          className="fixed inset-x-0 bottom-0 top-[calc(72px+env(safe-area-inset-top))] z-[110] overflow-y-auto overscroll-contain bg-bg px-6 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:hidden"
        >
          {MOBILE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block font-sans text-[14px] font-bold tracking-[0.1em] uppercase text-text py-3"
            >
              {link.label}
            </Link>
          ))}

          <div className="flex items-center justify-between pt-4 pb-1">
            <span className="font-sans text-[11px] font-bold tracking-[0.1em] uppercase text-text-dim">
              Theme
            </span>
            <ThemeToggle />
          </div>

          {session ? (
            <div className="pt-3 space-y-3">
              <Link
                href="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full text-center text-[11px]"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="block w-full font-sans text-[12px] font-semibold tracking-[0.1em] uppercase text-text-dim py-2 text-center"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="pt-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="btn-primary w-full text-center text-[11px]"
              >
                Log in
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
