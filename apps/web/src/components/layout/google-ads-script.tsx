"use client";

import { useEffect } from "react";
import {
  googleAdsBootstrapSource,
  googleAdsMeasurementId,
  googleAdsTagSrc,
  scheduleGoogleAdsTagLoad,
} from "@/lib/google-ads";

const BOOTSTRAP_ID = "google-ads-gtag";

/**
 * Loads the Google Ads tag after LCP when the browser can report it.
 *
 * gtag.js is ~164KB of main-thread work. Deferring until after the hero
 * image paints keeps it off the homepage LCP path. The purchase conversion
 * polls for window.gtag, which the bootstrap stub defines.
 */
export function GoogleAdsScript() {
  const id = googleAdsMeasurementId();

  useEffect(() => {
    if (!id || document.getElementById(BOOTSTRAP_ID)) return;

    let cancelled = false;
    const load = () => {
      if (cancelled || document.getElementById(BOOTSTRAP_ID)) return;
      const inline = document.createElement("script");
      inline.id = BOOTSTRAP_ID;
      inline.text = googleAdsBootstrapSource(id);
      const external = document.createElement("script");
      external.async = true;
      external.src = googleAdsTagSrc(id);
      document.head.appendChild(inline);
      document.head.appendChild(external);
    };

    const cleanup = scheduleGoogleAdsTagLoad(() => {
      if (cancelled) return;
      load();
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [id]);

  return null;
}
