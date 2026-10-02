/** Number formatting for the income visuals. Compact, sign-aware, no dashes. */

export function money(value: number, currency = "USD"): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  if (abs >= 1e12) return `${sign}${symbol}${(abs / 1e12).toFixed(abs >= 1e13 ? 1 : 2)}T`;
  if (abs >= 1e9) return `${sign}${symbol}${(abs / 1e9).toFixed(abs >= 1e11 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${symbol}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${symbol}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

/** `+12%` / `-3%` / `+0%`. Whole percent above 10, one decimal below. */
export function signedPct(ratio: number): string {
  const pct = ratio * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "+";
  return `${sign}${Math.abs(rounded)}%`;
}

export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function signedPp(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "+";
  return `${sign}${Math.abs(rounded)}pp`;
}

const SUFFIXES =
  /,?\s+(inc\.?|incorporated|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|n\.v\.|s\.a\.|ag|se|holdings?|group|class [a-z])$/i;

/** "Micron Technology, Inc." → "Micron Technology". */
export function shortCompanyName(name: string | null, ticker: string): string {
  if (!name) return ticker;
  let out = name.trim();
  for (let i = 0; i < 3; i++) {
    out = out.replace(SUFFIXES, "").replace(/\s*(&|and)$/i, "").replace(/,$/, "").trim();
  }
  return out || ticker;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-28" → "Aug 28 2026". */
export function longDate(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${MONTHS[m - 1]} ${d} ${y}`;
}
