"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowRight, Search, X } from "lucide-react";
import { useSiteSearch } from "@/components/search/use-site-search";
import type { SearchKind, SearchResult } from "@/lib/site-search";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<SearchKind, string> = {
  company: "Companies",
  article: "Articles",
  topic: "Blog topics",
  tool: "Tools",
  page: "Pages",
};

/** Shown before anything is typed: the free things most people come for. */
const QUICK: SearchResult[] = [
  { kind: "tool", title: "Beat the S&P 500", href: "/tools/beat-the-sp-500", detail: "Free ten year stock picking game" },
  { kind: "page", title: "Company directory", href: "/companies", detail: "Headcount and revenue per employee" },
  { kind: "tool", title: "Intrinsic value calculator", href: "/tools/intrinsic-value-calculator", detail: null },
  { kind: "page", title: "Blog", href: "/blog", detail: "Every article, sorted by topic" },
  { kind: "page", title: "Track record", href: "/track-record", detail: "Every trade in the live book" },
];

export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { results, loading } = useSiteSearch(q);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const typed = q.trim().length > 0;
  // Results arrive best first. Groups keep that order: the group holding the
  // best match leads, so an exact topic is not buried under loose articles.
  const kinds = [...new Set(results.map((r) => r.kind))];
  const grouped = typed ? kinds.flatMap((k) => results.filter((r) => r.kind === k)) : QUICK;

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => setActive(0), [q]);

  if (!open || typeof document === "undefined") return null;

  function go(r: SearchResult | undefined) {
    if (!r) return;
    onClose();
    router.push(r.href);
  }

  let lastKind: SearchKind | null = null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Outpick"
        className="w-full max-w-[640px] overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-border px-5">
          <Search size={18} aria-hidden className="shrink-0 text-text-dim" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, grouped.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(grouped[active]);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={grouped[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search companies, articles and tools"
            className="h-14 min-w-0 flex-1 bg-transparent font-sans text-[16px] text-text placeholder:text-text-dim focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="press -mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-dim hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        <ul id={listId} role="listbox" className="max-h-[56vh] overflow-y-auto py-2">
          {!typed && (
            <li role="presentation" className="px-5 pb-1 pt-2 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
              Popular
            </li>
          )}
          {typed && grouped.length === 0 && (
            <li className="px-5 py-6 font-sans text-[14px] text-text-muted">
              {loading ? "Searching" : `Nothing matches "${q.trim()}". Try a ticker, a company or a topic like valuation.`}
            </li>
          )}
          {grouped.map((r, i) => {
            const header = typed && r.kind !== lastKind;
            lastKind = r.kind;
            return (
              <li key={`${r.kind}:${r.href}`} role="presentation">
                {header && (
                  <p className="px-5 pb-1 pt-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim">
                    {KIND_LABEL[r.kind]}
                  </p>
                )}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(r);
                  }}
                  className={cn(
                    "mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                    i === active && "bg-bg-secondary",
                  )}
                >
                  {r.ticker && (
                    <span className="w-14 shrink-0 font-mono text-[13px] font-semibold text-text">
                      {r.ticker}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[14px] font-semibold text-text">{r.title}</span>
                    {r.detail && (
                      <span className="block truncate font-sans text-[12px] text-text-dim">{r.detail}</span>
                    )}
                  </span>
                  <ArrowRight
                    size={14}
                    aria-hidden
                    className={cn("shrink-0 text-text-dim", i === active ? "opacity-100" : "opacity-0")}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <div className="hidden items-center gap-4 border-t border-border px-5 py-2.5 font-sans text-[11px] text-text-dim sm:flex">
          <span><kbd className="font-mono">↑↓</kbd> to move</span>
          <span><kbd className="font-mono">Enter</kbd> to open</span>
          <span><kbd className="font-mono">Esc</kbd> to close</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
