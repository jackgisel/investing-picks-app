import type { PeriodType } from "./model";

/** Path of the square income-statement PNG. `v` busts the browser cache after a refresh. */
export function incomeVisualUrl(
  ticker: string,
  periodType: PeriodType = "quarter",
  v?: string | number,
): string {
  const params = new URLSearchParams();
  if (periodType === "annual") params.set("period_type", "annual");
  if (v !== undefined) params.set("v", String(v));
  const qs = params.toString();
  return `/api/visuals/income/${encodeURIComponent(ticker)}${qs ? `?${qs}` : ""}`;
}
