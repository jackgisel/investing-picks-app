import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const PASTEL = {
  yellow: "bg-accent-yellow",
  peach: "bg-accent-peach",
  lilac: "bg-accent-lilac",
  mint: "bg-accent-mint",
  coral: "bg-accent-coral",
  cyan: "bg-accent-cyan",
} as const;

export type PastelTone = keyof typeof PASTEL;

interface CategoryTagProps {
  children: ReactNode;
  tone?: PastelTone;
  className?: string;
}

export function CategoryTag({
  children,
  tone = "yellow",
  className,
}: CategoryTagProps) {
  return (
    <span className={cn("category-tag", PASTEL[tone], className)}>
      {children}
    </span>
  );
}
