"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  COOKIE_CONSENT_STORAGE_KEY,
  parseCookieConsent,
} from "@/lib/cookie-consent";
import {
  DATAFAST_EVENTS_PATH,
  DATAFAST_SCRIPT_PATH,
  datafastDomain,
} from "@/lib/datafast";

const WEBSITE_ID = process.env.NEXT_PUBLIC_DATAFAST_WEBSITE_ID?.trim() ?? "";

function consentAccepted(): boolean {
  return (
    parseCookieConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY))
      ?.accepted === true
  );
}

export function DataFastScript() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAllowed(consentAccepted());
    sync();
    window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!WEBSITE_ID || !allowed) return null;

  return (
    <Script
      src={DATAFAST_SCRIPT_PATH}
      strategy="afterInteractive"
      data-website-id={WEBSITE_ID}
      data-domain={datafastDomain()}
      data-api-url={DATAFAST_EVENTS_PATH}
      data-disable-payments="true"
      data-disable-console="true"
    />
  );
}
