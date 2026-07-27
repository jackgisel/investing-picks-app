"use client";

import { ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export interface Column<K extends string> {
  label: string;
  /** Omit to make the column unsortable. */
  sortKey?: K;
  /**
   * Small second line under the label, for provenance that belongs to the
   * whole column rather than to each cell — the date a rating was struck, say.
   * Kept outside the sort button so it is never mistaken for a control.
   */
  note?: string;
}

/**
 * The dashboard's table header.
 *
 * Every table hand-rolled this, and each copy put onClick on a bare <th> —
 * not focusable, no role, no aria-sort, so sorting was mouse-only and screen
 * readers could not tell the table was sorted at all. The button carries the
 * interaction; the th carries aria-sort.
 */
export function SortableHead<K extends string>({
  columns,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: readonly Column<K>[];
  sortKey: K;
  sortDir: SortDir;
  onSort: (key: K) => void;
}) {
  return (
    <thead>
      <tr>
        {columns.map((col) => {
          const isSorted = col.sortKey !== undefined && col.sortKey === sortKey;
          return (
            <th
              key={col.label}
              scope="col"
              aria-sort={
                isSorted
                  ? sortDir === "asc"
                    ? "ascending"
                    : "descending"
                  : col.sortKey
                    ? "none"
                    : undefined
              }
              className="border-b border-border bg-bg px-5 py-3 text-left font-mono text-[10px] font-medium tracking-[1.5px] text-text-dim"
            >
              <span className="flex flex-col gap-0.5">
                {col.sortKey ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.sortKey as K)}
                    className="flex items-center gap-1 uppercase transition-colors hover:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    {col.label}
                    {isSorted && (
                      <ArrowUpDown size={10} className="text-accent-green" />
                    )}
                  </button>
                ) : (
                  <span className="flex items-center gap-1">{col.label}</span>
                )}
                {col.note && (
                  <span className="font-mono text-[9px] font-normal normal-case tracking-normal text-text-dim">
                    {col.note}
                  </span>
                )}
              </span>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** The header strip at the top of a data-panel. Was copy-pasted seven times. */
export function PanelHeader({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "yellow" | "peach" | "lilac" | "mint" | "coral";
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
      <span className={`panel-label${tone ? ` panel-label-${tone}` : ""}`}>
        {label}
      </span>
      {children}
    </div>
  );
}

/** "no rows matched the filter" — distinct from "the query returned nothing". */
export function FilteredOutRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-8 text-center">
        <span className="font-mono text-[11px] text-text-dim">
          NOTHING MATCHES THESE FILTERS
        </span>
      </td>
    </tr>
  );
}

/** Filter chip row — picks and trades each had their own copy. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          aria-pressed={value === opt}
          className={`rounded-pill px-3.5 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
            value === opt
              ? "bg-inverse text-inverse-fg"
              : "border border-border bg-bg text-text-dim hover:text-text"
          }`}
        >
          {opt.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
