import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface SoftCardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "section";
}

export function SoftCard({
  children,
  className,
  as: Tag = "div",
}: SoftCardProps) {
  return <Tag className={cn("soft-card", className)}>{children}</Tag>;
}
