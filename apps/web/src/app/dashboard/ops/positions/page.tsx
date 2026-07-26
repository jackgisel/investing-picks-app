"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { LIVE_PORTFOLIO } from "@/lib/constants";

type OpsPosition = {
  id: number;
  ticker: string;
  shares: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  pnl_pct: number | null;
  entry_date: string | null;
  sector: string | null;
};

type OpsPortfolio = {
  cash: number;
  invested: number;
  equity: number;
  inception_date: string | null;
  positions: OpsPosition[];
};

type QuantityMode = "shares" | "notional";

type PositionForm = {
  ticker: string;
  entryPrice: string;
  entryDate: string;
  quantityMode: QuantityMode;
  quantity: string;
  sector: string;
};

const EMPTY_FORM: PositionForm = {
  ticker: "",
  entryPrice: "",
  entryDate: "",
  quantityMode: "notional",
  quantity: "",
  sector: "",
};

const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 font-mono text-sm text-text " +
  "placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";

const labelClass =
  "block font-sans text-[10px] font-bold tracking-[0.12em] uppercase text-text-dim mb-1.5";

function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Pulls the human-readable message out of a FastAPI/Next error payload. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail ?? body?.error;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

function buildQuantityPayload(form: PositionForm) {
  const qty = Number(form.quantity);
  return form.quantityMode === "shares"
    ? { shares: qty }
    : { notional: qty };
}

export default function OpsPositionsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<PositionForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PositionForm>(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [inception, setInception] = useState<string>("");
  const [inceptionError, setInceptionError] = useState<string | null>(null);
  const [inceptionSaved, setInceptionSaved] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ops-portfolio"],
    queryFn: async () => {
      const res = await fetch("/api/ops/portfolio");
      if (!res.ok) throw new Error(await errorMessage(res));
      return (await res.json()) as OpsPortfolio;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ops-portfolio"] });
    qc.invalidateQueries({ queryKey: ["portfolio-meta"] });
  };

  const addPosition = useMutation({
    mutationFn: async (payload: PositionForm) => {
      const res = await fetch("/api/ops/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: payload.ticker.trim().toUpperCase(),
          entry_price: Number(payload.entryPrice),
          entry_date: payload.entryDate || null,
          sector: payload.sector.trim() || null,
          ...buildQuantityPayload(payload),
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setFormError(null);
      invalidate();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  const editPosition = useMutation({
    mutationFn: async ({ ticker, payload }: { ticker: string; payload: PositionForm }) => {
      const res = await fetch(`/api/ops/positions/${encodeURIComponent(ticker)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry_price: Number(payload.entryPrice),
          entry_date: payload.entryDate || null,
          sector: payload.sector.trim() || null,
          ...buildQuantityPayload(payload),
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      setEditing(null);
      setEditError(null);
      invalidate();
    },
    onError: (e: Error) => setEditError(e.message),
  });

  const deletePosition = useMutation({
    mutationFn: async (ticker: string) => {
      const res = await fetch(`/api/ops/positions/${encodeURIComponent(ticker)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: invalidate,
    onError: (e: Error) => setEditError(e.message),
  });

  const saveInception = useMutation({
    mutationFn: async (iso: string) => {
      const res = await fetch("/api/ops/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inception_date: iso }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json();
    },
    onSuccess: () => {
      setInceptionError(null);
      setInceptionSaved(true);
      setTimeout(() => setInceptionSaved(false), 2500);
      invalidate();
    },
    onError: (e: Error) => setInceptionError(e.message),
  });

  const currentInception =
    inception || data?.inception_date || LIVE_PORTFOLIO.inceptionISO;

  const estimatedCost = useMemo(() => {
    const price = Number(form.entryPrice);
    const qty = Number(form.quantity);
    if (!price || !qty) return null;
    return form.quantityMode === "shares" ? price * qty : qty;
  }, [form]);

  const cash = data?.cash ?? 0;
  const overdraft = estimatedCost != null && estimatedCost > cash;

  function startEdit(p: OpsPosition) {
    setEditing(p.ticker);
    setEditError(null);
    setEditForm({
      ticker: p.ticker,
      entryPrice: String(p.avg_cost ?? ""),
      entryDate: p.entry_date ?? "",
      quantityMode: "shares",
      quantity: String(p.shares ?? ""),
      sector: p.sector ?? "",
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-sans text-[11px] font-bold tracking-[0.14em] uppercase text-text-dim mb-2">
          OPS
        </p>
        <h1 className="page-title">Manual book entry</h1>
        <p className="text-sm text-text-muted mt-2 max-w-xl">
          Seed and correct the virtual book by hand. Adding a position spends cash at the
          entry price; removing one returns its cost basis. Cash can never go negative.
        </p>
      </header>

      {isLoading && <p className="text-text-muted text-sm">Loading book…</p>}
      {error && (
        <p className="text-accent-red text-sm">
          Could not load the book — {(error as Error).message}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Cash", money(data.cash)],
              ["Invested", money(data.invested)],
              ["Equity", money(data.equity)],
              ["Positions", String(data.positions?.length ?? 0)],
            ].map(([label, value]) => (
              <div key={label} className="data-card">
                <p className="font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim">
                  {label}
                </p>
                <p className="font-mono text-xl text-text mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* --- Inception date ------------------------------------------ */}
          <section className="space-y-3">
            <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
              Inception date
            </h2>
            <div className="data-card space-y-3">
              <p className="text-sm text-text-muted">
                Day the live track record starts. Drives the founders-deal countdown and
                every &ldquo;days live&rdquo; figure on the site.
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-48">
                  <label className={labelClass} htmlFor="inception">
                    Date
                  </label>
                  <input
                    id="inception"
                    type="date"
                    className={inputClass}
                    value={currentInception}
                    onChange={(e) => {
                      setInception(e.target.value);
                      setInceptionSaved(false);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={saveInception.isPending || !currentInception}
                  onClick={() => saveInception.mutate(currentInception)}
                >
                  {saveInception.isPending ? "Saving…" : "Save"}
                </button>
                {inceptionSaved && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-accent-green">
                    <Check size={14} /> Saved
                  </span>
                )}
              </div>
              {!data.inception_date && (
                <p className="text-xs text-text-dim">
                  Not set in the database yet — the site is falling back to{" "}
                  <span className="font-mono">{LIVE_PORTFOLIO.inceptionISO}</span>.
                </p>
              )}
              {inceptionError && (
                <p className="text-sm text-accent-red">{inceptionError}</p>
              )}
            </div>
          </section>

          {/* --- Add position -------------------------------------------- */}
          <section className="space-y-3">
            <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
              Add position
            </h2>
            <form
              className="data-card space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                if (!form.ticker.trim()) return setFormError("Ticker is required.");
                if (!(Number(form.entryPrice) > 0))
                  return setFormError("Entry price must be greater than zero.");
                if (!(Number(form.quantity) > 0))
                  return setFormError(
                    form.quantityMode === "shares"
                      ? "Share count must be greater than zero."
                      : "Dollar amount must be greater than zero."
                  );
                addPosition.mutate(form);
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className={labelClass} htmlFor="ticker">
                    Ticker
                  </label>
                  <input
                    id="ticker"
                    className={`${inputClass} uppercase`}
                    placeholder="NVDA"
                    value={form.ticker}
                    onChange={(e) => setForm({ ...form, ticker: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="entryPrice">
                    Entry price
                  </label>
                  <input
                    id="entryPrice"
                    type="number"
                    step="0.0001"
                    min="0"
                    className={inputClass}
                    placeholder="128.40"
                    value={form.entryPrice}
                    onChange={(e) => setForm({ ...form, entryPrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="entryDate">
                    Entry date
                  </label>
                  <input
                    id="entryDate"
                    type="date"
                    className={inputClass}
                    value={form.entryDate}
                    onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="sector">
                    Sector (optional)
                  </label>
                  <input
                    id="sector"
                    className={inputClass}
                    placeholder="Technology"
                    value={form.sector}
                    onChange={(e) => setForm({ ...form, sector: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <span className={labelClass}>Quantity as</span>
                  <div className="inline-flex rounded-pill border border-border overflow-hidden">
                    {(["notional", "shares"] as QuantityMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setForm({ ...form, quantityMode: mode })}
                        className={`px-4 py-2 font-sans text-xs font-semibold uppercase tracking-[0.08em] transition-colors ${
                          form.quantityMode === mode
                            ? "bg-inverse text-inverse-fg"
                            : "bg-bg text-text-muted hover:text-text"
                        }`}
                      >
                        {mode === "notional" ? "Dollars" : "Shares"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="quantity">
                    {form.quantityMode === "shares" ? "Shares" : "Dollar notional"}
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    step="0.0001"
                    min="0"
                    className={inputClass}
                    placeholder={form.quantityMode === "shares" ? "250" : "25000"}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
              </div>

              {estimatedCost != null && (
                <p
                  className={`text-sm font-mono ${
                    overdraft ? "text-accent-red" : "text-text-muted"
                  }`}
                >
                  Cost {money(estimatedCost)} · cash after {money(cash - estimatedCost)}
                  {overdraft && " — exceeds available cash"}
                </p>
              )}

              {formError && <p className="text-sm text-accent-red">{formError}</p>}

              <button
                type="submit"
                className="btn-primary !py-2.5 !px-6 !text-xs"
                disabled={addPosition.isPending || overdraft}
              >
                <Plus size={14} />
                {addPosition.isPending ? "Adding…" : "Add position"}
              </button>
            </form>
          </section>

          {/* --- Existing positions -------------------------------------- */}
          <section className="space-y-3">
            <h2 className="font-sans text-[11px] font-bold tracking-[0.12em] uppercase text-text-dim">
              Positions
            </h2>
            {editError && <p className="text-sm text-accent-red">{editError}</p>}
            <div className="data-panel overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-sans text-[10px] font-bold tracking-[0.1em] uppercase text-text-dim border-b border-border">
                    <th className="p-3">Ticker</th>
                    <th className="p-3">Shares</th>
                    <th className="p-3">Entry price</th>
                    <th className="p-3">Entry date</th>
                    <th className="p-3">Cost basis</th>
                    <th className="p-3">Mark</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.positions || []).map((p) =>
                    editing === p.ticker ? (
                      <tr key={p.ticker} className="border-b border-border/60 bg-bg">
                        <td className="p-3 font-mono text-text">{p.ticker}</td>
                        <td className="p-3">
                          <input
                            aria-label="Shares"
                            type="number"
                            step="0.0001"
                            min="0"
                            className={inputClass}
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                quantity: e.target.value,
                                quantityMode: "shares",
                              })
                            }
                          />
                        </td>
                        <td className="p-3">
                          <input
                            aria-label="Entry price"
                            type="number"
                            step="0.0001"
                            min="0"
                            className={inputClass}
                            value={editForm.entryPrice}
                            onChange={(e) =>
                              setEditForm({ ...editForm, entryPrice: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-3">
                          <input
                            aria-label="Entry date"
                            type="date"
                            className={inputClass}
                            value={editForm.entryDate}
                            onChange={(e) =>
                              setEditForm({ ...editForm, entryDate: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-3 font-mono text-text-muted">
                          {money(
                            Number(editForm.entryPrice) * Number(editForm.quantity) || 0
                          )}
                        </td>
                        <td className="p-3 font-mono text-text-muted">
                          {money(p.current_price)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              aria-label="Save changes"
                              className="p-1.5 rounded-pill text-accent-green hover:bg-accent-green-soft transition-colors"
                              disabled={editPosition.isPending}
                              onClick={() =>
                                editPosition.mutate({
                                  ticker: p.ticker,
                                  payload: editForm,
                                })
                              }
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              aria-label="Cancel"
                              className="p-1.5 rounded-pill text-text-dim hover:text-text transition-colors"
                              onClick={() => {
                                setEditing(null);
                                setEditError(null);
                              }}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr key={p.ticker} className="border-b border-border/60">
                        <td className="p-3 font-mono text-text">{p.ticker}</td>
                        <td className="p-3 font-mono text-text-muted">
                          {p.shares.toFixed(4)}
                        </td>
                        <td className="p-3 font-mono text-text-muted">
                          {money(p.avg_cost)}
                        </td>
                        <td className="p-3 font-mono text-text-muted">
                          {p.entry_date ?? "—"}
                        </td>
                        <td className="p-3 font-mono text-text-muted">
                          {money(p.shares * p.avg_cost)}
                        </td>
                        <td className="p-3 font-mono text-text-muted">
                          {money(p.current_price)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              aria-label={`Edit ${p.ticker}`}
                              className="p-1.5 rounded-pill text-text-dim hover:text-text transition-colors"
                              onClick={() => startEdit(p)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              aria-label={`Delete ${p.ticker}`}
                              className="p-1.5 rounded-pill text-text-dim hover:text-accent-red transition-colors"
                              disabled={deletePosition.isPending}
                              onClick={() => {
                                setEditError(null);
                                const refund = p.shares * p.avg_cost;
                                if (
                                  window.confirm(
                                    `Remove ${p.ticker} and return ${money(refund)} to cash?`
                                  )
                                ) {
                                  deletePosition.mutate(p.ticker);
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                  {(data.positions || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-sm text-text-muted">
                        The book is empty. Add your first position above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
