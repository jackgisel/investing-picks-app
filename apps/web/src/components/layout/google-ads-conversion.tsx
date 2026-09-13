"use client";

import { useEffect } from "react";
import {
  googleAdsConversionParams,
  googleAdsConversionStorageKey,
  type GoogleAdsConversionEvent,
} from "@/lib/google-ads";

const firedTransactionIds = new Set<string>();

function alreadyRecorded(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function recordFired(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // Private mode can block storage; Google Ads still dedupes on transaction_id.
  }
}

export function GoogleAdsConversion(event: GoogleAdsConversionEvent) {
  const { sendTo, value, currency, transactionId } = event;

  useEffect(() => {
    if (!transactionId || firedTransactionIds.has(transactionId)) return;
    const storageKey = googleAdsConversionStorageKey(transactionId);
    if (alreadyRecorded(storageKey)) {
      firedTransactionIds.add(transactionId);
      return;
    }

    const params = googleAdsConversionParams({
      sendTo,
      value,
      currency,
      transactionId,
    });

    const fire = () => {
      if (typeof window.gtag !== "function") return false;
      window.gtag("event", "conversion", params);
      firedTransactionIds.add(transactionId);
      recordFired(storageKey);
      return true;
    };

    if (fire()) return;

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (fire() || Date.now() - started > 8_000) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [sendTo, value, currency, transactionId]);

  return null;
}
