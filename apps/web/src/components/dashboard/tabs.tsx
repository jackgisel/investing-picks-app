"use client";

import { useRef } from "react";
import { HScroll } from "@/components/ui/h-scroll";

export interface TabDef<T extends string> {
  id: T;
  label: string;
  /** Rendered after the label, e.g. a row count. */
  badge?: string;
}

/**
 * Tab strip following the WAI-ARIA tabs pattern: one tab stop for the whole
 * set, arrow keys move between tabs, Home/End jump to the ends.
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly TabDef<T>[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function onKeyDown(e: React.KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === value);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const id = tabs[next].id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div className="border-b border-border">
      <HScroll innerClassName="flex items-center gap-1">
        <div
          role="tablist"
          aria-label={label}
          onKeyDown={onKeyDown}
          className="flex min-w-max items-center gap-1"
        >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              role="tab"
              type="button"
              id={`tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 font-sans text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                selected
                  ? "border-accent-mint text-text"
                  : "border-transparent text-text-dim hover:text-text-muted"
              }`}
            >
              {tab.label}
              {tab.badge && (
                <span className="font-mono text-[10px] tabular-nums text-text-dim">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      </HScroll>
    </div>
  );
}

export function TabPanel<T extends string>({
  id,
  children,
}: {
  id: T;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      tabIndex={0}
      className="focus-visible:outline-none"
    >
      {children}
    </div>
  );
}
