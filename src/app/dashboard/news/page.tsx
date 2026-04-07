"use client";

import { Newspaper } from "lucide-react";

export default function NewsPage() {
  return (
    <div className="max-w-[1100px] space-y-6">
      <div>
        <h1 className="font-sans text-xl font-bold">News</h1>
        <p className="font-sans text-[13px] text-text-dim mt-1">
          Market updates and portfolio commentary
        </p>
      </div>

      <div className="bg-bg-secondary border border-border p-12 text-center">
        <Newspaper size={32} className="text-text-dim mx-auto mb-4" />
        <h2 className="font-sans text-lg font-semibold mb-2">Coming Soon</h2>
        <p className="font-sans text-[14px] text-text-muted max-w-md mx-auto">
          Market commentary, portfolio updates, and strategy insights will appear
          here. Check back after the first evaluation cycle.
        </p>
        <div className="mt-6 inline-block">
          <span className="font-mono text-[10px] text-accent-green tracking-[2px] bg-accent-green-soft px-4 py-2">
            EVALUATIONS RUN BIWEEKLY
          </span>
        </div>
      </div>
    </div>
  );
}
