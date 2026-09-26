import { useQuery } from "@tanstack/react-query";
import { dataQueryOptions, fetchJson } from "./api-error";

/** One calendar month, picks vs S&P 500, each rebuilt as its own window. */
export interface MonthReturn {
  /** `YYYY-MM`. */
  month: string;
  picks_pct: number | null;
  spy_pct: number | null;
  /** First month (from the first pick) or the month in progress. */
  partial: boolean;
}

/** One pick beside the S&P 500 over the same holding period. */
export interface ScorecardPick {
  ticker: string;
  status: "active" | "closed";
  entry_date: string | null;
  exit_date: string | null;
  return_pct: number | null;
  spy_pct: number | null;
  /** return_pct - spy_pct, in points. Null when either side is unknown. */
  excess_pct: number | null;
}

export interface TrackRecordResponse {
  as_of: string;
  months: MonthReturn[];
  picks: ScorecardPick[];
}

export function useTrackRecord() {
  return useQuery<TrackRecordResponse>({
    queryKey: ["track-record"],
    queryFn: () => fetchJson<TrackRecordResponse>("/api/data/track-record"),
    ...dataQueryOptions,
  });
}
