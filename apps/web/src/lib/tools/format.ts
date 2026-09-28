/** Display helpers for tool panels. */

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function formatPercentFromRatio(
  ratio: number | null | undefined,
  digits = 2,
): string {
  if (ratio == null || !Number.isFinite(ratio)) return "";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatPercentTyped(
  pct: number | null | undefined,
  digits = 2,
): string {
  if (pct == null || !Number.isFinite(pct)) return "";
  return `${pct.toFixed(digits)}%`;
}

export function ratioToMarginPercent(
  ratio: number | null | undefined,
): number | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  return ratio * 100;
}

export function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
