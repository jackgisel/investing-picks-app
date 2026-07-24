/** Upstream Outpick API (virtual portfolio engine). */
export const OUTPICK_API_URL =
  process.env.OUTPICK_API_URL ||
  process.env.ETF_API_URL ||
  "http://localhost:8000";

export const PUBLIC_API_BASE = `${OUTPICK_API_URL.replace(/\/$/, "")}/api/v1`;
export const OPS_API_BASE = `${OUTPICK_API_URL.replace(/\/$/, "")}/api/ops`;
