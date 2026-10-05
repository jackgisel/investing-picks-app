"use client";

import { useQuery } from "@tanstack/react-query";
import type { CommunicationPieceId } from "@/lib/communication";
import type { DeskCard, DeskModel, DeskStatus } from "@/lib/communication-desk";

const STATUS: Record<DeskStatus, string> = {
  needs_you: "Needs you",
  confirmed: "Confirmed",
  sent: "Sent",
  posted: "Posted",
  failed: "Failed",
  skipped: "Skipped",
  scheduled: "Scheduled",
};

function statusClass(status: DeskStatus): string {
  if (status === "needs_you" || status === "failed") return "text-accent-red";
  if (status === "confirmed" || status === "sent" || status === "posted") return "text-accent-green";
  return "text-text-dim";
}

async function loadDesk(): Promise<DeskModel> {
  const res = await fetch("/api/ops/communication/desk", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Could not load the week (${res.status})`);
  }
  return res.json();
}

export function CommunicationDesk({
  onOpen,
}: {
  onOpen: (piece: CommunicationPieceId) => void;
}) {
  const desk = useQuery({ queryKey: ["ops-communication-desk"], queryFn: loadDesk });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Communication</h1>
        <p className="mt-1 max-w-[640px] font-sans text-[13px] leading-relaxed text-text-dim">
          {desk.data ? desk.data.weekLabel : "This week"}, Pacific time. Confirm a
          letter before it sends. Reject an X graphic to stop it.
        </p>
      </header>

      {desk.isError && (
        <p className="text-sm text-accent-red">{(desk.error as Error).message}</p>
      )}

      {desk.data && desk.data.needsYou.length > 0 && (
        <section className="space-y-2">
          <h2 className="panel-label">Needs you</h2>
          <ul className="space-y-2">
            {desk.data.needsYou.map((card) => (
              <li key={card.id}>
                <DeskRow card={card} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {desk.data?.days.map((day) => (
        <section key={day.day} className="space-y-2">
          <h2 className="panel-label">{day.label}</h2>
          <ul className="space-y-2">
            {day.cards.map((card) => (
              <li key={card.id}>
                <DeskRow card={card} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {desk.data?.comingUp && (
        <p className="font-sans text-sm text-text-muted">
          Coming up: {desk.data.comingUp.label}, {desk.data.comingUp.timeLabel}.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => onOpen(desk.data!.comingUp!.piece)}
          >
            Open
          </button>
        </p>
      )}

      <details className="data-card">
        <summary className="cursor-pointer font-sans text-sm text-text-muted">
          Not on the calendar
        </summary>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" className="btn-outline !py-2 !px-4 !text-[11px]" onClick={() => onOpen("product-updates")}>
            Product updates
          </button>
          <button type="button" className="btn-outline !py-2 !px-4 !text-[11px]" onClick={() => onOpen("invites")}>
            Invites
          </button>
        </div>
      </details>
    </div>
  );
}

function DeskRow({
  card,
  onOpen,
}: {
  card: DeskCard;
  onOpen: (piece: CommunicationPieceId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(card.piece)}
      className="data-card flex w-full flex-wrap items-baseline justify-between gap-3 text-left"
    >
      <span className="font-sans text-sm text-text">
        {card.label}
        <span className="ml-2 font-mono text-[11px] text-text-dim">{card.audience}</span>
      </span>
      <span className="font-mono text-[11px] text-text-muted">
        {card.timeLabel}
        <span className={`ml-3 ${statusClass(card.status)}`}>
          {STATUS[card.status]}
          {card.detail && card.detail !== STATUS[card.status] ? ` · ${card.detail}` : ""}
        </span>
      </span>
    </button>
  );
}
