import { cn } from "@/lib/utils";

/** Horizontal scroller with an edge fade so leftover content is visible. */
export function HScroll({
  children,
  className,
  innerClassName,
  fade = true,
  scrollRef,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  fade?: boolean;
  scrollRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div className={cn(fade && "h-scroll-fade", className)}>
      <div ref={scrollRef} className={cn("h-scroll", innerClassName)}>
        {children}
      </div>
    </div>
  );
}
