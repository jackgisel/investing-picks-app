import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "solid" | "outline";

const variants: Record<Variant, string> = {
  solid: "bg-inverse text-inverse-fg hover:bg-inverse/90 border border-transparent",
  outline:
    "bg-bg text-text border border-border-strong hover:bg-inverse hover:text-inverse-fg",
};

const base =
  "inline-flex items-center justify-center gap-2 font-sans text-xs sm:text-sm font-semibold tracking-[0.08em] uppercase rounded-pill px-5 py-2.5 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

interface PillButtonProps {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  href?: string;
  arrow?: boolean;
}

export function PillButton({
  children,
  variant = "solid",
  className,
  href,
  arrow,
  ...rest
}: PillButtonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = cn(base, variants[variant], className);

  const content = (
    <>
      {children}
      {arrow && (
        <span
          className={cn(
            "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] transition-transform duration-200 group-hover:translate-x-0.5",
            variant === "solid" ? "bg-inverse-fg/20" : "bg-text/10",
          )}
          aria-hidden
        >
          →
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn(classes, "group")}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cn(classes, "group")} {...rest}>
      {content}
    </button>
  );
}
