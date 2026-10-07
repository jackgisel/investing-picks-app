"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Lock, Plus, Search, X } from "lucide-react";
import type { EligibleStock } from "@/lib/challenge/db";
import {
  cohortLabel,
  ENTER_PATH,
  MAX_PICKS,
  MIN_PICKS,
  normalizeDisplayName,
} from "@/lib/challenge/rules";
import { formatCompactUsd } from "@/lib/market-cap";
import { cn } from "@/lib/utils";

const DRAFT_KEY = "outpick:challenge-draft:v1";

type Draft = { picks: EligibleStock[]; name: string };

type Me =
  | { signedIn: false }
  | { signedIn: true; name: string | null; cohort: string; current: string | null };

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    return Array.isArray(d.picks) ? { picks: d.picks.slice(0, MAX_PICKS), name: d.name ?? "" } : null;
  } catch {
    return null;
  }
}

function writeDraft(d: Draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode: the draft just does not survive a reload */
  }
}

function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Size buckets by market value, largest first. */
const SIZES = [
  { label: "Mega", min: 200e9 },
  { label: "Large", min: 10e9 },
  { label: "Mid", min: 2e9 },
  { label: "Small", min: 0 },
];

function sizeOf(cap: number | null): string {
  if (cap === null) return "Small";
  return SIZES.find((s) => cap >= s.min)!.label;
}

function useStockSearch(q: string) {
  const [results, setResults] = useState<EligibleStock[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/challenge/stocks?q=${encodeURIComponent(term)}`, {
          signal: ctrl.signal,
        });
        const d = (await r.json()) as { results: EligibleStock[] };
        setResults(d.results ?? []);
      } catch {
        if (!ctrl.signal.aborted) setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);
  return { results, loading };
}

export function ChallengeBuilder() {
  const router = useRouter();
  const [picks, setPicks] = useState<EligibleStock[]>([]);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [me, setMe] = useState<Me | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLock, setConfirmLock] = useState(false);
  const restored = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const { results, loading } = useStockSearch(q);

  // Restore the draft first, then learn who is signed in.
  useEffect(() => {
    const d = readDraft();
    if (d) {
      setPicks(d.picks);
      setName(d.name);
    }
    restored.current = true;
    fetch("/api/challenge/me")
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((m: Me) => {
        setMe(m);
        if (m.signedIn && !d?.name && m.name) setName(m.name.split(" ")[0] ?? "");
      })
      .catch(() => setMe({ signedIn: false }));
  }, []);

  useEffect(() => {
    if (restored.current) writeDraft({ picks, name });
  }, [picks, name]);

  const held = useMemo(() => new Set(picks.map((p) => p.ticker)), [picks]);
  const shown = results.filter((r) => !held.has(r.ticker));
  const full = picks.length >= MAX_PICKS;
  const enough = picks.length >= MIN_PICKS;
  const weight = picks.length ? 100 / picks.length : 0;
  const validName = normalizeDisplayName(name) !== null;

  function add(s: EligibleStock) {
    if (held.has(s.ticker) || full) return;
    setPicks((p) => [...p, s]);
    setQ("");
    setActive(0);
    setError(null);
    inputRef.current?.focus();
  }

  function remove(ticker: string) {
    setPicks((p) => p.filter((x) => x.ticker !== ticker));
    setConfirmLock(false);
  }

  const sectors = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of picks) m.set(p.sector ?? "Other", (m.get(p.sector ?? "Other") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [picks]);

  const sizes = useMemo(() => {
    const m = new Map<string, number>(SIZES.map((s) => [s.label, 0]));
    for (const p of picks) m.set(sizeOf(p.market_cap), (m.get(sizeOf(p.market_cap)) ?? 0) + 1);
    return SIZES.map((s) => ({ label: s.label, n: m.get(s.label) ?? 0 }));
  }, [picks]);

  const topSector = sectors[0];
  const topShare = topSector && picks.length ? topSector[1] / picks.length : 0;

  async function submit() {
    setError(null);
    if (!me?.signedIn) {
      router.push(`/login?next=${encodeURIComponent(ENTER_PATH)}`);
      return;
    }
    if (!confirmLock) {
      setConfirmLock(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/challenge/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: picks.map((p) => p.ticker), displayName: name }),
      });
      const data = await res.json();
      if (res.status === 201) {
        clearDraft();
        router.push(`${data.href}?new=1`);
        return;
      }
      if (res.status === 409 && data.existing) {
        setMe((m) => (m && m.signedIn ? { ...m, current: data.existing } : m));
      }
      setError(data.error ?? "Something went wrong. Try again.");
      setConfirmLock(false);
    } catch {
      setError("Could not reach the server. Your picks are saved on this device.");
    } finally {
      setSubmitting(false);
    }
  }

  const alreadyIn = me?.signedIn && me.current;

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        {alreadyIn && (
          <div className="mb-6 rounded-soft border border-border-strong bg-bg-secondary p-5">
            <p className="font-sans text-[15px] font-semibold text-text">
              You already entered the {cohortLabel(me.cohort)} class.
            </p>
            <p className="mt-1 font-sans text-[14px] text-text-muted">
              One entry per quarter. You can keep building here and lock it in when the next class opens.
            </p>
            <Link href={me.current!} className="btn-outline mt-4">
              See your entry
            </Link>
          </div>
        )}

        <div className="relative">
          <label htmlFor={`${listId}-q`} className="sr-only">
            Add a stock by ticker or company name
          </label>
          <Search
            size={18}
            aria-hidden
            className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-text-dim"
          />
          <input
            ref={inputRef}
            id={`${listId}-q`}
            value={q}
            disabled={full}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, shown.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (shown[active]) add(shown[active]);
              } else if (e.key === "Escape") {
                setQ("");
              }
            }}
            role="combobox"
            aria-expanded={q.trim().length > 0}
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={full ? `That is the ${MAX_PICKS} stock limit` : "Add a stock: type a ticker or name"}
            className="field-input !py-4 !pl-12 text-[16px]"
          />
          {q.trim() && (
            <ul
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[360px] overflow-y-auto rounded-xl border border-border bg-bg shadow-lg"
            >
              {shown.length === 0 ? (
                <li className="px-5 py-3 font-sans text-[14px] text-text-muted">
                  {loading
                    ? "Searching"
                    : "No match in the challenge universe. Only US listed companies above $300M count, and no ETFs."}
                </li>
              ) : (
                shown.map((r, i) => (
                  <li
                    key={r.ticker}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      add(r);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-5 py-2.5",
                      i === active && "bg-bg-secondary",
                    )}
                  >
                    <span className="w-16 shrink-0 font-mono text-[13px] font-semibold text-text">{r.ticker}</span>
                    <span className="min-w-0 truncate font-sans text-[14px] text-text">{r.name}</span>
                    <span className="ml-auto hidden shrink-0 font-mono text-[12px] text-text-dim sm:inline">
                      {formatCompactUsd(r.market_cap)}
                    </span>
                    <Plus size={16} aria-hidden className="shrink-0 text-text-dim" />
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim">
              Your picks
            </h2>
            <span className="font-mono text-[13px] text-text-muted">
              {picks.length} / {enough ? MAX_PICKS : MIN_PICKS}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-bg-tertiary" aria-hidden>
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-300 ease-out-strong",
                enough ? "bg-accent-mint" : "bg-accent-yellow",
              )}
              style={{ width: `${Math.min(100, (picks.length / MIN_PICKS) * 100)}%` }}
            />
          </div>

          {picks.length === 0 ? (
            <div className="mt-5 rounded-soft border border-dashed border-border-light px-6 py-10 text-center">
              <p className="font-sans text-[16px] font-semibold text-text">Start with a company you know well.</p>
              <p className="mx-auto mt-1 max-w-[420px] font-sans text-[14px] text-text-muted">
                You need {MIN_PICKS}. Your list is saved on this device as you go, so you can
                come back to it.
              </p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
              {picks.map((p) => (
                <li key={p.ticker} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-16 shrink-0 font-mono text-[13px] font-semibold text-text">{p.ticker}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-[14px] text-text">{p.name}</span>
                    <span className="block truncate font-sans text-[12px] text-text-dim">
                      {p.sector ?? "No sector"} · {formatCompactUsd(p.market_cap)}
                    </span>
                  </span>
                  <span className="hidden font-mono text-[12px] text-text-muted sm:inline">
                    {weight.toFixed(1)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(p.ticker)}
                    aria-label={`Remove ${p.ticker}`}
                    className="press inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-dim hover:bg-bg-secondary hover:text-text"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+24px)] lg:self-start">
        <div className="data-card space-y-6">
          <div>
            <h2 className="font-sans text-[13px] font-bold uppercase tracking-[0.12em] text-text-dim">
              Portfolio breakdown
            </h2>
            <p className="mt-1 font-sans text-[13px] text-text-muted">
              {picks.length
                ? `Each stock starts at ${weight.toFixed(1)}% of the portfolio.`
                : "Add stocks to see how the portfolio is spread."}
            </p>
          </div>

          {picks.length > 0 && (
            <>
              <div>
                <p className="mb-2 font-sans text-[12px] font-semibold text-text">By sector</p>
                <ul className="space-y-1.5">
                  {sectors.map(([s, n]) => (
                    <li key={s} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                      <span className="truncate font-sans text-[12px] text-text-muted">{s}</span>
                      <span className="font-mono text-[12px] text-text">{Math.round((n / picks.length) * 100)}%</span>
                      <span className="col-span-2 h-1 overflow-hidden rounded-full bg-bg-tertiary">
                        <span
                          className="block h-full rounded-full bg-accent-lilac"
                          style={{ width: `${(n / picks.length) * 100}%` }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
                {topShare >= 0.4 && picks.length >= 5 && (
                  <p className="mt-3 font-sans text-[12px] leading-relaxed text-text-muted">
                    {Math.round(topShare * 100)}% of the portfolio is in {topSector![0]}. If that sector
                    has a bad decade, so does this entry.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-2 font-sans text-[12px] font-semibold text-text">By company size</p>
                <div className="grid grid-cols-4 gap-2">
                  {sizes.map((s) => (
                    <div key={s.label} className="rounded-lg bg-bg-tertiary/70 px-2 py-2 text-center">
                      <p className="font-mono text-[15px] font-semibold text-text">{s.n}</p>
                      <p className="font-sans text-[11px] text-text-dim">{s.label}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 font-sans text-[11px] text-text-dim">
                  Mega $200B+, large $10B+, mid $2B+.
                </p>
              </div>
            </>
          )}

          <div className="border-t border-border pt-5">
            <label htmlFor={`${listId}-name`} className="font-sans text-[12px] font-semibold text-text">
              Name on the leaderboard
            </label>
            <input
              id={`${listId}-name`}
              value={name}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Patient Capital"
              className="field-input mt-2"
            />
            <p className="mt-1.5 font-sans text-[11px] text-text-dim">
              Public. 2 to 30 letters, numbers or spaces.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-accent-red-soft px-3 py-2 font-sans text-[13px] text-text">
              {error}
            </p>
          )}

          {confirmLock && me?.signedIn && (
            <p className="rounded-lg bg-bg-tertiary px-3 py-2 font-sans text-[13px] leading-relaxed text-text">
              Once locked, these {picks.length} stocks cannot be changed for ten years. Press again to
              lock them in.
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={!enough || !validName || submitting || Boolean(alreadyIn)}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <Lock size={14} aria-hidden />
            {submitting
              ? "Locking in"
              : !enough
                ? `Add ${MIN_PICKS - picks.length} more`
                : !validName
                  ? "Add a name"
                  : me && !me.signedIn
                    ? "Sign in to lock it in"
                    : confirmLock
                      ? "Yes, lock it in"
                      : "Lock in my picks"}
          </button>
          {me && !me.signedIn && enough && (
            <p className="font-sans text-[12px] leading-relaxed text-text-dim">
              Free account, no password. We email you a sign-in link and bring you
              straight back here with your picks.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
