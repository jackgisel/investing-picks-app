"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, LogOut, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { Avatar } from "@/components/comments/avatar";
import { useTheme } from "@/components/providers/theme-provider";

type Theme = "light" | "dark" | "system";

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const MENU_WIDTH = 224; // w-56
const MENU_GAP = 8;

type MenuCoords = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

function computeMenuCoords(
  rect: DOMRect,
  align: "left" | "right",
  placement: "top" | "bottom",
  menuHeight = 0,
): MenuCoords {
  const next: MenuCoords =
    align === "left"
      ? { left: Math.max(MENU_GAP, rect.left) }
      : { right: Math.max(MENU_GAP, window.innerWidth - rect.right) };

  if (placement === "bottom") {
    const top = rect.bottom + MENU_GAP;
    const fitsBelow =
      menuHeight === 0 || top + menuHeight <= window.innerHeight - MENU_GAP;
    if (fitsBelow) {
      next.top = top;
    } else {
      next.bottom = window.innerHeight - rect.top + MENU_GAP;
    }
  } else {
    const bottom = window.innerHeight - rect.top + MENU_GAP;
    const fitsAbove =
      menuHeight === 0 || rect.top - MENU_GAP - menuHeight >= MENU_GAP;
    if (fitsAbove) {
      next.bottom = bottom;
    } else {
      next.top = rect.bottom + MENU_GAP;
    }
  }

  return next;
}

/**
 * Account menu in the header — avatar, theme, sign out.
 *
 * Replaces a bare theme button sitting beside a "Sign out" text link, which
 * read as two unrelated controls that happened to be adjacent. Both belong to
 * "you", so they live behind the thing that represents you.
 */
export function UserMenu({
  userId,
  accountName,
  email,
  onSignOut,
  align = "right",
  placement = "bottom",
}: {
  userId: string;
  /** BetterAuth's `name`. Fine here — this menu is only ever shown to the
   *  account holder. It must NOT be used where a name is published; see the
   *  display_name column and lib/comments.ts. */
  accountName: string | null;
  email: string;
  onSignOut: () => void;
  align?: "left" | "right";
  placement?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // The public display name when they have set one, so the header matches how
  // they appear in discussions.
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("no profile");
      return (await res.json()) as { display_name: string | null };
    },
    retry: false,
    staleTime: 60_000,
  });

  const name =
    profile.data?.display_name?.trim() || accountName?.trim() || email;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) {
      setCoords(null);
      return;
    }

    function updatePosition() {
      const trigger = buttonRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight ?? 0;
      setCoords(computeMenuCoords(rect, align, placement, menuHeight));
    }

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, align, placement]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Escape must return focus to the trigger, or the user is dropped at the
      // top of the document with no idea where they are.
      buttonRef.current?.focus();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu = open && coords ? (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Account"
      style={{
        position: "fixed",
        width: MENU_WIDTH,
        zIndex: 50,
        ...coords,
      }}
      className="overflow-hidden rounded-soft border border-border bg-bg shadow-lg"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="truncate font-sans text-[13px] font-semibold text-text">
          {name}
        </p>
        {/* Only when it adds information — showing the email twice when it
            IS the name is noise. */}
        {name !== email && (
          <p className="truncate font-sans text-[11px] text-text-dim">
            {email}
          </p>
        )}
      </div>

      <div className="px-2 py-2">
        <p className="px-2 pb-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-text-dim">
          Theme
        </p>
        {THEMES.map((t) => {
          const Icon = t.icon;
          const active = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="menuitemradio"
              aria-checked={active}
              onClick={() => setTheme(t.value)}
              className="flex w-full items-center gap-2.5 rounded-soft px-2 py-1.5 font-sans text-[13px] text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text focus-visible:outline-none focus-visible:bg-bg-tertiary"
            >
              <Icon size={13} aria-hidden />
              {t.label}
              {active && (
                <Check size={13} className="ml-auto text-accent-green" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-border p-2">
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onSignOut();
          }}
          className="flex w-full items-center gap-2.5 rounded-soft px-2 py-1.5 font-sans text-[13px] text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text focus-visible:outline-none focus-visible:bg-bg-tertiary"
        >
          <LogOut size={13} aria-hidden />
          Sign out
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next && buttonRef.current) {
              setCoords(
                computeMenuCoords(
                  buttonRef.current.getBoundingClientRect(),
                  align,
                  placement,
                ),
              );
            }
            return next;
          });
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${name}`}
        className="flex items-center rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        <Avatar userId={userId} displayName={name} size="sm" />
      </button>

      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
