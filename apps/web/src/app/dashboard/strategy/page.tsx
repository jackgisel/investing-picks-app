"use client";

import { useStrategy } from "@/lib/hooks/use-strategy";

export default function StrategyPage() {
  const { data, isLoading } = useStrategy();

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="font-sans text-3xl font-bold text-text">Strategy</h1>
        <p className="text-text-muted mt-2 text-sm">
          Live Run 118 parameters from the engine — not marketing copy.
        </p>
      </header>

      {isLoading && <p className="text-text-muted text-sm">Loading…</p>}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="soft-card !p-4">
              <p className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim">NAME</p>
              <p className="text-text mt-1">{data.name || data.strategy?.name}</p>
            </div>
            <div className="soft-card !p-4">
              <p className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim">PARAMS VERSION</p>
              <p className="font-mono text-text mt-1">{data.params_version || "—"}</p>
            </div>
            <div className="soft-card !p-4">
              <p className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim">CADENCE</p>
              <p className="text-text mt-1">
                {data.evaluation_frequency || data.strategy?.evaluation_frequency}
              </p>
            </div>
            <div className="soft-card !p-4">
              <p className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim">POSITIONS</p>
              <p className="text-text mt-1">
                {data.position_count ?? data.portfolio?.position_count} /{" "}
                {data.max_positions ?? data.strategy?.max_positions}
              </p>
            </div>
          </div>

          <section>
            <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim mb-3">
              KEY RULES (RUN 118)
            </h2>
            <ul className="space-y-2 text-sm text-text-muted">
              <li>Exactly 1 buy per biweekly evaluation (no adaptive filler)</li>
              <li>Active recycling: trim QR &lt; 4.0 non–house-money to fund new picks</li>
              <li>House money uncapped; normal positions trim above 15% → 12%</li>
              <li>Winners Circle: ≥60% gain + QR below hold → sell cost basis only</li>
              <li>Underwater stop: 270 days under water + QR &lt; 3.0</li>
              <li>Buy gates: QR ≥ 4.0, Rev ≥ B+, Growth ≥ B</li>
            </ul>
          </section>

          {data.params && (
            <section>
              <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim mb-3">
                LIVE PARAMS JSON
              </h2>
              <pre className="text-xs font-mono text-text-muted overflow-x-auto soft-card !p-4">
                {JSON.stringify(data.params, null, 2)}
              </pre>
            </section>
          )}
        </>
      )}
    </div>
  );
}
