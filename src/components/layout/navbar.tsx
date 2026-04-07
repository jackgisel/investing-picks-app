"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";
import { Menu, X, LogOut } from "lucide-react";
import { OutpickWordmark } from "@/components/ui/outpick-logo";
import { useSession, signOut } from "@/lib/auth-client";

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
      <div className="container-op flex items-center justify-between h-16">
        <Link href="/" className="flex items-center">
          <OutpickWordmark size={24} />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7">
          {!isDashboard &&
            NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="font-sans text-[13px] text-text-muted font-medium hover:text-text transition-colors"
              >
                {link.label}
              </Link>
            ))}

          {session ? (
            <div className="flex items-center gap-4">
              {!isDashboard && (
                <Link
                  href="/dashboard"
                  className="font-mono text-[11px] bg-accent-green text-black px-4 py-2 font-semibold tracking-wider hover:bg-accent-green-hover transition-colors"
                >
                  DASHBOARD
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="font-mono text-[11px] text-text-dim hover:text-text transition-colors flex items-center gap-1.5"
              >
                <LogOut size={12} />
                SIGN OUT
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="font-mono text-[11px] bg-accent-green text-black px-4 py-2 font-semibold tracking-wider hover:bg-accent-green-hover transition-colors"
            >
              LOG IN
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-text-muted hover:text-text"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-bg px-7 py-4 space-y-3">
          {!isDashboard &&
            NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block font-sans text-[14px] text-text-muted py-2 hover:text-text transition-colors"
              >
                {link.label}
              </Link>
            ))}

          {session ? (
            <>
              {!isDashboard && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="block font-mono text-[11px] bg-accent-green text-black px-4 py-2.5 font-semibold tracking-wider text-center mt-3 hover:bg-accent-green-hover transition-colors"
                >
                  DASHBOARD
                </Link>
              )}
              <button
                onClick={() => {
                  setMobileOpen(false);
                  handleSignOut();
                }}
                className="block w-full font-mono text-[11px] text-text-dim py-2 text-center hover:text-text transition-colors"
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block font-mono text-[11px] bg-accent-green text-black px-4 py-2.5 font-semibold tracking-wider text-center mt-3 hover:bg-accent-green-hover transition-colors"
            >
              LOG IN
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
