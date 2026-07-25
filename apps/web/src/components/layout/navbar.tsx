"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { PillButton } from "@/components/ui/pill-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSession, signOut } from "@/lib/auth-client";

const LEFT_LINKS = [
  { label: "Strategy", href: "/#strategy" },
  { label: "Insights", href: "/insights" },
] as const;

const RIGHT_LINKS = [
  { label: "Pricing", href: "/#pricing" },
  { label: "Blog", href: "/blog" },
] as const;

const MOBILE_LINKS = [
  ...LEFT_LINKS,
  ...RIGHT_LINKS,
  { label: "Track record", href: "/#track-record" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
] as const;

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const isDashboard = pathname.startsWith("/dashboard");

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <nav className="border-b border-border sticky top-0 z-50 bg-bg/95 backdrop-blur-sm">
      <div className="container-op grid grid-cols-[1fr_auto_1fr] items-center h-[72px]">
        <div className="hidden md:flex items-center gap-7 justify-start">
          {!isDashboard &&
            LEFT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-[12px] font-bold tracking-[0.14em] uppercase text-text hover:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 rounded-sm"
              >
                {link.label}
              </Link>
            ))}
        </div>

        <Link href="/" className="justify-self-center col-start-2">
          <OutpickWordmark />
        </Link>

        <div className="hidden md:flex items-center gap-5 justify-end">
          {!isDashboard &&
            RIGHT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-[12px] font-bold tracking-[0.14em] uppercase text-text hover:opacity-60 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 rounded-sm"
              >
                {link.label}
              </Link>
            ))}

          <ThemeToggle />

          {session ? (
            <div className="flex items-center gap-3">
              {!isDashboard && (
                <PillButton href="/dashboard" className="text-[11px] px-4 py-2">
                  Dashboard
                </PillButton>
              )}
              <button
                onClick={handleSignOut}
                className="font-sans text-[11px] font-semibold tracking-[0.1em] uppercase text-text-dim hover:text-text transition-colors flex items-center gap-1.5"
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          ) : (
            <PillButton href="/login" className="text-[11px] px-4 py-2">
              Log in
            </PillButton>
          )}
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden justify-self-end col-start-3 text-text"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-bg px-6 py-5 space-y-1">
          {!isDashboard &&
            MOBILE_LINKS.map((link) => (
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
              {!isDashboard && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="btn-primary w-full text-center text-[11px]"
                >
                  Dashboard
                </Link>
              )}
              <button
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
