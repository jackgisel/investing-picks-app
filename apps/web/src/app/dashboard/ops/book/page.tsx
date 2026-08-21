"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export default function OpsBookPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ops-portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/ops/portfolio");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isLoading) return <p className="text-text-muted text-sm">Loading…</p>;
  if (error || !data) return <p className="text-accent-red text-sm">Ops portfolio unavailable</p>;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="panel-label mb-2">OPS</p>
          <h1 className="page-title">Virtual book</h1>
          <p className="text-sm text-text-muted mt-2">
            Source of truth — no Alpaca. Params {data.params_version}
            {data.params_version === data.run118_hash ? " (= Run 118)" : " (drifted from Run 118)"}
          </p>
        </div>
        <Link href="/dashboard/ops/positions" className="btn-outline">
          Edit positions
        </Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ["Cash", `$${Number(data.cash).toLocaleString()}`],
          ["Invested", `$${Number(data.invested).toLocaleString()}`],
          ["Equity", `$${Number(data.equity).toLocaleString()}`],
          ["Positions", String(data.positions?.length ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="data-card">
            <p className="field-label tracking-[1px]">{label}</p>
            <p className="font-mono text-xl text-text mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="data-panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left field-label tracking-[1px] border-b border-border">
              <th className="p-3">Ticker</th>
              <th className="p-3">Shares</th>
              <th className="p-3">Avg cost</th>
              <th className="p-3">Mark</th>
              <th className="p-3">Value</th>
              <th className="p-3">PnL</th>
              <th className="p-3">HM</th>
            </tr>
          </thead>
          <tbody>
            {(data.positions || []).map(
              (p: {
                ticker: string;
                shares: number;
                avg_cost: number;
                current_price: number;
                market_value: number;
                pnl_pct: number | null;
                is_house_money: boolean;
              }) => (
                <tr key={p.ticker} className="border-b border-border/60">
                  <td className="p-3 font-mono text-text">{p.ticker}</td>
                  <td className="p-3 font-mono text-text-muted">{p.shares.toFixed(2)}</td>
                  <td className="p-3 font-mono text-text-muted">${p.avg_cost.toFixed(2)}</td>
                  <td className="p-3 font-mono text-text-muted">${p.current_price.toFixed(2)}</td>
                  <td className="p-3 font-mono text-text">${p.market_value.toLocaleString()}</td>
                  <td className="p-3 font-mono text-text-muted">
                    {p.pnl_pct != null ? `${p.pnl_pct}%` : "—"}
                  </td>
                  <td className="p-3 font-mono text-text-dim">
                    {p.is_house_money ? "yes" : ""}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
