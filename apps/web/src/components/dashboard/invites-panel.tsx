"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";

type MembershipInvite = {
  email: string;
  name: string | null;
  note: string | null;
  createdAt: string;
  sentAt: string | null;
  invitedBy: string | null;
};

const inputClass =
  "w-full bg-bg border border-border rounded-xl px-3 py-2 font-sans text-sm text-text " +
  "placeholder:text-text-dim focus:outline-none focus:border-border-strong transition-colors";
const labelClass = "block field-label mb-1.5";

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const detail = body?.detail ?? body?.error;
    if (typeof detail === "string") return detail;
  } catch {
    /* fall through */
  }
  return `Request failed (${res.status})`;
}

export function InvitesPanel() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const list = useQuery({
    queryKey: ["ops-membership-invites"],
    queryFn: async () => {
      const res = await fetch("/api/ops/invites", { cache: "no-store" });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ invites: MembershipInvite[] }>;
    },
    staleTime: 0,
    gcTime: 0,
  });

  const send = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ops/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      return res.json() as Promise<{ invite: MembershipInvite }>;
    },
    onSuccess: () => {
      setEmail("");
      setName("");
      qc.invalidateQueries({ queryKey: ["ops-membership-invites"] });
    },
  });

  const invites = list.data?.invites ?? [];

  return (
    <div className="space-y-6">
      <header>
        <p className="panel-label mb-2">Invites</p>
        <p className="text-text-muted mt-2 text-sm max-w-xl">
          Complimentary membership for a specific address. Checkout applies a
          100% coupon when they sign in with that email — no card, no promo
          code to leak.
        </p>
      </header>

      <form
        className="data-card space-y-4 max-w-xl"
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <div>
          <label htmlFor="invite-email" className={labelClass}>
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="member@example.com"
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="invite-name" className={labelClass}>
            Name <span className="normal-case font-normal text-text-dim">(optional)</span>
          </label>
          <input
            id="invite-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="First name"
            autoComplete="off"
          />
        </div>
        {send.isError && (
          <p className="font-sans text-[13px] text-accent-red">
            {send.error instanceof Error ? send.error.message : "Send failed"}
          </p>
        )}
        {send.isSuccess && (
          <p className="font-sans text-[13px] text-text-muted">
            Invite sent to {send.data.invite.email}.
          </p>
        )}
        <button
          type="submit"
          disabled={send.isPending || !email.trim()}
          className="btn-primary disabled:opacity-60"
        >
          <Send size={14} strokeWidth={2} aria-hidden="true" />
          {send.isPending ? "Sending…" : "Send complimentary invite"}
        </button>
      </form>

      <section className="space-y-3">
        {list.isLoading && (
          <p className="font-sans text-sm text-text-dim">Loading invites…</p>
        )}
        {list.isError && (
          <p className="font-sans text-sm text-accent-red">
            {list.error instanceof Error ? list.error.message : "Could not load invites"}
          </p>
        )}
        {invites.length === 0 && !list.isLoading ? (
          <p className="font-sans text-sm text-text-dim">No complimentary invites yet.</p>
        ) : (
          <ul className="space-y-2">
            {invites.map((invite) => (
              <li key={invite.email} className="data-card">
                <p className="font-sans text-sm text-text">
                  {invite.name ? `${invite.name} · ` : ""}
                  {invite.email}
                </p>
                <p className="mt-1 font-sans text-[12px] text-text-dim">
                  {invite.sentAt
                    ? `Sent ${new Date(invite.sentAt).toLocaleString("en-US")}`
                    : "Not sent yet — will go out on the next web boot"}
                  {invite.note ? ` · ${invite.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
