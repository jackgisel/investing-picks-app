import { cn } from "@/lib/utils";
import { TONE_BG, type PastelTone } from "@/lib/tones";
import type { ReactNode } from "react";

// The palette moved to lib/tones so non-chip surfaces can share it.
// Re-exported here because eight files already import these names.
export { TONE_BG as PASTEL, type PastelTone };

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
    <span className={cn("category-tag", TONE_BG[tone], className)}>
      {children}
    </span>
  );
}
