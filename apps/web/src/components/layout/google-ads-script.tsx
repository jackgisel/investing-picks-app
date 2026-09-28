"use client";

import { useEffect } from "react";
import {
  GOOGLE_ADS_IDLE_TIMEOUT_MS,
  googleAdsBootstrapSource,
  googleAdsMeasurementId,
  googleAdsTagSrc,
} from "@/lib/google-ads";

const BOOTSTRAP_ID = "google-ads-gtag";

/**
 * Loads the Google Ads tag after the browser is idle.
 *
 * The stub and gtag.js used to be real script tags in <head>. gtag.js is
 * ~164KB and was blocking the main thread while the hero image waited to
 * paint. requestIdleCallback keeps that work off the first paint. The
 * purchase conversion polls for window.gtag, which this stub defines.
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

    if (typeof window.requestIdleCallback === "function") {
      const idle = window.requestIdleCallback(load, {
        timeout: GOOGLE_ADS_IDLE_TIMEOUT_MS,
      });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idle);
      };
    }

    const timer = window.setTimeout(load, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [id]);

  return null;
}
