"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar } from "@/components/comments/avatar";
import { MAX_DISPLAY_NAME } from "@/lib/profile";

/**
 * The public name, set separately from the account name.
 *
 * These are two different things and the form says so: the account name is on
 * receipts and is usually a real name, while this one appears under every
 * comment on a public page. Defaulting one from the other would publish an
 * identity nobody chose to publish.
 */
export function DisplayNameForm({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load your profile");
      return (await res.json()) as { display_name: string | null };
    },
  });

  const save = useMutation({
    mutationFn: async (displayName: string) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Could not save");
      return body as { display_name: string };
    },
    onSuccess: (body) => {
      setError(null);
      setSaved(true);
      setValue(body.display_name);
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => {
      setSaved(false);
      setError(e.message);
    },
  });

  // Null means "not edited yet" — falling back to the fetched value only until
  // the user types keeps the field from resetting under them mid-edit.
  const current = value ?? profile.data?.display_name ?? "";
  const preview = current.trim();

  return (
    <form
      id="profile"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(current.trim());
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <Avatar userId={userId} displayName={preview || "?"} />
        <div>
          <p className="font-sans text-[13px] font-semibold text-text">
            {preview || "No display name set"}
          </p>
          <p className="font-sans text-[12px] text-text-dim">
            Your avatar is generated from these initials.
          </p>
        </div>
      </div>

      <div>
        <label
          htmlFor="display-name"
          className="field-label block mb-1.5"
        >
          Display name
        </label>
        <input
          id="display-name"
          value={current}
          maxLength={MAX_DISPLAY_NAME}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="How you appear in discussions"
          className="w-full rounded-soft border border-border bg-bg-secondary px-3.5 py-2.5 font-sans text-[14px] text-text placeholder:text-text-dim focus:border-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-text focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
        <p className="mt-1.5 font-sans text-[12px] text-text-dim">
          Shown publicly on every comment you post. This is not your account
          name and is never used on receipts.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={save.isPending || !current.trim()}
          className="btn-primary !py-2 !px-5 !text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {save.isPending ? "Saving…" : "Save display name"}
        </button>
        {error && (
          <p className="font-sans text-[12px] text-accent-red">{error}</p>
        )}
        {saved && !error && (
          <p className="font-sans text-[12px] text-accent-green">Saved.</p>
        )}
      </div>
    </form>
  );
}
