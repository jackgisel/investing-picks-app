"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useSiteSearch } from "@/components/search/use-site-search";
import { cn } from "@/lib/utils";

/** Ticker or name lookup that jumps straight to the company page. */
export function CompanySearch({ className }: { className?: string }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { results, loading } = useSiteSearch(q, ["company"]);
  const router = useRouter();
  const listId = useId();
  const open = q.trim().length > 0;

  function go(i: number) {
    const r = results[i];
    if (r) router.push(r.href);
  }

  return (
    <div className={cn("relative max-w-[560px]", className)}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search companies by ticker or name
      </label>
      <Search
        size={18}
        aria-hidden
        className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-text-dim"
      />
      <input
        id={`${listId}-input`}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(active);
          }
        }}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search a ticker or company, e.g. NVDA"
        className="field-input !py-3.5 !pl-12 text-[15px]"
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-border bg-bg shadow-lg"
        >
          {results.length === 0 ? (
            <li className="px-5 py-3 font-sans text-[14px] text-text-muted">
              {loading ? "Searching" : "No company matches that. We cover US listed companies that report headcount."}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.href}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(i);
                }}
                className={cn(
                  "flex cursor-pointer items-baseline gap-3 px-5 py-2.5",
                  i === active && "bg-bg-secondary",
                )}
              >
                <span className="w-16 shrink-0 font-mono text-[13px] font-semibold text-text">
                  {r.ticker}
                </span>
                <span className="truncate font-sans text-[14px] text-text">{r.title}</span>
                <span className="ml-auto hidden shrink-0 font-sans text-[12px] text-text-dim sm:inline">
                  {r.detail}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
