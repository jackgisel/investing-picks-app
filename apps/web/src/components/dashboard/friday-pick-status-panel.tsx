"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

type Payload = {
  next: string;
  last: { ticker: string; sentAt: string } | null;
};

export function FridayPickStatusPanel() {
  const page = useQuery({
    queryKey: ["ops-friday-pick"],
    queryFn: async () => {
      const res = await fetch("/api/ops/communication/friday-pick", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load the Friday pick");
      return res.json() as Promise<Payload>;
    },
  });

  return (
    <div className="data-card space-y-3">
      <p className="font-sans text-sm text-text-muted">
        Paid subscribers are mailed when the research note for the evaluation
        Friday is approved. The note itself is written on Research notes.
      </p>
      {page.data && (
        <>
          <p className="font-mono text-sm text-text">Next evaluation Friday: {page.data.next}</p>
          <p className="font-mono text-sm text-text-muted">
            {page.data.last
              ? `Last mailed: ${page.data.last.ticker} on ${page.data.last.sentAt.slice(0, 10)}`
              : "Nothing has been mailed yet."}
          </p>
        </>
      )}
      <Link href="/dashboard/ops/insights" className="font-sans text-sm text-text underline underline-offset-2">
        Open research notes
      </Link>
    </div>
  );
}
