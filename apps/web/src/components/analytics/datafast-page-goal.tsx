"use client";

import { useEffect, useRef } from "react";
import { trackDatafastGoal } from "@/lib/datafast";

/** Fire a DataFast goal once when the page mounts. */
export function DatafastPageGoal({ goal }: { goal: string }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackDatafastGoal(goal);
  }, [goal]);

  return null;
}
