"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ENTER_PATH } from "@/lib/challenge/rules";

type Me =
  | { signedIn: false }
  | { signedIn: true; current: string | null };

/**
 * The hub's main button. The page itself is cached for everyone, so whether
 * this visitor already entered this quarter is asked for after load.
 */
export function EntryCta({ className }: { className?: string }) {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/challenge/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d && setMe(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (me?.signedIn && me.current) {
    return (
      <div className={className}>
        <Link href={me.current} className="btn-primary">
          See your entry
        </Link>
        <p className="mt-3 font-sans text-[13px] text-text-muted">
          You are in for this quarter. A new class opens next quarter.
        </p>
      </div>
    );
  }
  return (
    <div className={className}>
      <Link href={ENTER_PATH} className="btn-primary">
        Build your portfolio
      </Link>
    </div>
  );
}
