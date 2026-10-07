import Link from "next/link";
import { HScroll } from "@/components/ui/h-scroll";
import type { BoardRow } from "@/lib/challenge/db";
import { cohortLabel, entryPath, formatPct, formatPts } from "@/lib/challenge/rules";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function tone(v: number | null) {
  if (v === null) return "text-text-dim";
  return v >= 0 ? "text-accent-green" : "text-accent-red";
}

/** The public leaderboard. Pending entries sit below every scored one. */
export function BoardTable({ rows, showClass }: { rows: BoardRow[]; showClass: boolean }) {
  const th =
    "py-3 px-3 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-text-dim whitespace-nowrap";
  let rank = 0;
  return (
    <HScroll innerClassName="pr-7">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-border-strong text-left">
            <th className={cn(th, "w-12")}>#</th>
            <th className={th}>Player</th>
            {showClass && <th className={th}>Class</th>}
            <th className={th}>Started</th>
            <th className={cn(th, "text-right")}>Portfolio</th>
            <th className={cn(th, "text-right")}>S&amp;P 500</th>
            <th className={cn(th, "text-right")}>Vs S&amp;P</th>
          </tr>
        </thead>
        <tbody className="font-mono text-[13px]">
          {rows.map((r) => {
            const scored = r.excess !== null;
            if (scored) rank += 1;
            return (
              <tr key={r.id} className="border-b border-border/70 hover:bg-bg-secondary/60">
                <td className="py-3 px-3 text-text-dim">{scored ? rank : "·"}</td>
                <td className="py-3 px-3">
                  <Link
                    href={entryPath(r.id)}
                    className="font-sans text-[14px] font-semibold text-text underline-offset-2 hover:underline"
                  >
                    {r.display_name}
                  </Link>
                  <span className="ml-2 font-sans text-[12px] text-text-dim">{r.picks} stocks</span>
                </td>
                {showClass && (
                  <td className="py-3 px-3 font-sans text-[12px] text-text-muted whitespace-nowrap">
                    {cohortLabel(r.cohort)}
                  </td>
                )}
                <td className="py-3 px-3 font-sans text-[12px] text-text-muted whitespace-nowrap">
                  {r.start_date ? shortDate(r.start_date) : "Next close"}
                </td>
                <td className={cn("py-3 px-3 text-right", tone(r.ret))}>{formatPct(r.ret)}</td>
                <td className="py-3 px-3 text-right text-text-muted">{formatPct(r.spy_ret)}</td>
                <td className={cn("py-3 px-3 text-right font-semibold", tone(r.excess))}>
                  {formatPts(r.excess)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </HScroll>
  );
}
