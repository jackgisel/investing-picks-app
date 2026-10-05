"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CommunicationDesk } from "@/components/dashboard/communication-desk";
import { EditorialPanel } from "@/components/dashboard/editorial-panel";
import { FridayPickStatusPanel } from "@/components/dashboard/friday-pick-status-panel";
import { IncomeVisualsPanel } from "@/components/dashboard/income-visuals-panel";
import { InvitesPanel } from "@/components/dashboard/invites-panel";
import { ProductUpdatesPanel } from "@/components/dashboard/product-updates-panel";
import { SundayMarketPreviewPanel } from "@/components/dashboard/sunday-market-preview-panel";
import { XThreadsPanel } from "@/components/dashboard/x-threads-panel";
import {
  communicationPiece,
  parseCommunicationPiece,
  type CommunicationPieceId,
} from "@/lib/communication";

export function CommunicationPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const piece = parseCommunicationPiece(
    searchParams.get("piece"),
    searchParams.get("tab"),
  );

  function open(next: CommunicationPieceId | null) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");
    if (next) params.set("piece", next);
    else params.delete("piece");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  if (!piece) return <CommunicationDesk onOpen={open} />;

  const meta = communicationPiece(piece);
  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={() => open(null)}
          className="font-sans text-[13px] text-text-dim underline-offset-2 hover:text-text hover:underline"
        >
          This week
        </button>
        <h1 className="page-title mt-2">{meta.label}</h1>
        <p className="mt-1 max-w-[640px] font-sans text-[13px] leading-relaxed text-text-dim">
          {meta.audience} · {meta.when}. {meta.ifYouDont}
        </p>
      </div>
      {piece === "monday-market-note" && <SundayMarketPreviewPanel />}
      {piece === "market-analysis" && <EditorialPanel kind="market_analysis" />}
      {piece === "pick-spotlight" && <EditorialPanel kind="pick_spotlight" />}
      {piece === "friday-stock-pick" && <FridayPickStatusPanel />}
      {piece === "x" && (
        <div className="space-y-8">
          <XThreadsPanel />
          <IncomeVisualsPanel />
        </div>
      )}
      {piece === "product-updates" && <ProductUpdatesPanel />}
      {piece === "invites" && <InvitesPanel />}
    </div>
  );
}
