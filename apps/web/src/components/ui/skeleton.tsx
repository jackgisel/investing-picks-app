import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cn("block rounded bg-bg-tertiary animate-pulse", className)}
      style={style}
      aria-hidden
    />
  );
}
