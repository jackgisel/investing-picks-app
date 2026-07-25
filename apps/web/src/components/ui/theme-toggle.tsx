"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/providers/theme-provider";

type Theme = "light" | "dark" | "system";

const CYCLE: Theme[] = ["system", "light", "dark"];

const THEME_META: Record<Theme, { icon: LucideIcon; label: string }> = {
  system: { icon: Monitor, label: "System" },
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
};

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const baseClasses = cn(
    "inline-flex items-center justify-center w-9 h-9 rounded-pill border border-border-strong bg-bg text-text transition-colors duration-200 hover:bg-inverse hover:text-inverse-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    className
  );

  // Render a stable, theme-agnostic placeholder until mounted so the icon
  // doesn't flip the moment hydration resolves the real preference.
  if (!mounted) {
    return (
      <button
        type="button"
        className={baseClasses}
        aria-label="Toggle theme"
        disabled
      >
        <Monitor size={16} aria-hidden />
      </button>
    );
  }

  const current = THEME_META[theme];
  const Icon = current.icon;

  function handleClick() {
    const nextIndex = (CYCLE.indexOf(theme) + 1) % CYCLE.length;
    setTheme(CYCLE[nextIndex]);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={baseClasses}
      aria-label={`Theme: ${current.label}. Click to switch theme.`}
    >
      <Icon size={16} aria-hidden />
    </button>
  );
}
