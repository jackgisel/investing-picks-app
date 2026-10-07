"use client";

import { useEffect, useState } from "react";
import type { SearchKind, SearchResult } from "@/lib/site-search";

/** Debounced call to /api/search. `kinds` narrows the results client side. */
export function useSiteSearch(query: string, kinds?: SearchKind[]) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const kindKey = kinds?.join(",") ?? "";

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { results: SearchResult[] };
        const allowed = kindKey ? kindKey.split(",") : null;
        setResults(
          allowed ? data.results.filter((r) => allowed.includes(r.kind)) : data.results,
        );
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 140);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, kindKey]);

  return { results, loading };
}
