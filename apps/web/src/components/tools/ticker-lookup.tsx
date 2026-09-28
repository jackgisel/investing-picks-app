"use client";

import { useCallback, useEffect, useState } from "react";
import type { ToolId } from "@/lib/tools/registry";
import type { ToolSnapshotResponse } from "@/lib/tools-db";
import {
  SnapshotNotice,
  toolInputClass,
  ToolFieldLabel,
} from "@/components/tools/tool-shell";

type Props = {
  toolId: ToolId;
  includePrice?: boolean;
  onSnapshot?: (snapshot: ToolSnapshotResponse | null) => void;
  label?: string;
};

export function TickerLookup({
  toolId,
  includePrice,
  onSnapshot,
  label = "Ticker (optional)",
}: Props) {
  const [ticker, setTicker] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [snapshot, setSnapshot] = useState<ToolSnapshotResponse | null>(null);

  const fetchSnapshot = useCallback(
    async (symbol: string) => {
      const t = symbol.trim();
      if (!t) {
        setSnapshot(null);
        onSnapshot?.(null);
        setStatus("idle");
        return;
      }
      setStatus("loading");
      try {
        const q = new URLSearchParams({ ticker: t });
        if (includePrice) q.set("price", "1");
        const res = await fetch(`/api/tools/${toolId}/snapshot?${q}`);
        if (!res.ok) {
          setSnapshot({
            ticker: t.trim().toUpperCase(),
            name: null,
            sector: null,
            industry: null,
            asOf: null,
            fields: {},
            price: null,
            missing: true,
          });
          onSnapshot?.(null);
          setStatus("done");
          return;
        }
        const body = (await res.json()) as ToolSnapshotResponse;
        setSnapshot(body);
        onSnapshot?.(body);
      } catch {
        setSnapshot(null);
        onSnapshot?.(null);
      } finally {
        setStatus("done");
      }
    },
    [toolId, includePrice, onSnapshot],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchSnapshot(ticker);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [ticker, fetchSnapshot]);

  return (
    <div className="mb-6">
      <ToolFieldLabel htmlFor={`${toolId}-ticker`}>{label}</ToolFieldLabel>
      <input
        id={`${toolId}-ticker`}
        className={toolInputClass}
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
        placeholder="MSFT"
        autoComplete="off"
        spellCheck={false}
      />
      {status === "loading" ? (
        <p className="font-sans text-[12px] text-text-dim mt-2">Loading snapshot…</p>
      ) : null}
      {snapshot?.missing && ticker.trim() ? (
        <SnapshotNotice message="We don't have a snapshot for that symbol." />
      ) : null}
      {snapshot && !snapshot.missing && snapshot.asOf ? (
        <p className="font-sans text-[12px] text-text-dim mt-2">
          Snapshot as of {snapshot.asOf}
          {snapshot.name ? ` · ${snapshot.name}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function useSnapshotFields(toolId: ToolId, includePrice?: boolean) {
  const [fields, setFields] = useState<Record<string, number | string | null>>(
    {},
  );
  const [pricePrefill, setPricePrefill] = useState<{
    close: number;
    date: string;
  } | null>(null);
  const [sector, setSector] = useState<string | null>(null);

  const onSnapshot = useCallback((snap: ToolSnapshotResponse | null) => {
    if (!snap) {
      setFields({});
      setPricePrefill(null);
      setSector(null);
      return;
    }
    setFields(snap.fields);
    setPricePrefill(snap.price);
    setSector(snap.sector);
  }, []);

  return {
    fields,
    pricePrefill,
    sector,
    onSnapshot,
    Ticker: (props: Omit<Props, "onSnapshot" | "toolId">) => (
      <TickerLookup
        toolId={toolId}
        includePrice={includePrice}
        onSnapshot={onSnapshot}
        {...props}
      />
    ),
  };
}
