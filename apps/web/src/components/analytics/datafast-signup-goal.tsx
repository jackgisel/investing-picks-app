"use client";

import { useEffect, useRef } from "react";
import { DATAFAST_SIGNUP_GOAL, trackDatafastGoal } from "@/lib/datafast";

/** Records signup after BetterAuth redirects a brand-new account here. */
export function DatafastSignupGoal({ enabled }: { enabled: boolean }) {
  const sent = useRef(false);

  useEffect(() => {
    if (!enabled || sent.current) return;
    sent.current = true;
    trackDatafastGoal(DATAFAST_SIGNUP_GOAL);
  }, [enabled]);

  return null;
}
